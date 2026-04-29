import * as THREE from "three";
import { FACTIONS } from "../../data/factions";
import type { CardInstanceId, GameEvent, MatchState, PlayerId, RowId } from "../../simulation/types";
import type { BoardAnchors } from "../boardScene";

export type AbilityEventEffectKind =
  | "clear-weather"
  | "commanders-horn"
  | "hero-glint"
  | "leader-burst"
  | "match-win"
  | "medic-revive"
  | "morale-shimmer"
  | "muster-chain"
  | "round-win"
  | "spy-shadow"
  | "tight-bond"
  | "weather-fog"
  | "weather-frost"
  | "weather-rain";

export type AbilityEventEffect = {
  kind: AbilityEventEffectKind | "composite";
  root: THREE.Group;
  update: (progress: number) => void;
  dispose: () => void;
};

export type AbilityEventEffectContext = {
  anchors: BoardAnchors;
  boardRoot: THREE.Group;
  getCardRoot: (cardInstanceId: CardInstanceId) => THREE.Object3D | undefined;
};

const ROWS = ["close", "ranged", "siege"] as const;
const PLAYERS = ["player", "opponent"] as const;
const FACTION_ACCENTS = Object.fromEntries(
  FACTIONS.map((faction) => [faction.id, faction.accentColor]),
);

export function createAbilityEventEffect(
  event: GameEvent,
  state: MatchState,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  switch (event.type) {
    case "weather.applied":
      return createWeatherEffect(getPayloadRowId(event, "rowId"), getPayloadString(event, "sourceCardId"), context);
    case "weather.cleared":
      return createClearWeatherEffect(context);
    case "row.buff.applied":
      return createRowBuffEffect(event, context);
    case "card.revived":
      return createCardAttachedEffect(event, context, "medic-revive", "#8dffce");
    case "card.played":
      return createCardPlayEffect(event, state, context);
    case "leader.used":
      return createLeaderEffect(event, state, context);
    case "round.ended":
      return createRoundWinEffect(event, context);
    case "match.ended":
      return createMatchWinEffect(event, context);
    case "card.destroyed":
    case "card.drawn":
    case "match.created":
    case "phase.changed":
    case "player.passed":
    case "turn.changed":
      return undefined;
    default:
      return assertNever(event.type);
  }
}

export function getWeatherEffectKind(rowId?: RowId, sourceCardId?: string): Extract<AbilityEventEffectKind, "weather-fog" | "weather-frost" | "weather-rain"> {
  if (sourceCardId?.includes("frost") || rowId === "close") {
    return "weather-frost";
  }

  if (sourceCardId?.includes("fog") || rowId === "ranged") {
    return "weather-fog";
  }

  return "weather-rain";
}

function createWeatherEffect(
  rowId: RowId | undefined,
  sourceCardId: string | undefined,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  if (!rowId) {
    return undefined;
  }

  const kind = getWeatherEffectKind(rowId, sourceCardId);
  const color = kind === "weather-frost" ? "#9fdfff" : kind === "weather-fog" ? "#d3d7d0" : "#60a6ff";
  const root = new THREE.Group();
  root.name = `AbilityVfx:${kind}:${rowId}`;
  context.boardRoot.add(root);

  for (const playerId of PLAYERS) {
    const rowPosition = getRowLocalPosition(context, playerId, rowId);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(11.55, 1.22),
      createAdditiveMaterial(color, 0),
    );
    plane.name = `${kind}:RowVeil:${playerId}`;
    plane.position.set(rowPosition.x, rowPosition.y + 0.13, rowPosition.z);
    plane.rotation.x = -Math.PI / 2;
    root.add(plane);

    if (kind === "weather-rain") {
      root.add(createRainStreaks(rowPosition, color));
    } else {
      root.add(createWeatherParticles(rowPosition, color, kind === "weather-frost" ? 20 : 34));
    }
  }

  return createEffect(root, kind, (progress) => {
    const p = clamp01(progress);
    const opacity = Math.sin(p * Math.PI) * (kind === "weather-fog" ? 0.38 : 0.32);

    root.children.forEach((child, index) => {
      child.position.y += Math.sin(p * Math.PI + index) * 0.0015;
      setMaterialOpacity(child, opacity);
      child.scale.setScalar(0.82 + easeOutCubic(p) * 0.22);
    });
  });
}

function createClearWeatherEffect(context: AbilityEventEffectContext): AbilityEventEffect {
  const root = new THREE.Group();
  root.name = "AbilityVfx:clear-weather";
  context.boardRoot.add(root);

  for (const playerId of PLAYERS) {
    for (const rowId of ROWS) {
      const rowPosition = getRowLocalPosition(context, playerId, rowId);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.34, 48),
        createAdditiveMaterial("#f4fff2", 0),
      );
      ring.name = `ClearWeatherPulse:${playerId}:${rowId}`;
      ring.position.set(rowPosition.x, rowPosition.y + 0.22, rowPosition.z);
      ring.rotation.x = -Math.PI / 2;
      root.add(ring);
    }
  }

  return createEffect(root, "clear-weather", (progress) => {
    const p = clamp01(progress);

    root.children.forEach((child, index) => {
      child.scale.setScalar(0.8 + easeOutCubic(p) * (8.5 + index * 0.08));
      setMaterialOpacity(child, (1 - p) * 0.42);
    });
  });
}

function createRowBuffEffect(
  event: GameEvent,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  const playerId = getPayloadPlayerId(event, "playerId");
  const rowId = getPayloadRowId(event, "rowId");

  if (!playerId || !rowId) {
    return undefined;
  }

  const root = new THREE.Group();
  root.name = `AbilityVfx:commanders-horn:${playerId}:${rowId}`;
  context.boardRoot.add(root);
  const rowPosition = getRowLocalPosition(context, playerId, rowId);

  const wave = new THREE.Mesh(
    new THREE.PlaneGeometry(11.2, 1.05),
    createAdditiveMaterial("#f5d76f", 0),
  );
  wave.name = "CommandersHornRowPulse";
  wave.position.set(rowPosition.x, rowPosition.y + 0.24, rowPosition.z);
  wave.rotation.x = -Math.PI / 2;
  root.add(wave);

  const rings = [-3.6, 0, 3.6].map((x, index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.18, 36),
      createAdditiveMaterial("#ffe8a4", 0),
    );
    ring.name = `CommandersHornRing:${index}`;
    ring.position.set(rowPosition.x + x, rowPosition.y + 0.28, rowPosition.z);
    ring.rotation.x = -Math.PI / 2;
    root.add(ring);
    return ring;
  });

  return createEffect(root, "commanders-horn", (progress) => {
    const p = clamp01(progress);
    wave.scale.set(0.45 + easeOutCubic(p) * 0.65, 1, 1);
    setMaterialOpacity(wave, Math.sin(p * Math.PI) * 0.38);

    rings.forEach((ring, index) => {
      ring.scale.setScalar(1 + easeOutCubic(clamp01(p - index * 0.06)) * 4.8);
      setMaterialOpacity(ring, (1 - p) * 0.58);
    });
  });
}

function createCardPlayEffect(
  event: GameEvent,
  state: MatchState,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  const cardInstanceId = getPayloadString(event, "cardInstanceId");

  if (!cardInstanceId) {
    return undefined;
  }

  const card = state.cards[cardInstanceId];
  const definition = card ? state.cardDefinitions[card.definitionId] : undefined;

  if (!definition) {
    return undefined;
  }

  const reason = getPayloadString(event, "reason");
  const effects: AbilityEventEffect[] = [];

  if (reason === "spy") {
    const effect = createCardAttachedEffect(event, context, "spy-shadow", "#313043");
    if (effect) effects.push(effect);
  }

  if (reason === "muster") {
    const effect = createCardAttachedEffect(event, context, "muster-chain", "#95f2a5");
    if (effect) effects.push(effect);
  }

  if (reason === "medic") {
    const effect = createCardAttachedEffect(event, context, "medic-revive", "#8dffce");
    if (effect) effects.push(effect);
  }

  if (definition.abilities.includes("tight-bond")) {
    const effect = createTightBondEffect(event, context);
    if (effect) effects.push(effect);
  }

  if (definition.abilities.includes("morale-boost")) {
    const effect = createMoraleBoostEffect(event, context);
    if (effect) effects.push(effect);
  }

  if (definition.type === "hero" || definition.abilities.includes("hero")) {
    const effect = createCardAttachedEffect(event, context, "hero-glint", "#fff2b6");
    if (effect) effects.push(effect);
  }

  return createCompositeEffect(effects);
}

function createCardAttachedEffect(
  event: GameEvent,
  context: AbilityEventEffectContext,
  kind: Extract<AbilityEventEffectKind, "hero-glint" | "medic-revive" | "muster-chain" | "spy-shadow">,
  color: string,
): AbilityEventEffect | undefined {
  const cardInstanceId = getPayloadString(event, "cardInstanceId");
  const cardRoot = cardInstanceId ? context.getCardRoot(cardInstanceId) : undefined;

  if (!cardRoot) {
    return undefined;
  }

  const root = new THREE.Group();
  root.name = `AbilityVfx:${kind}:${cardInstanceId}`;
  root.position.z = 0.08;
  cardRoot.add(root);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.36, 42),
    createAdditiveMaterial(color, 0),
  );
  ring.name = `${kind}:AuraRing`;
  root.add(ring);

  const flare = new THREE.Mesh(
    new THREE.PlaneGeometry(kind === "spy-shadow" ? 1.12 : 0.18, kind === "spy-shadow" ? 1.42 : 1.7),
    createAdditiveMaterial(color, 0),
  );
  flare.name = `${kind}:Flare`;
  flare.rotation.z = kind === "hero-glint" ? -0.78 : 0.32;
  flare.position.z = 0.02;
  root.add(flare);

  if (kind === "muster-chain") {
    for (let index = 0; index < 4; index += 1) {
      const link = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.012, 8, 24),
        createAdditiveMaterial(color, 0),
      );
      link.name = `MusterChainLink:${index}`;
      link.position.set(-0.42 + index * 0.28, -0.52 + index * 0.34, 0.035);
      link.rotation.z = 0.72;
      root.add(link);
    }
  }

  return createEffect(root, kind, (progress) => {
    const p = clamp01(progress);
    const pulse = Math.sin(p * Math.PI);
    ring.scale.setScalar(0.7 + easeOutCubic(p) * (kind === "spy-shadow" ? 2.2 : 1.8));
    setMaterialOpacity(ring, (1 - p) * (kind === "spy-shadow" ? 0.32 : 0.62));

    flare.scale.set(kind === "spy-shadow" ? 1 + p * 0.6 : 1 + pulse * 0.18, 1 + p * 0.35, 1);
    setMaterialOpacity(flare, pulse * (kind === "spy-shadow" ? 0.34 : 0.7));
    root.children.forEach((child, index) => {
      if (child !== ring && child !== flare) {
        child.rotation.z += 0.08 + index * 0.01;
        setMaterialOpacity(child, pulse * 0.65);
      }
    });
  });
}

function createTightBondEffect(
  event: GameEvent,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  const playerId = getPayloadPlayerId(event, "controllerId") ?? getPayloadPlayerId(event, "playerId");
  const rowId = getPayloadRowId(event, "rowId");

  if (!playerId || !rowId) {
    return undefined;
  }

  const rowPosition = getRowLocalPosition(context, playerId, rowId);
  const root = new THREE.Group();
  root.name = `AbilityVfx:tight-bond:${playerId}:${rowId}`;
  context.boardRoot.add(root);

  for (const x of [-2.8, 0, 2.8]) {
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.05),
      createAdditiveMaterial("#74c7ff", 0),
    );
    band.name = "TightBondLink";
    band.position.set(rowPosition.x + x, rowPosition.y + 0.31, rowPosition.z);
    band.rotation.x = -Math.PI / 2;
    root.add(band);
  }

  return createEffect(root, "tight-bond", (progress) => {
    const p = clamp01(progress);
    root.children.forEach((child, index) => {
      child.scale.set(0.4 + easeOutCubic(p) * 2.2, 1, 1);
      child.position.x = rowPosition.x - 2.8 + index * 2.8 + Math.sin(p * Math.PI * 2 + index) * 0.12;
      setMaterialOpacity(child, Math.sin(p * Math.PI) * 0.5);
    });
  });
}

function createMoraleBoostEffect(
  event: GameEvent,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  const playerId = getPayloadPlayerId(event, "controllerId") ?? getPayloadPlayerId(event, "playerId");
  const rowId = getPayloadRowId(event, "rowId");

  if (!playerId || !rowId) {
    return undefined;
  }

  const rowPosition = getRowLocalPosition(context, playerId, rowId);
  const root = new THREE.Group();
  root.name = `AbilityVfx:morale-shimmer:${playerId}:${rowId}`;
  context.boardRoot.add(root);
  const shimmer = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 0.72),
    createAdditiveMaterial("#a4ffcb", 0),
  );
  shimmer.name = "MoraleBoostRowShimmer";
  shimmer.position.set(rowPosition.x, rowPosition.y + 0.29, rowPosition.z);
  shimmer.rotation.x = -Math.PI / 2;
  root.add(shimmer);

  return createEffect(root, "morale-shimmer", (progress) => {
    const p = clamp01(progress);
    shimmer.position.x = rowPosition.x - 1.1 + easeOutCubic(p) * 2.2;
    shimmer.scale.set(0.4 + p * 0.9, 1, 1);
    setMaterialOpacity(shimmer, Math.sin(p * Math.PI) * 0.34);
  });
}

function createLeaderEffect(
  event: GameEvent,
  state: MatchState,
  context: AbilityEventEffectContext,
): AbilityEventEffect | undefined {
  const cardInstanceId = getPayloadString(event, "leaderCardInstanceId");
  const cardRoot = cardInstanceId ? context.getCardRoot(cardInstanceId) : undefined;

  if (!cardInstanceId || !cardRoot) {
    return undefined;
  }

  const card = state.cards[cardInstanceId];
  const definition = card ? state.cardDefinitions[card.definitionId] : undefined;
  const color = definition ? FACTION_ACCENTS[definition.faction] ?? "#f5d76f" : "#f5d76f";
  const root = new THREE.Group();
  root.name = `AbilityVfx:leader-burst:${cardInstanceId}`;
  root.position.z = 0.09;
  cardRoot.add(root);

  for (let index = 0; index < 3; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18 + index * 0.08, 0.24 + index * 0.08, 54),
      createAdditiveMaterial(color, 0),
    );
    ring.name = `LeaderFactionBurstRing:${index}`;
    root.add(ring);
  }

  return createEffect(root, "leader-burst", (progress) => {
    const p = clamp01(progress);
    root.children.forEach((child, index) => {
      child.scale.setScalar(0.8 + easeOutCubic(clamp01(p - index * 0.04)) * 2.4);
      child.rotation.z += 0.04 + index * 0.02;
      setMaterialOpacity(child, (1 - p) * 0.72);
    });
  });
}

function createRoundWinEffect(
  event: GameEvent,
  context: AbilityEventEffectContext,
): AbilityEventEffect {
  const winnerIds = getPayloadPlayerIds(event, "winnerIds");
  const root = new THREE.Group();
  root.name = "AbilityVfx:round-win";
  context.boardRoot.add(root);
  const players = winnerIds.length > 0 ? winnerIds : PLAYERS;

  for (const playerId of players) {
    const z = playerId === "player" ? 3.55 : -3.55;
    const pulse = new THREE.Mesh(
      new THREE.PlaneGeometry(12.2, 4.85),
      createAdditiveMaterial("#f5d76f", 0),
    );
    pulse.name = `RoundWinBoardPulse:${playerId}`;
    pulse.position.set(0, 0.34, z);
    pulse.rotation.x = -Math.PI / 2;
    root.add(pulse);
  }

  return createEffect(root, "round-win", (progress) => {
    const p = clamp01(progress);
    root.children.forEach((child) => {
      child.scale.set(0.78 + easeOutCubic(p) * 0.42, 1, 1);
      setMaterialOpacity(child, Math.sin(p * Math.PI) * 0.28);
    });
  });
}

function createMatchWinEffect(
  event: GameEvent,
  context: AbilityEventEffectContext,
): AbilityEventEffect {
  const winnerId = getPayloadPlayerId(event, "winnerId");
  const root = new THREE.Group();
  root.name = `AbilityVfx:match-win:${winnerId ?? "draw"}`;
  context.boardRoot.add(root);

  for (let index = 0; index < 5; index += 1) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35 + index * 0.16, 0.43 + index * 0.16, 72),
      createAdditiveMaterial(index % 2 === 0 ? "#f5d76f" : "#ffffff", 0),
    );
    ring.name = `MatchWinCinematicRing:${index}`;
    ring.position.set(0, 0.58, 0);
    ring.rotation.x = -Math.PI / 2;
    root.add(ring);
  }

  return createEffect(root, "match-win", (progress) => {
    const p = clamp01(progress);
    root.children.forEach((child, index) => {
      child.scale.setScalar(1 + easeOutCubic(clamp01(p - index * 0.035)) * (8.2 + index));
      child.rotation.z += 0.035 + index * 0.01;
      setMaterialOpacity(child, Math.sin(p * Math.PI) * (index === 0 ? 0.58 : 0.32));
    });
  });
}

function createCompositeEffect(effects: AbilityEventEffect[]): AbilityEventEffect | undefined {
  if (effects.length === 0) {
    return undefined;
  }

  if (effects.length === 1) {
    return effects[0];
  }

  return {
    kind: "composite",
    root: new THREE.Group(),
    update(progress) {
      effects.forEach((effect) => effect.update(progress));
    },
    dispose() {
      effects.forEach((effect) => effect.dispose());
    },
  };
}

function createEffect(
  root: THREE.Group,
  kind: AbilityEventEffectKind,
  update: (progress: number) => void,
): AbilityEventEffect {
  return {
    kind,
    root,
    update,
    dispose() {
      disposeObjectTree(root);
      root.removeFromParent();
    },
  };
}

function createWeatherParticles(position: THREE.Vector3, color: string, count: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    positions[offset] = position.x - 5.2 + deterministicNoise(index, 1) * 10.4;
    positions[offset + 1] = position.y + 0.44 + deterministicNoise(index, 2) * 0.18;
    positions[offset + 2] = position.z - 0.52 + deterministicNoise(index, 3) * 1.04;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color,
    depthWrite: false,
    opacity: 0.44,
    size: 0.055,
    transparent: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "WeatherParticles";
  return points;
}

function createRainStreaks(position: THREE.Vector3, color: string): THREE.Group {
  const root = new THREE.Group();
  root.name = "TorrentialRainStreaks";

  for (let index = 0; index < 18; index += 1) {
    const streak = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, 0.48),
      createAdditiveMaterial(color, 0.38),
    );
    streak.name = `RainStreak:${index}`;
    streak.position.set(
      position.x - 5 + deterministicNoise(index, 4) * 10,
      position.y + 0.56,
      position.z - 0.55 + deterministicNoise(index, 5) * 1.1,
    );
    streak.rotation.set(-Math.PI / 2, 0, -0.18);
    root.add(streak);
  }

  return root;
}

function getRowLocalPosition(
  context: AbilityEventEffectContext,
  playerId: PlayerId,
  rowId: RowId,
): THREE.Vector3 {
  const worldPosition = context.anchors.rowZones[playerId][rowId].getWorldPosition(new THREE.Vector3());
  return context.boardRoot.worldToLocal(worldPosition);
}

function setMaterialOpacity(object: THREE.Object3D, opacity: number) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.LineSegments)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if ("opacity" in material) {
        material.opacity = Math.max(0, opacity);
        material.transparent = true;
      }
    });
  });
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

function disposeObjectTree(root: THREE.Object3D) {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function getPayloadString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function getPayloadPlayerId(event: GameEvent, key: string): PlayerId | undefined {
  const value = event.payload[key];
  return value === "player" || value === "opponent" ? value : undefined;
}

function getPayloadPlayerIds(event: GameEvent, key: string): PlayerId[] {
  const value = event.payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((playerId): playerId is PlayerId => playerId === "player" || playerId === "opponent");
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

function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
