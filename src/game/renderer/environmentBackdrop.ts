import * as THREE from "three";

export type EnvironmentBackdrop = {
  root: THREE.Group;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

type LavaBurst = {
  basePosition: THREE.Vector3;
  phase: number;
  bubbles: THREE.Sprite[];
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  droplets: LavaDropletCluster;
  light: THREE.PointLight;
};

type FloatingCard = {
  basePosition: THREE.Vector3;
  mesh: THREE.Group;
  phase: number;
  spin: number;
};

type ParticleField = {
  basePositions: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  positions: Float32Array;
  speeds: Float32Array;
};

type LavaDropletCluster = {
  basePositions: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
};

type RockPillar = {
  baseY: number;
  mesh: THREE.Mesh<THREE.CylinderGeometry | THREE.ConeGeometry, THREE.MeshStandardMaterial>;
  phase: number;
};

const EMBER_COUNT = 260;
const DROPLETS_PER_BURST = 38;
const LAVA_UNIFORM_TIME = "uTime";
const BACKDROP_RENDER_ORDER = -80;

const LAVA_VERTEX_SHADER = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float waveA = sin(position.x * 1.15 + uTime * 0.68);
    float waveB = sin(position.y * 1.8 - uTime * 0.9);
    float waveC = sin((position.x - position.y) * 0.72 + uTime * 0.44);
    vWave = waveA * 0.45 + waveB * 0.36 + waveC * 0.19;
    transformed.z += vWave * 0.16;
    vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const LAVA_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vWorldPosition;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(13.1, 7.7);
      amplitude *= 0.52;
    }
    return value;
  }

  void main() {
    vec2 lavaUv = vUv * 8.0;
    vec2 driftA = vec2(uTime * 0.055, -uTime * 0.026);
    vec2 driftB = vec2(-uTime * 0.033, uTime * 0.041);
    float coarse = fbm(lavaUv * 0.54 + driftA);
    float fine = fbm(lavaUv * 2.35 + driftB);
    float crackField = 1.0 - abs(fbm(lavaUv * 1.12 + vec2(fine * 1.7, coarse * 1.2)) * 2.0 - 1.0);
    float river = smoothstep(0.58, 0.98, crackField + fine * 0.22 + vWave * 0.08);
    float crustMask = smoothstep(0.25, 0.74, coarse + noise(lavaUv * 0.36) * 0.48);
    float hotCore = smoothstep(0.86, 1.08, river + fine * 0.16);
    float heat = clamp(river * (1.0 - crustMask * 0.72) + hotCore * 0.38, 0.0, 1.0);
    float centerGlow = 1.0 - smoothstep(0.08, 0.74, length(vUv - 0.5));

    vec3 basalt = vec3(0.025, 0.018, 0.014);
    vec3 cooledCrust = vec3(0.085, 0.039, 0.022);
    vec3 deepMagma = vec3(0.36, 0.024, 0.004);
    vec3 moltenOrange = vec3(0.92, 0.18, 0.018);
    vec3 whiteHot = vec3(1.0, 0.52, 0.095);
    vec3 color = mix(basalt, cooledCrust, crustMask * 0.85);
    color = mix(color, deepMagma, smoothstep(0.16, 0.5, heat));
    color = mix(color, moltenOrange, smoothstep(0.42, 0.76, heat));
    color = mix(color, whiteHot, hotCore * 0.36);
    color *= 0.42 + centerGlow * 0.5;
    color += vec3(0.82, 0.12, 0.018) * river * 0.1;
    color += vec3(1.0, 0.34, 0.045) * hotCore * 0.12;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

export function createEnvironmentBackdrop(): EnvironmentBackdrop {
  const root = new THREE.Group();
  root.name = "LiveLavaArenaBackdrop";
  const lavaMaterials: THREE.ShaderMaterial[] = [];
  const bursts: LavaBurst[] = [];
  const floatingCards: FloatingCard[] = [];
  const rockPillars: RockPillar[] = [];

  root.add(createLavaLake(lavaMaterials));
  root.add(createMoltenTableChannels(lavaMaterials));
  root.add(createVolcanicWalls(rockPillars));
  root.add(createLavaBursts(bursts));

  for (const card of createFloatingCards()) {
    floatingCards.push(card);
    root.add(card.mesh);
  }

  const embers = createEmberField();
  root.add(embers.points);

  const lavaCoreLight = new THREE.PointLight("#ff7a2f", 18, 25, 2.1);
  lavaCoreLight.name = "LavaArenaCoreLight";
  lavaCoreLight.position.set(0, 1.8, 0.6);
  root.add(lavaCoreLight);

  const leftEruptionLight = new THREE.PointLight("#ffb45f", 9, 14, 2);
  leftEruptionLight.name = "LavaArenaLeftBurstLight";
  leftEruptionLight.position.set(-8.3, 2.1, 1.6);
  root.add(leftEruptionLight);

  const rightEruptionLight = new THREE.PointLight("#ffb45f", 9, 14, 2);
  rightEruptionLight.name = "LavaArenaRightBurstLight";
  rightEruptionLight.position.set(8.3, 2.1, -1.6);
  root.add(rightEruptionLight);
  prepareBackdropRendering(root);

  let elapsed = 0;

  return {
    root,
    update(deltaSeconds) {
      elapsed += deltaSeconds;

      for (const material of lavaMaterials) {
        material.uniforms[LAVA_UNIFORM_TIME].value = elapsed;
      }

      updateLavaBursts(bursts, elapsed);
      updateEmberField(embers, elapsed);

      floatingCards.forEach((card) => {
        card.mesh.position.set(
          card.basePosition.x + Math.sin(elapsed * 0.34 + card.phase) * 0.16,
          card.basePosition.y + Math.sin(elapsed * 0.82 + card.phase) * 0.24,
          card.basePosition.z + Math.cos(elapsed * 0.45 + card.phase) * 0.16,
        );
        card.mesh.rotation.y += deltaSeconds * card.spin;
        card.mesh.rotation.z = Math.sin(elapsed * 0.7 + card.phase) * 0.1;
      });

      rockPillars.forEach((pillar) => {
        pillar.mesh.position.y = pillar.baseY + Math.sin(elapsed * 0.52 + pillar.phase) * 0.035;
        pillar.mesh.rotation.y += deltaSeconds * 0.025;
      });

      lavaCoreLight.intensity = 16 + Math.sin(elapsed * 1.4) * 2.5;
      leftEruptionLight.intensity = 7.5 + Math.sin(elapsed * 2.1) * 2.4;
      rightEruptionLight.intensity = 7.5 + Math.cos(elapsed * 2.0) * 2.4;
    },
    dispose() {
      disposeObjectTree(root);
      root.removeFromParent();
    },
  };
}

function createLavaLake(lavaMaterials: THREE.ShaderMaterial[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "LavaArenaLake";

  const lakeMaterial = createLavaMaterial(0.98);
  lavaMaterials.push(lakeMaterial);
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(44, 44, 128, 128), lakeMaterial);
  lake.name = "FullSceneLavaLake";
  lake.position.set(0, -0.68, 0.7);
  lake.rotation.x = -Math.PI / 2;
  group.add(lake);

  const glow = new THREE.Mesh(
    new THREE.RingGeometry(8.4, 18.5, 96),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: "#ff762f",
      depthWrite: false,
      opacity: 0.24,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  glow.name = "LavaLakeArenaGlow";
  glow.position.set(0, -0.55, 0.2);
  glow.rotation.x = -Math.PI / 2;
  group.add(glow);
  group.add(createBasaltCrustPlates());

  return group;
}

function createBasaltCrustPlates(): THREE.Group {
  const group = new THREE.Group();
  group.name = "LavaLakeBasaltCrust";
  const crustMaterial = new THREE.MeshStandardMaterial({
    color: "#17100d",
    emissive: "#361107",
    emissiveIntensity: 0.18,
    flatShading: true,
    metalness: 0.02,
    roughness: 0.94,
  });
  const edgeMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#ff6c22",
    depthWrite: false,
    opacity: 0.18,
    transparent: true,
  });

  for (let index = 0; index < 30; index += 1) {
    const sideBias = deterministicNoise(index, 18);
    const x = sideBias < 0.5
      ? -10.6 + deterministicNoise(index, 2) * 21.2
      : (deterministicNoise(index, 3) < 0.5 ? -9.2 : 9.2) + deterministicNoise(index, 4) * 2.6 - 1.3;
    const z = sideBias < 0.5
      ? (deterministicNoise(index, 5) < 0.5 ? -9.3 : 9.3) + deterministicNoise(index, 6) * 2.8 - 1.4
      : -9.2 + deterministicNoise(index, 7) * 18.4;
    const radius = 0.32 + deterministicNoise(index, 8) * 0.8;
    const plate = new THREE.Mesh(createJaggedPlateGeometry(radius, index), crustMaterial.clone());
    plate.name = `BasaltCrustPlate:${index}`;
    plate.position.set(x, -0.49 + deterministicNoise(index, 9) * 0.035, z);
    plate.rotation.set(-Math.PI / 2, 0, deterministicNoise(index, 10) * Math.PI * 2);
    plate.scale.set(1.0 + deterministicNoise(index, 11) * 1.25, 1.0, 0.48 + deterministicNoise(index, 12) * 0.6);
    group.add(plate);

    if (index % 3 === 0) {
      const glow = new THREE.Mesh(createJaggedPlateGeometry(radius * 1.04, index + 100), edgeMaterial.clone());
      glow.name = `BasaltCrustEdgeGlow:${index}`;
      glow.position.copy(plate.position);
      glow.position.y -= 0.004;
      glow.rotation.copy(plate.rotation);
      glow.scale.copy(plate.scale);
      group.add(glow);
    }
  }

  return group;
}

function createJaggedPlateGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const segments = 12;
  const vertices: number[] = [0, 0, 0];
  const indices: number[] = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const jag = 0.74 + deterministicNoise(seed, index + 20) * 0.52;
    vertices.push(Math.cos(angle) * radius * jag, Math.sin(angle) * radius * jag, 0);
  }

  for (let index = 1; index <= segments; index += 1) {
    indices.push(0, index, index === segments ? 1 : index + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createMoltenTableChannels(lavaMaterials: THREE.ShaderMaterial[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "MoltenTableChannels";
  const channelSpecs = [
    { name: "FrontChannel", width: 13.7, depth: 0.72, x: 0, z: 7.08 },
    { name: "BackChannel", width: 13.7, depth: 0.72, x: 0, z: -7.08 },
    { name: "LeftChannel", width: 0.62, depth: 14.2, x: -6.18, z: 0 },
    { name: "RightChannel", width: 0.62, depth: 14.2, x: 6.18, z: 0 },
  ];

  for (const spec of channelSpecs) {
    const material = createLavaMaterial(0.76);
    lavaMaterials.push(material);
    const channel = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.depth, 24, 24), material);
    channel.name = `MoltenTableChannel:${spec.name}`;
    channel.position.set(spec.x, 0.108, spec.z);
    channel.rotation.x = -Math.PI / 2;
    group.add(channel);

    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width + 0.08, 0.032, spec.depth + 0.08),
      new THREE.MeshStandardMaterial({
        color: "#130c08",
        emissive: "#5a1a07",
        emissiveIntensity: 0.18,
        roughness: 0.76,
        metalness: 0.16,
        transparent: true,
        opacity: 0.72,
      }),
    );
    rim.name = `MoltenTableChannelRim:${spec.name}`;
    rim.position.set(spec.x, 0.091, spec.z);
    group.add(rim);
  }

  return group;
}

function createVolcanicWalls(rockPillars: RockPillar[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "LavaArenaVolcanicWalls";
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: "#120f0c",
    emissive: "#321207",
    emissiveIntensity: 0.26,
    roughness: 0.88,
    metalness: 0.08,
  });
  const fissureMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#ff8a33",
    depthWrite: false,
    opacity: 0.6,
    transparent: true,
  });

  for (let index = 0; index < 30; index += 1) {
    const side = index % 3;
    const height = 1.8 + deterministicNoise(index, 1) * 3.8;
    const radius = 0.34 + deterministicNoise(index, 2) * 0.32;
    const x = side === 0
      ? -10.6
      : side === 1
        ? 10.6
        : -10 + deterministicNoise(index, 3) * 20;
    const z = side === 0 || side === 1
      ? -8.8 + deterministicNoise(index, 4) * 18
      : -11.6;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.72, radius, height, 6),
      rockMaterial.clone(),
    );
    pillar.name = `VolcanicWallPillar:${index}`;
    pillar.position.set(x, height / 2 - 0.62, z);
    pillar.rotation.y = deterministicNoise(index, 5) * Math.PI;
    pillar.castShadow = false;
    group.add(pillar);
    rockPillars.push({
      baseY: pillar.position.y,
      mesh: pillar,
      phase: deterministicNoise(index, 6) * Math.PI * 2,
    });

    if (index % 2 === 0) {
      const fissure = new THREE.Mesh(new THREE.BoxGeometry(0.045, height * 0.62, 0.025), fissureMaterial);
      fissure.name = `VolcanicWallFissure:${index}`;
      fissure.position.set(x + (side === 1 ? -0.02 : 0.02), pillar.position.y, z + 0.02);
      fissure.rotation.y = pillar.rotation.y;
      group.add(fissure);
    }
  }

  return group;
}

function createLavaBursts(bursts: LavaBurst[]): THREE.Group {
  const group = new THREE.Group();
  group.name = "LavaArenaBursts";
  const bubbleTexture = createLavaBubbleTexture();
  const dropletTexture = createLavaDropletTexture();
  const burstPositions = [
    { x: -8.25, z: 5.45, phase: 0.1 },
    { x: 8.45, z: 4.3, phase: 1.5 },
    { x: -8.9, z: -2.4, phase: 2.4 },
    { x: 8.75, z: -4.85, phase: 3.3 },
    { x: -10.25, z: 1.25, phase: 4.1 },
    { x: 10.2, z: 0.55, phase: 5.0 },
    { x: -3.8, z: -9.25, phase: 2.9 },
    { x: 3.35, z: -9.55, phase: 0.8 },
  ];

  for (const spec of burstPositions) {
    const basePosition = new THREE.Vector3(spec.x, -0.5, spec.z);
    const bubbles: THREE.Sprite[] = [];

    for (let index = 0; index < 6; index += 1) {
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
        blending: THREE.AdditiveBlending,
        color: index % 2 === 0 ? "#ff8a32" : "#d93412",
        depthTest: true,
        depthWrite: false,
        opacity: 0,
        map: bubbleTexture,
        transparent: true,
      }));
      bubble.name = "LavaBubblePop";
      bubble.center.set(0.5, 0.5);
      bubble.userData.offsetX = (deterministicNoise(index, spec.phase + 1) - 0.5) * 0.64;
      bubble.userData.offsetZ = (deterministicNoise(index, spec.phase + 2) - 0.5) * 0.64;
      bubble.userData.offsetPhase = deterministicNoise(index, spec.phase + 3);
      bubble.position.set(spec.x + bubble.userData.offsetX, -0.42, spec.z + bubble.userData.offsetZ);
      bubble.scale.setScalar(0.04);
      group.add(bubble);
      bubbles.push(bubble);
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.012, 8, 32),
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: "#ff6a22",
        depthTest: true,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    ring.name = "LavaBurstShockRing";
    ring.position.set(spec.x, -0.5, spec.z);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const droplets = createLavaDropletCluster(spec.x, spec.z, spec.phase, dropletTexture);
    group.add(droplets.points);

    const light = new THREE.PointLight("#ff8a32", 0, 7.5, 2);
    light.name = "LavaBurstLocalLight";
    light.position.set(spec.x, 0.4, spec.z);
    group.add(light);

    bursts.push({
      basePosition,
      phase: spec.phase,
      bubbles,
      ring,
      droplets,
      light,
    });
  }

  return group;
}

function createFloatingCards(): FloatingCard[] {
  const specs = [
    { x: -7.65, y: 2.2, z: 2.2, color: "#ffd076", phase: 0.2, spin: 0.42 },
    { x: -8.4, y: 1.5, z: -3.4, color: "#ff895f", phase: 1.2, spin: -0.32 },
    { x: -5.9, y: 2.85, z: -8.4, color: "#82eaff", phase: 2.1, spin: 0.24 },
    { x: 7.6, y: 2.15, z: 2.85, color: "#ffd076", phase: 3.4, spin: -0.42 },
    { x: 8.55, y: 1.55, z: -3.25, color: "#ff895f", phase: 4.2, spin: 0.32 },
    { x: 5.9, y: 2.75, z: -8.35, color: "#82eaff", phase: 5.1, spin: -0.24 },
  ];

  return specs.map((spec) => {
    const mesh = createSpectralCard(spec.color);
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.rotation.set(-0.16, spec.x < 0 ? -0.55 : 0.55, spec.x < 0 ? 0.15 : -0.15);
    return {
      basePosition: mesh.position.clone(),
      mesh,
      phase: spec.phase,
      spin: spec.spin,
    };
  });
}

function createSpectralCard(color: string): THREE.Group {
  const group = new THREE.Group();
  group.name = "LavaArenaSpectralCard";
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.02, 0.032),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color,
      depthWrite: false,
      opacity: 0.16,
      transparent: true,
    }),
  );
  const frameMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color,
    depthWrite: false,
    opacity: 0.62,
    transparent: true,
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.03, 0.036), frameMaterial);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.03, 0.036), frameMaterial);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.08, 0.036), frameMaterial);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.08, 0.036), frameMaterial);
  const slash = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.88, 0.04), frameMaterial);
  top.position.y = 0.54;
  bottom.position.y = -0.54;
  left.position.x = -0.39;
  right.position.x = 0.39;
  slash.rotation.z = 0.75;
  group.add(face, top, bottom, left, right, slash);
  return group;
}

function createEmberField(): ParticleField {
  const positions = new Float32Array(EMBER_COUNT * 3);
  const basePositions = new Float32Array(EMBER_COUNT * 3);
  const speeds = new Float32Array(EMBER_COUNT);

  for (let index = 0; index < EMBER_COUNT; index += 1) {
    const offset = index * 3;
    const x = -11 + deterministicNoise(index, 1) * 22;
    const y = -0.3 + deterministicNoise(index, 2) * 5.6;
    const z = -11.2 + deterministicNoise(index, 3) * 23.8;
    basePositions[offset] = x;
    basePositions[offset + 1] = y;
    basePositions[offset + 2] = z;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    speeds[index] = 0.22 + deterministicNoise(index, 4) * 0.86;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color: "#ffbc68",
    depthTest: true,
    depthWrite: false,
    map: createLavaDropletTexture(),
    opacity: 0.68,
    size: 0.052,
    sizeAttenuation: true,
    transparent: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "FullSceneLavaEmbers";

  return {
    basePositions,
    geometry,
    material,
    points,
    positions,
    speeds,
  };
}

function createLavaDropletCluster(
  x: number,
  z: number,
  phase: number,
  texture: THREE.Texture,
): LavaDropletCluster {
  const positions = new Float32Array(DROPLETS_PER_BURST * 3);
  const basePositions = new Float32Array(DROPLETS_PER_BURST * 3);
  const velocities = new Float32Array(DROPLETS_PER_BURST * 3);

  for (let index = 0; index < DROPLETS_PER_BURST; index += 1) {
    const offset = index * 3;
    const angle = deterministicNoise(index, phase + 1) * Math.PI * 2;
    const radius = deterministicNoise(index, phase + 2) * 0.22;
    basePositions[offset] = x + Math.cos(angle) * radius;
    basePositions[offset + 1] = -0.36 + deterministicNoise(index, phase + 3) * 0.18;
    basePositions[offset + 2] = z + Math.sin(angle) * radius;
    positions[offset] = basePositions[offset];
    positions[offset + 1] = basePositions[offset + 1];
    positions[offset + 2] = basePositions[offset + 2];
    velocities[offset] = Math.cos(angle) * (0.08 + deterministicNoise(index, phase + 4) * 0.34);
    velocities[offset + 1] = 0.32 + deterministicNoise(index, phase + 5) * 0.78;
    velocities[offset + 2] = Math.sin(angle) * (0.08 + deterministicNoise(index, phase + 6) * 0.34);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color: "#ff8a36",
    depthTest: true,
    depthWrite: false,
    map: texture,
    opacity: 0,
    size: 0.08,
    sizeAttenuation: true,
    transparent: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = "LavaBurstMoltenDroplets";

  return {
    basePositions,
    geometry,
    material,
    points,
    positions,
    velocities,
  };
}

function createLavaMaterial(opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    blending: THREE.NormalBlending,
    depthWrite: false,
    fragmentShader: LAVA_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
      [LAVA_UNIFORM_TIME]: { value: 0 },
      uOpacity: { value: opacity },
    },
    vertexShader: LAVA_VERTEX_SHADER,
  });
}

function createLavaDropletTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = getCanvasContext(canvas);
  paintSoftBlob(context, 48, 48, 44, "rgba(255, 244, 162, 1)", "rgba(255, 78, 8, 0)", 1, 1);
  paintSoftBlob(context, 43, 39, 15, "rgba(255, 255, 225, 0.88)", "rgba(255, 190, 70, 0)", 1, 1);
  return finalizeCanvasTexture(canvas, "LavaDropletTexture");
}

function createLavaBubbleTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = getCanvasContext(canvas);
  paintSoftBlob(context, 48, 48, 42, "rgba(255, 101, 26, 0.72)", "rgba(145, 18, 4, 0)", 1, 1);
  paintSoftBlob(context, 42, 39, 17, "rgba(255, 220, 110, 0.48)", "rgba(255, 98, 24, 0)", 1, 1);
  context.strokeStyle = "rgba(255, 126, 42, 0.42)";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(48, 48, 29, 0, Math.PI * 2);
  context.stroke();
  return finalizeCanvasTexture(canvas, "LavaBubbleTexture");
}

function paintSoftBlob(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  innerColor: string,
  outerColor: string,
  scaleX: number,
  scaleY: number,
) {
  context.save();
  context.translate(x, y);
  context.scale(scaleX, scaleY);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.55, innerColor);
  gradient.addColorStop(1, outerColor);
  context.fillStyle = gradient;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  context.restore();
}

function finalizeCanvasTexture(canvas: HTMLCanvasElement, name: string): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create lava texture canvas context.");
  }

  return context;
}

function prepareBackdropRendering(root: THREE.Group) {
  root.renderOrder = BACKDROP_RENDER_ORDER;
  root.traverse((object) => {
    object.renderOrder = BACKDROP_RENDER_ORDER;
    object.castShadow = false;
    object.receiveShadow = false;

    if (object instanceof THREE.Sprite) {
      object.material.depthTest = true;
      return;
    }

    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments)) {
      return;
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.depthTest = true;
    });
  });
}

function updateLavaBursts(bursts: LavaBurst[], elapsed: number) {
  bursts.forEach((burst) => {
    const cycle = (elapsed * 0.62 + burst.phase * 0.137) % 1;
    const popProgress = cycle < 0.48 ? cycle / 0.48 : 1;
    const pulse = cycle < 0.48 ? Math.sin(popProgress * Math.PI) ** 1.35 : 0;
    const afterglow = Math.max(0, 1 - (cycle - 0.48) / 0.28);

    burst.bubbles.forEach((bubble, index) => {
      const offsetPhase = Number(bubble.userData.offsetPhase ?? 0);
      const localProgress = (popProgress + offsetPhase * 0.22) % 1;
      const localPulse = pulse * (0.62 + offsetPhase * 0.38);
      const size = 0.045 + localPulse * (0.11 + index * 0.008);
      const drift = Math.sin(elapsed * 1.3 + burst.phase + index) * 0.018;
      bubble.position.set(
        burst.basePosition.x + Number(bubble.userData.offsetX ?? 0) + drift,
        burst.basePosition.y + 0.08 + localProgress * 0.32,
        burst.basePosition.z + Number(bubble.userData.offsetZ ?? 0) - drift,
      );
      bubble.scale.setScalar(size);
      bubble.material.rotation = elapsed * 0.14 + burst.phase + index * 0.4;
      bubble.material.opacity = localPulse * 0.42 + afterglow * 0.045;
    });

    burst.ring.scale.setScalar(0.42 + pulse * 1.1 + afterglow * 0.35);
    burst.ring.material.opacity = pulse * 0.12 + afterglow * 0.035;
    burst.light.position.y = burst.basePosition.y + 0.38 + pulse * 0.34;
    burst.light.intensity = pulse * 3.4 + afterglow * 0.45;

    updateLavaDropletCluster(burst.droplets, popProgress, pulse, afterglow);
  });
}

function updateLavaDropletCluster(
  droplets: LavaDropletCluster,
  eruptionProgress: number,
  pulse: number,
  afterglow: number,
) {
  const spread = THREE.MathUtils.clamp(eruptionProgress, 0, 1);
  const gravity = 0.7 * spread * spread;

  for (let index = 0; index < DROPLETS_PER_BURST; index += 1) {
    const offset = index * 3;
    const wobble = Math.sin(spread * Math.PI * 2 + index) * 0.035;
    droplets.positions[offset] = droplets.basePositions[offset] + droplets.velocities[offset] * spread + wobble;
    droplets.positions[offset + 1] = droplets.basePositions[offset + 1] + droplets.velocities[offset + 1] * spread - gravity;
    droplets.positions[offset + 2] = droplets.basePositions[offset + 2] + droplets.velocities[offset + 2] * spread - wobble;
  }

  droplets.geometry.getAttribute("position").needsUpdate = true;
  droplets.material.opacity = pulse * 0.62 + afterglow * 0.08;
}

function updateEmberField(field: ParticleField, elapsed: number) {
  for (let index = 0; index < EMBER_COUNT; index += 1) {
    const offset = index * 3;
    const rise = elapsed * field.speeds[index];
    field.positions[offset] = field.basePositions[offset] + Math.sin(elapsed * 0.45 + index) * 0.22;
    field.positions[offset + 1] = -0.25 + ((field.basePositions[offset + 1] + rise + 0.25) % 5.8);
    field.positions[offset + 2] = field.basePositions[offset + 2] + Math.cos(elapsed * 0.34 + index * 0.7) * 0.18;
  }

  field.geometry.getAttribute("position").needsUpdate = true;
  field.material.opacity = 0.54 + Math.sin(elapsed * 1.2) * 0.08;
}

function disposeObjectTree(root: THREE.Object3D) {
  const disposedMaterials = new Set<THREE.Material>();
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedTextures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (object instanceof THREE.Sprite) {
      disposeMaterial(object.material, disposedMaterials, disposedTextures);
      return;
    }

    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments)) {
      return;
    }

    if (!disposedGeometries.has(object.geometry)) {
      object.geometry.dispose();
      disposedGeometries.add(object.geometry);
    }

    disposeMaterial(object.material, disposedMaterials, disposedTextures);
  });
}

function disposeMaterial(
  materialOrMaterials: THREE.Material | THREE.Material[],
  disposedMaterials: Set<THREE.Material>,
  disposedTextures: Set<THREE.Texture>,
) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
        value.dispose();
        disposedTextures.add(value);
      }
    });

    if (!disposedMaterials.has(material)) {
      material.dispose();
      disposedMaterials.add(material);
    }
  });
}

function deterministicNoise(seed: number, salt: number): number {
  const raw = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return raw - Math.floor(raw);
}
