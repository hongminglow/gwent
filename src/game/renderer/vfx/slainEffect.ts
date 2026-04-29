import * as THREE from "three";
import type { CardDefinition, CardInstanceId, GameEvent, MatchState, PlayerId, RowId } from "../../simulation/types";

export type SlainAnimationContract = {
  cardInstanceId: CardInstanceId;
  controllerId?: PlayerId;
  definition: CardDefinition;
  durationSeconds: number;
  major: boolean;
  ownerId?: PlayerId;
  reason: string;
  reducedMotion: boolean;
  rowId?: RowId;
  variant: SlainEffectVariant;
};

export type SlainEffectVariant = "ember" | "magic";

export type SlainCardEffect = {
  root: THREE.Group;
  update: (progress: number) => void;
  dispose: () => void;
};

type SlainPalette = {
  cut: string;
  fragment: string;
  glow: string;
  spark: string;
};

const SPARK_COUNT = 42;
const FRAGMENT_COUNT = 12;

export function createSlainAnimationContract(
  event: GameEvent,
  state: MatchState,
  options: { reducedMotion?: boolean } = {},
): SlainAnimationContract | undefined {
  if (event.type !== "card.destroyed") {
    return undefined;
  }

  const cardInstanceId = getPayloadString(event, "cardInstanceId");

  if (!cardInstanceId) {
    return undefined;
  }

  const card = state.cards[cardInstanceId];
  const definition = card ? state.cardDefinitions[card.definitionId] : undefined;

  if (!card || !definition) {
    return undefined;
  }

  const reducedMotion = options.reducedMotion ?? false;
  const reason = getPayloadString(event, "reason") ?? "destroyed";

  return {
    cardInstanceId,
    controllerId: getPayloadPlayerId(event, "controllerId"),
    definition,
    durationSeconds: getSlainAnimationDuration(definition, { reducedMotion }),
    major: isMajorSlainCard(definition),
    ownerId: getPayloadPlayerId(event, "ownerId"),
    reason,
    reducedMotion,
    rowId: getPayloadRowId(event, "rowId"),
    variant: reason === "scorch" || reason.includes("burn") ? "ember" : "magic",
  };
}

export function getSlainAnimationDuration(
  definition: CardDefinition,
  options: { reducedMotion?: boolean } = {},
): number {
  if (options.reducedMotion) {
    return 0.18;
  }

  return isMajorSlainCard(definition) ? 1.08 : 0.88;
}

export function isMajorSlainCard(definition: CardDefinition): boolean {
  return definition.basePower >= 8 || definition.rarity === "epic" || definition.rarity === "legendary";
}

export function createSlainCardEffect(contract: SlainAnimationContract): SlainCardEffect {
  const palette = getSlainPalette(contract.variant);
  const root = new THREE.Group();
  root.name = `SlainSliceVfx:${contract.cardInstanceId}`;
  root.position.z = 0.078;

  const slashMaterial = createAdditiveMaterial(palette.glow, 0);
  const slash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.72), slashMaterial);
  slash.name = "SlainBladeTrail";
  slash.rotation.z = -0.72;
  slash.position.z = 0.04;
  root.add(slash);

  const cutMaterial = createAdditiveMaterial(palette.cut, 0);
  const cut = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 2.28), cutMaterial);
  cut.name = "SlainCutLine";
  cut.rotation.z = -0.72;
  cut.position.z = 0.047;
  root.add(cut);

  const shockMaterial = createAdditiveMaterial(palette.glow, 0);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.48, 44), shockMaterial);
  shock.name = "SlainImpactPulse";
  shock.position.z = 0.044;
  root.add(shock);

  const sparks = createSparkBurst(palette.spark);
  root.add(sparks.points);

  const fragments = createFragments(palette.fragment);
  for (const fragment of fragments) {
    root.add(fragment.mesh);
  }

  return {
    root,
    update(progress) {
      const p = clamp01(progress);
      const slashIn = easeOutCubic(clamp01(p / 0.16));
      const slashOut = 1 - clamp01((p - 0.18) / 0.32);
      slash.scale.set(1 + slashIn * 0.42, 0.38 + slashIn * 0.82, 1);
      slashMaterial.opacity = slashOut * 0.86;

      const cutLife = 1 - clamp01((p - 0.38) / 0.52);
      cut.scale.set(1 + Math.sin(p * Math.PI) * 0.45, 0.35 + clamp01(p / 0.22) * 0.78, 1);
      cutMaterial.opacity = Math.max(0, cutLife) * 0.92;

      const shockLife = 1 - clamp01(p / 0.42);
      shock.scale.setScalar(0.55 + p * 2.4);
      shockMaterial.opacity = shockLife * 0.34;

      updateSparkBurst(sparks, p);
      updateFragments(fragments, p);
    },
    dispose() {
      slash.geometry.dispose();
      slashMaterial.dispose();
      cut.geometry.dispose();
      cutMaterial.dispose();
      shock.geometry.dispose();
      shockMaterial.dispose();
      sparks.points.geometry.dispose();
      sparks.material.dispose();

      for (const fragment of fragments) {
        fragment.mesh.geometry.dispose();
        fragment.material.dispose();
      }

      root.removeFromParent();
    },
  };
}

function getSlainPalette(variant: SlainEffectVariant): SlainPalette {
  if (variant === "ember") {
    return {
      cut: "#fff0b8",
      fragment: "#e26d37",
      glow: "#ffb55f",
      spark: "#ffd08a",
    };
  }

  return {
    cut: "#d9f4ff",
    fragment: "#7fb8ff",
    glow: "#98e8ff",
    spark: "#c7f5ff",
  };
}

function createAdditiveMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color,
    depthWrite: false,
    opacity,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

function createSparkBurst(color: string) {
  const positions = new Float32Array(SPARK_COUNT * 3);
  const basePositions = new Float32Array(SPARK_COUNT * 3);
  const velocities = new Float32Array(SPARK_COUNT * 3);

  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const offset = index * 3;
    const side = index % 2 === 0 ? -1 : 1;
    const alongCut = -0.92 + (index / Math.max(SPARK_COUNT - 1, 1)) * 1.84;
    const jitter = deterministicNoise(index, 2) * 0.14;
    const baseX = alongCut * Math.cos(-0.72) + jitter;
    const baseY = alongCut * Math.sin(-0.72) + deterministicNoise(index, 4) * 0.12;
    const speed = 0.25 + deterministicNoise(index, 7) * 0.55;
    const angle = -0.72 + side * (1.1 + deterministicNoise(index, 9) * 0.65);

    basePositions[offset] = baseX;
    basePositions[offset + 1] = baseY;
    basePositions[offset + 2] = 0.07;
    positions[offset] = baseX;
    positions[offset + 1] = baseY;
    positions[offset + 2] = 0.07;
    velocities[offset] = Math.cos(angle) * speed;
    velocities[offset + 1] = Math.sin(angle) * speed;
    velocities[offset + 2] = 0.04 + deterministicNoise(index, 11) * 0.08;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color,
    depthWrite: false,
    opacity: 0,
    size: 0.055,
    transparent: true,
  });

  return {
    basePositions,
    material,
    points: new THREE.Points(geometry, material),
    positions,
    velocities,
  };
}

function updateSparkBurst(
  sparks: ReturnType<typeof createSparkBurst>,
  progress: number,
) {
  const burst = easeOutCubic(clamp01((progress - 0.08) / 0.62));

  for (let index = 0; index < SPARK_COUNT; index += 1) {
    const offset = index * 3;
    sparks.positions[offset] = sparks.basePositions[offset] + sparks.velocities[offset] * burst;
    sparks.positions[offset + 1] = sparks.basePositions[offset + 1] + sparks.velocities[offset + 1] * burst;
    sparks.positions[offset + 2] = sparks.basePositions[offset + 2] + sparks.velocities[offset + 2] * burst;
  }

  const positionAttribute = sparks.points.geometry.getAttribute("position");
  positionAttribute.needsUpdate = true;
  sparks.material.opacity = Math.max(0, 1 - clamp01((progress - 0.18) / 0.68)) * 0.9;
}

function createFragments(color: string) {
  return Array.from({ length: FRAGMENT_COUNT }, (_, index) => {
    const geometry = createTriangleGeometry(index);
    const material = createAdditiveMaterial(color, 0);
    const mesh = new THREE.Mesh(geometry, material);
    const angle = (index / FRAGMENT_COUNT) * Math.PI * 2;
    const radius = 0.12 + deterministicNoise(index, 3) * 0.24;

    mesh.name = "SlainCardFragment";
    mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.055);
    mesh.rotation.z = angle;

    return {
      basePosition: mesh.position.clone(),
      material,
      mesh,
      rotationSpeed: -1.6 + deterministicNoise(index, 5) * 3.2,
      velocity: new THREE.Vector3(
        Math.cos(angle) * (0.28 + deterministicNoise(index, 7) * 0.5),
        Math.sin(angle) * (0.24 + deterministicNoise(index, 9) * 0.48),
        0.02 + deterministicNoise(index, 11) * 0.06,
      ),
    };
  });
}

function createTriangleGeometry(index: number): THREE.BufferGeometry {
  const width = 0.07 + deterministicNoise(index, 13) * 0.08;
  const height = 0.09 + deterministicNoise(index, 15) * 0.09;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([
      -width,
      -height,
      0,
      width,
      -height * 0.32,
      0,
      -width * 0.24,
      height,
      0,
    ], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function updateFragments(
  fragments: ReturnType<typeof createFragments>,
  progress: number,
) {
  const p = clamp01((progress - 0.22) / 0.68);
  const spread = easeOutCubic(p);

  for (const fragment of fragments) {
    fragment.mesh.position.copy(fragment.basePosition).addScaledVector(fragment.velocity, spread);
    fragment.mesh.rotation.z += fragment.rotationSpeed * 0.04;
    fragment.mesh.scale.setScalar(0.55 + spread * 0.85);
    fragment.material.opacity = Math.max(0, 1 - p) * 0.54;
  }
}

function getPayloadString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function getPayloadPlayerId(event: GameEvent, key: string): PlayerId | undefined {
  const value = event.payload[key];
  return value === "player" || value === "opponent" ? value : undefined;
}

function getPayloadRowId(event: GameEvent, key: string): RowId | undefined {
  const value = event.payload[key];
  return value === "close" || value === "ranged" || value === "siege" ? value : undefined;
}

function deterministicNoise(seed: number, salt: number): number {
  const raw = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}
