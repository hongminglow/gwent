import * as THREE from "three";
import type { MatchPreviewState, RowId } from "../simulation/types";
import { createCardMesh } from "./cardMesh";

export type BoardScene = {
  root: THREE.Group;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

const ROW_LABELS: Record<RowId, string> = {
  close: "Close",
  ranged: "Ranged",
  siege: "Siege",
};

export function createBoardScene(state: MatchPreviewState): BoardScene {
  const root = new THREE.Group();
  root.name = "OathboundPreviewBoard";

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(13.6, 0.35, 16),
    new THREE.MeshStandardMaterial({
      color: "#2b1f16",
      roughness: 0.72,
      metalness: 0.08,
    }),
  );
  table.position.y = -0.24;
  table.receiveShadow = true;
  root.add(table);

  const playmat = new THREE.Mesh(
    new THREE.BoxGeometry(12.4, 0.06, 14.6),
    new THREE.MeshStandardMaterial({
      color: "#17110d",
      roughness: 0.88,
      metalness: 0.03,
    }),
  );
  playmat.position.y = 0;
  playmat.receiveShadow = true;
  root.add(playmat);

  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(12.1, 0.028, 0.035),
    new THREE.MeshStandardMaterial({
      color: "#a77b42",
      emissive: "#4a2c12",
      emissiveIntensity: 0.18,
    }),
  );
  centerLine.position.set(0, 0.05, 0);
  root.add(centerLine);

  const rowMeshes: THREE.Mesh[] = [];
  const rowZBySide = {
    opponent: [-5.05, -3.32, -1.59],
    player: [1.59, 3.32, 5.05],
  };

  for (const side of ["opponent", "player"] as const) {
    state.rows.forEach((row, index) => {
      const zone = createRowZone(side, row, rowZBySide[side][index]);
      rowMeshes.push(zone);
      root.add(zone);
    });
  }

  const previewCards = [
    createCardMesh({
      label: state.selectedFaction.name,
      accentColor: state.selectedFaction.accentColor,
      position: new THREE.Vector3(-3.2, 0.24, 4.95),
      rotationY: -0.08,
    }),
    createCardMesh({
      label: "Leader",
      accentColor: "#f0d290",
      position: new THREE.Vector3(0, 0.25, 3.26),
      rotationY: 0.02,
    }),
    createCardMesh({
      label: "Opponent",
      accentColor: state.opponentPool[0]?.accentColor ?? "#a7a7a7",
      position: new THREE.Vector3(3.15, 0.24, -4.95),
      rotationY: 0.12,
    }),
  ];

  for (const card of previewCards) {
    root.add(card.root);
  }

  const update = (deltaSeconds: number) => {
    const elapsed = performance.now() / 1000;
    for (const [index, card] of previewCards.entries()) {
      card.root.position.y = card.baseY + Math.sin(elapsed * 1.2 + index * 0.8) * 0.035;
      card.root.rotation.z = Math.sin(elapsed * 0.9 + index) * 0.012;
    }

    for (const zone of rowMeshes) {
      const material = zone.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissiveIntensity = 0.09 + Math.sin(elapsed * 1.5 + zone.position.z) * 0.025;
      }
    }

    root.rotation.y = Math.sin(elapsed * 0.24) * 0.012 * Math.min(deltaSeconds * 60, 1.2);
  };

  return {
    root,
    update,
    dispose() {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();

          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    },
  };
}

function createRowZone(side: "opponent" | "player", row: RowId, z: number): THREE.Mesh {
  const zone = new THREE.Mesh(
    new THREE.BoxGeometry(11.55, 0.035, 1.24),
    new THREE.MeshStandardMaterial({
      color: side === "player" ? "#1f2b2a" : "#2a1f20",
      emissive: side === "player" ? "#244c45" : "#532a2d",
      emissiveIntensity: 0.1,
      roughness: 0.82,
      metalness: 0.04,
      transparent: true,
      opacity: 0.92,
    }),
  );
  zone.name = `${side}-${ROW_LABELS[row]}Row`;
  zone.position.set(0, 0.08, z);
  zone.receiveShadow = true;
  return zone;
}
