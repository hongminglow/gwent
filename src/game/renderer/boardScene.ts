import * as THREE from "three";
import type { MatchPreviewState, PlayerId, RowId } from "../simulation/types";
import { createCardMesh } from "./cardMesh";

export type BoardAnchors = {
  rowZones: Record<PlayerId, Record<RowId, THREE.Group>>;
  scorePlates: Record<PlayerId, THREE.Group>;
  piles: Record<PlayerId, {
    deck: THREE.Group;
    discard: THREE.Group;
    leader: THREE.Group;
  }>;
  hands: Record<PlayerId, THREE.Group>;
};

export type BoardScene = {
  root: THREE.Group;
  anchors: BoardAnchors;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

const ROWS = ["close", "ranged", "siege"] as const;
const PLAYERS = ["opponent", "player"] as const;
const ROW_LABELS: Record<RowId, string> = {
  close: "Close",
  ranged: "Ranged",
  siege: "Siege",
};
const PLAYER_LABELS: Record<PlayerId, string> = {
  player: "Player",
  opponent: "Opponent",
};
const ROW_Z: Record<PlayerId, Record<RowId, number>> = {
  opponent: {
    siege: -5.35,
    ranged: -3.55,
    close: -1.75,
  },
  player: {
    close: 1.75,
    ranged: 3.55,
    siege: 5.35,
  },
};

export function createBoardScene(state: MatchPreviewState): BoardScene {
  const root = new THREE.Group();
  root.name = "OathboundBoardFoundation";
  const anchors = createEmptyAnchors();

  root.add(createTable());
  root.add(createPlaymat());
  root.add(createCenterLine());
  root.add(createBoardRails());

  const rowZoneMeshes: THREE.Mesh[] = [];

  for (const playerId of PLAYERS) {
    for (const rowId of ROWS) {
      const rowZone = createRowZone(playerId, rowId, ROW_Z[playerId][rowId]);
      rowZoneMeshes.push(rowZone.zoneMesh);
      anchors.rowZones[playerId][rowId] = rowZone.anchor;
      root.add(rowZone.group);
    }
  }

  for (const playerId of PLAYERS) {
    const pileGroup = createPileAnchors(playerId);
    anchors.piles[playerId] = pileGroup.anchors;
    root.add(pileGroup.root);

    const scorePlate = createScorePlate(playerId);
    anchors.scorePlates[playerId] = scorePlate.anchor;
    root.add(scorePlate.root);

    const handAnchor = createAnchor(`anchor:hand:${playerId}`, new THREE.Vector3(0, 0.26, playerId === "player" ? 7.55 : -7.55));
    anchors.hands[playerId] = handAnchor;
    root.add(handAnchor);
  }

  const previewCards = [
    createCardMesh({
      label: state.selectedFaction.name,
      accentColor: state.selectedFaction.accentColor,
      position: new THREE.Vector3(-2.45, 0.31, 6.55),
      rotationY: -0.08,
    }),
    createCardMesh({
      label: "Leader",
      accentColor: "#f0d290",
      faceColor: "#332416",
      position: new THREE.Vector3(-4.65, 0.31, 4.95),
      rotationY: 0.04,
    }),
    createCardMesh({
      label: "Rival",
      accentColor: state.opponentPool[0]?.accentColor ?? "#a7a7a7",
      position: new THREE.Vector3(2.85, 0.31, -6.55),
      rotationY: 0.12,
    }),
  ];

  for (const card of previewCards) {
    root.add(card.root);
  }

  const update = (deltaSeconds: number) => {
    const elapsed = performance.now() / 1000;

    for (const [index, card] of previewCards.entries()) {
      card.root.position.y = card.baseY + Math.sin(elapsed * 1.15 + index * 0.8) * 0.035;
      card.root.rotation.z = Math.sin(elapsed * 0.88 + index) * 0.012;
    }

    for (const zone of rowZoneMeshes) {
      const material = zone.material;

      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissiveIntensity = 0.08 + Math.sin(elapsed * 1.45 + zone.position.z) * 0.024;
      }
    }

    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, Math.sin(elapsed * 0.18) * 0.01, Math.min(deltaSeconds * 3, 1));
  };

  return {
    root,
    anchors,
    update,
    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });
    },
  };
}

function createTable(): THREE.Group {
  const group = new THREE.Group();
  group.name = "BoardTable";

  const tabletop = new THREE.Mesh(
    new THREE.BoxGeometry(14.4, 0.42, 17.2),
    new THREE.MeshStandardMaterial({
      color: "#2b1f16",
      roughness: 0.72,
      metalness: 0.08,
    }),
  );
  tabletop.name = "Tabletop";
  tabletop.position.y = -0.28;
  tabletop.receiveShadow = true;
  group.add(tabletop);

  const underglow = new THREE.Mesh(
    new THREE.BoxGeometry(13.4, 0.04, 16.2),
    new THREE.MeshStandardMaterial({
      color: "#5c3322",
      emissive: "#7a3a1c",
      emissiveIntensity: 0.18,
      roughness: 0.8,
      metalness: 0.04,
    }),
  );
  underglow.name = "TableUnderglow";
  underglow.position.y = -0.02;
  group.add(underglow);

  return group;
}

function createPlaymat(): THREE.Mesh {
  const playmat = new THREE.Mesh(
    new THREE.BoxGeometry(12.7, 0.07, 15.3),
    new THREE.MeshStandardMaterial({
      color: "#17110d",
      roughness: 0.88,
      metalness: 0.03,
    }),
  );
  playmat.name = "Playmat";
  playmat.position.y = 0.02;
  playmat.receiveShadow = true;
  return playmat;
}

function createCenterLine(): THREE.Mesh {
  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(12.15, 0.032, 0.04),
    new THREE.MeshStandardMaterial({
      color: "#a77b42",
      emissive: "#4a2c12",
      emissiveIntensity: 0.18,
    }),
  );
  centerLine.name = "CenterLine";
  centerLine.position.set(0, 0.09, 0);
  return centerLine;
}

function createBoardRails(): THREE.Group {
  const group = new THREE.Group();
  group.name = "BoardRails";
  const material = new THREE.MeshStandardMaterial({
    color: "#5b3a24",
    roughness: 0.62,
    metalness: 0.12,
  });
  const horizontalGeometry = new THREE.BoxGeometry(13.1, 0.16, 0.12);
  const verticalGeometry = new THREE.BoxGeometry(0.12, 0.16, 15.4);
  const top = new THREE.Mesh(horizontalGeometry, material);
  const bottom = new THREE.Mesh(horizontalGeometry.clone(), material);
  const left = new THREE.Mesh(verticalGeometry, material);
  const right = new THREE.Mesh(verticalGeometry.clone(), material);

  top.position.set(0, 0.14, -7.7);
  bottom.position.set(0, 0.14, 7.7);
  left.position.set(-6.55, 0.14, 0);
  right.position.set(6.55, 0.14, 0);
  group.add(top, bottom, left, right);
  return group;
}

function createRowZone(
  playerId: PlayerId,
  rowId: RowId,
  z: number,
): { group: THREE.Group; anchor: THREE.Group; zoneMesh: THREE.Mesh } {
  const group = new THREE.Group();
  group.name = `RowZone:${playerId}:${rowId}`;
  group.position.set(0, 0, z);

  const zoneMesh = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.04, 1.25),
    new THREE.MeshStandardMaterial({
      color: playerId === "player" ? "#1f2b2a" : "#2a1f20",
      emissive: playerId === "player" ? "#244c45" : "#532a2d",
      emissiveIntensity: 0.1,
      roughness: 0.82,
      metalness: 0.04,
      transparent: true,
      opacity: 0.92,
    }),
  );
  zoneMesh.name = "PlacementZoneSurface";
  zoneMesh.position.y = 0.12;
  zoneMesh.receiveShadow = true;
  group.add(zoneMesh);

  const border = createZoneBorder(playerId === "player" ? "#77d3bc" : "#d98484");
  border.position.y = 0.15;
  group.add(border);

  const rowLabel = createTextPlate(ROW_LABELS[rowId], playerId === "player" ? "#8ae0c8" : "#e39a9a", 1.15, 0.28);
  rowLabel.name = "RowLabel";
  rowLabel.position.set(-5.05, 0.18, 0);
  rowLabel.rotation.x = -Math.PI / 2;
  group.add(rowLabel);

  const anchor = createAnchor(`anchor:row:${playerId}:${rowId}`, new THREE.Vector3(0, 0.22, 0));
  group.add(anchor);

  return {
    group,
    anchor,
    zoneMesh,
  };
}

function createZoneBorder(color: string): THREE.Group {
  const group = new THREE.Group();
  group.name = "PlacementZoneBorder";
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
  });
  const horizontalGeometry = new THREE.BoxGeometry(11.5, 0.015, 0.018);
  const verticalGeometry = new THREE.BoxGeometry(0.018, 0.015, 1.25);
  const top = new THREE.Mesh(horizontalGeometry, material);
  const bottom = new THREE.Mesh(horizontalGeometry.clone(), material);
  const left = new THREE.Mesh(verticalGeometry, material);
  const right = new THREE.Mesh(verticalGeometry.clone(), material);

  top.position.z = -0.625;
  bottom.position.z = 0.625;
  left.position.x = -5.75;
  right.position.x = 5.75;
  group.add(top, bottom, left, right);
  return group;
}

function createPileAnchors(playerId: PlayerId): {
  root: THREE.Group;
  anchors: BoardAnchors["piles"][PlayerId];
} {
  const root = new THREE.Group();
  root.name = `PileAnchors:${playerId}`;
  const z = playerId === "player" ? 6.95 : -6.95;
  const deck = createPileAnchor(playerId, "deck", new THREE.Vector3(5.55, 0.26, z));
  const discard = createPileAnchor(playerId, "discard", new THREE.Vector3(3.8, 0.26, z));
  const leader = createPileAnchor(playerId, "leader", new THREE.Vector3(-5.55, 0.26, playerId === "player" ? 4.85 : -4.85));

  root.add(deck.root, discard.root, leader.root);

  return {
    root,
    anchors: {
      deck: deck.anchor,
      discard: discard.anchor,
      leader: leader.anchor,
    },
  };
}

function createPileAnchor(
  playerId: PlayerId,
  pile: "deck" | "discard" | "leader",
  position: THREE.Vector3,
): { root: THREE.Group; anchor: THREE.Group } {
  const root = new THREE.Group();
  root.name = `PileAnchor:${playerId}:${pile}`;
  root.position.copy(position);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.045, 2.1),
    new THREE.MeshStandardMaterial({
      color: pile === "leader" ? "#332416" : "#1d1711",
      emissive: pile === "leader" ? "#5a3c18" : "#17110d",
      emissiveIntensity: pile === "leader" ? 0.14 : 0.05,
      roughness: 0.82,
      metalness: 0.05,
    }),
  );
  base.name = "PilePlate";
  base.receiveShadow = true;
  root.add(base);

  const label = createTextPlate(pile.toUpperCase(), "#f1d39a", 1.1, 0.23);
  label.position.set(0, 0.05, 0);
  label.rotation.x = -Math.PI / 2;
  root.add(label);

  const anchor = createAnchor(`anchor:pile:${playerId}:${pile}`, new THREE.Vector3(0, 0.12, 0));
  root.add(anchor);

  return {
    root,
    anchor,
  };
}

function createScorePlate(playerId: PlayerId): { root: THREE.Group; anchor: THREE.Group } {
  const root = new THREE.Group();
  root.name = `ScorePlate:${playerId}`;
  root.position.set(-6.05, 0.24, playerId === "player" ? 2.35 : -2.35);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.08, 1.2),
    new THREE.MeshStandardMaterial({
      color: "#251b14",
      emissive: "#473018",
      emissiveIntensity: 0.16,
      roughness: 0.66,
      metalness: 0.16,
    }),
  );
  base.name = "ScorePlateBase";
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const label = createTextPlate(`${PLAYER_LABELS[playerId]} 0`, "#f7efe1", 1.08, 0.32);
  label.position.set(0, 0.052, 0);
  label.rotation.x = -Math.PI / 2;
  root.add(label);

  const anchor = createAnchor(`anchor:score:${playerId}`, new THREE.Vector3(0, 0.12, 0));
  root.add(anchor);

  return {
    root,
    anchor,
  };
}

function createTextPlate(text: string, color: string, width: number, height: number): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create text plate canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(9, 7, 5, 0.76)";
  roundedRect(context, 18, 28, 476, 104, 18);
  context.fill();
  context.strokeStyle = "rgba(247, 239, 225, 0.22)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = color;
  context.font = "700 40px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2, 438);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    }),
  );
  mesh.name = `TextPlate:${text}`;
  return mesh;
}

function createAnchor(name: string, position: THREE.Vector3): THREE.Group {
  const anchor = new THREE.Group();
  anchor.name = name;
  anchor.position.copy(position);
  return anchor;
}

function createEmptyAnchors(): BoardAnchors {
  return {
    rowZones: {
      player: {
        close: new THREE.Group(),
        ranged: new THREE.Group(),
        siege: new THREE.Group(),
      },
      opponent: {
        close: new THREE.Group(),
        ranged: new THREE.Group(),
        siege: new THREE.Group(),
      },
    },
    scorePlates: {
      player: new THREE.Group(),
      opponent: new THREE.Group(),
    },
    piles: {
      player: {
        deck: new THREE.Group(),
        discard: new THREE.Group(),
        leader: new THREE.Group(),
      },
      opponent: {
        deck: new THREE.Group(),
        discard: new THREE.Group(),
        leader: new THREE.Group(),
      },
    },
    hands: {
      player: new THREE.Group(),
      opponent: new THREE.Group(),
    },
  };
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }

  const maybeTextured = material as THREE.Material & {
    map?: THREE.Texture;
  };
  maybeTextured.map?.dispose();
  material.dispose();
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
