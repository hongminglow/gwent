import * as THREE from "three";
import type { GameAction } from "../simulation/actions";
import type { CardInstanceId, MatchState, PlayerId, RowId } from "../simulation/types";
import type { BoardScene, RowInteractionTarget } from "./boardScene";
import type { CardInspection, SimulationRenderer } from "./simulationBridge";

export type InteractionAudioCue = {
  cardInstanceId: CardInstanceId;
  cue: "card.hover";
};

export type CardInteractionHudState = {
  feedback?: string;
  inspection?: CardInspection;
  selectedCardId?: CardInstanceId;
  validRows: RowInteractionTarget[];
};

export type CardInteractionController = {
  dispose: () => void;
  refresh: () => void;
};

export type CardInteractionControllerOptions = {
  board: BoardScene;
  camera: THREE.Camera;
  domElement: HTMLElement;
  getState: () => MatchState;
  isInputBlocked: () => boolean;
  onAudioCue?: (cue: InteractionAudioCue) => void;
  onInteractionChange: (state: CardInteractionHudState) => void;
  onIntent: (action: GameAction) => void;
  simulationRenderer: SimulationRenderer;
};

type PointerDownState = {
  cardInstanceId?: CardInstanceId;
  clientX: number;
  clientY: number;
};

const DRAG_THRESHOLD_PX = 7;
const ROWS = ["close", "ranged", "siege"] as const;

export function createCardInteractionController(
  options: CardInteractionControllerOptions,
): CardInteractionController {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
  let hoveredCardId: CardInstanceId | undefined;
  let selectedCardId: CardInstanceId | undefined;
  let draggedCardId: CardInstanceId | undefined;
  let hoveredRow: RowInteractionTarget | undefined;
  let rejectedCardId: CardInstanceId | undefined;
  let rejectedRow: RowInteractionTarget | undefined;
  let pointerDownState: PointerDownState | undefined;
  let feedback: string | undefined;
  let rejectTimeoutId: number | undefined;

  const syncVisualState = () => {
    const state = options.getState();
    const validRows = selectedCardId ? getValidRowTargets(state, selectedCardId) : [];
    options.board.setRowHighlights({
      validRows,
      hoveredRow,
      rejectedRow,
    });
    options.simulationRenderer.setInteractionState({
      hoveredCardId,
      selectedCardId,
      draggedCardId,
      rejectedCardId,
      dragPreviewPosition: getDragPreviewPosition(),
    });
    options.onInteractionChange({
      feedback,
      inspection: getInspection(options.simulationRenderer, selectedCardId ?? hoveredCardId),
      selectedCardId,
      validRows,
    });
    options.domElement.style.cursor = getCursor(state, {
      hoveredCardId,
      selectedCardId,
      draggedCardId,
      hoveredRow,
      validRows,
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    if (options.isInputBlocked()) {
      clearHover();
      syncVisualState();
      return;
    }

    updateRaycaster(event, options.domElement, pointer, raycaster, options.camera);

    if (pointerDownState?.cardInstanceId && !draggedCardId) {
      const distance = Math.hypot(event.clientX - pointerDownState.clientX, event.clientY - pointerDownState.clientY);

      if (distance >= DRAG_THRESHOLD_PX) {
        draggedCardId = pointerDownState.cardInstanceId;
        selectedCardId = pointerDownState.cardInstanceId;
      }
    }

    if (draggedCardId) {
      hoveredCardId = draggedCardId;
      hoveredRow = pickRow(options.board, raycaster);
      syncVisualState();
      return;
    }

    setHoveredCardId(pickCard(options.simulationRenderer, raycaster));
    hoveredRow = selectedCardId ? pickRow(options.board, raycaster) : undefined;
    syncVisualState();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || options.isInputBlocked()) {
      return;
    }

    updateRaycaster(event, options.domElement, pointer, raycaster, options.camera);
    const cardInstanceId = pickCard(options.simulationRenderer, raycaster);
    pointerDownState = {
      cardInstanceId,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (cardInstanceId) {
      selectedCardId = cardInstanceId;
      setHoveredCardId(cardInstanceId, false);
      clearRejection();
      syncVisualState();
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0 || options.isInputBlocked()) {
      clearDrag();
      syncVisualState();
      return;
    }

    updateRaycaster(event, options.domElement, pointer, raycaster, options.camera);
    const rowTarget = pickRow(options.board, raycaster);
    const cardInstanceId = pickCard(options.simulationRenderer, raycaster);
    const selectedId = draggedCardId ?? selectedCardId;

    if (selectedId && rowTarget) {
      commitRowTarget(selectedId, rowTarget);
      clearDrag();
      syncVisualState();
      return;
    }

    if (cardInstanceId) {
      const immediateAction = createImmediateAction(options.getState(), cardInstanceId);

      if (selectedCardId === cardInstanceId && immediateAction) {
        options.onIntent(immediateAction);
        clearSelection();
      } else {
        selectedCardId = cardInstanceId;
        setHoveredCardId(cardInstanceId, false);
      }

      clearDrag();
      syncVisualState();
      return;
    }

    if (selectedId && rowTarget) {
      commitRowTarget(selectedId, rowTarget);
    } else {
      clearSelection();
    }

    clearDrag();
    syncVisualState();
  };

  const onPointerLeave = () => {
    clearHover();
    clearDrag();
    syncVisualState();
  };

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    clearSelection();
    clearDrag();
    syncVisualState();
  };

  const commitRowTarget = (cardInstanceId: CardInstanceId, rowTarget: RowInteractionTarget) => {
    const state = options.getState();
    const action = createRowTargetAction(state, cardInstanceId, rowTarget);

    if (!action) {
      rejectInteraction(cardInstanceId, rowTarget, "That card cannot be played there.");
      return;
    }

    try {
      options.onIntent(action);
      clearSelection();
    } catch {
      rejectInteraction(cardInstanceId, rowTarget, "The match rejected that move.");
    }
  };

  const rejectInteraction = (
    cardInstanceId: CardInstanceId,
    rowTarget: RowInteractionTarget,
    message: string,
  ) => {
    clearRejection();
    rejectedCardId = cardInstanceId;
    rejectedRow = rowTarget;
    feedback = message;
    rejectTimeoutId = window.setTimeout(() => {
      clearRejection();
      syncVisualState();
    }, 850);
  };

  const clearRejection = () => {
    if (rejectTimeoutId !== undefined) {
      window.clearTimeout(rejectTimeoutId);
      rejectTimeoutId = undefined;
    }

    rejectedCardId = undefined;
    rejectedRow = undefined;
    feedback = undefined;
  };

  const clearHover = () => {
    hoveredCardId = undefined;
    hoveredRow = undefined;
  };

  const setHoveredCardId = (cardInstanceId: CardInstanceId | undefined, audible = true) => {
    if (audible && cardInstanceId && cardInstanceId !== hoveredCardId) {
      options.onAudioCue?.({
        cardInstanceId,
        cue: "card.hover",
      });
    }

    hoveredCardId = cardInstanceId;
  };

  const clearSelection = () => {
    selectedCardId = undefined;
  };

  const clearDrag = () => {
    draggedCardId = undefined;
    pointerDownState = undefined;
  };

  const getDragPreviewPosition = (): THREE.Vector3 | undefined => {
    if (!draggedCardId) {
      return undefined;
    }

    const worldPoint = new THREE.Vector3();

    if (!raycaster.ray.intersectPlane(dragPlane, worldPoint)) {
      return undefined;
    }

    return options.board.root.worldToLocal(worldPoint.clone());
  };

  options.domElement.addEventListener("pointermove", onPointerMove);
  options.domElement.addEventListener("pointerdown", onPointerDown);
  options.domElement.addEventListener("pointerup", onPointerUp);
  options.domElement.addEventListener("pointerleave", onPointerLeave);
  options.domElement.addEventListener("contextmenu", onContextMenu);
  syncVisualState();

  return {
    refresh() {
      syncVisualState();
    },
    dispose() {
      clearRejection();
      options.domElement.style.cursor = "";
      options.domElement.removeEventListener("pointermove", onPointerMove);
      options.domElement.removeEventListener("pointerdown", onPointerDown);
      options.domElement.removeEventListener("pointerup", onPointerUp);
      options.domElement.removeEventListener("pointerleave", onPointerLeave);
      options.domElement.removeEventListener("contextmenu", onContextMenu);
    },
  };
}

export function getValidRowTargets(
  state: MatchState,
  cardInstanceId: CardInstanceId,
): RowInteractionTarget[] {
  if (state.phase !== "playing") {
    return [];
  }

  const card = state.cards[cardInstanceId];

  if (!card) {
    return [];
  }

  const activePlayerId = state.round.activePlayerId;
  const definition = state.cardDefinitions[card.definitionId];

  if (card.zone === "leader" && card.ownerId === activePlayerId && !state.players[activePlayerId].leaderUsed) {
    if (definition.tags.includes("leader:draw-extra-card")) {
      return [];
    }

    if (definition.abilities.includes("weather")) {
      return rowTargetsForRows(definition.rows.length > 0 ? definition.rows : [...ROWS]);
    }
  }

  if (card.zone !== "hand" || card.ownerId !== activePlayerId) {
    return [];
  }

  if (definition.type === "special") {
    if (definition.abilities.includes("commanders-horn")) {
      return ROWS.filter((rowId) => !state.board.rows[activePlayerId][rowId].hornActive).map((rowId) => ({
        playerId: activePlayerId,
        rowId,
      }));
    }

    if (definition.abilities.includes("weather")) {
      return rowTargetsForRows(definition.rows.length > 0 ? definition.rows : [...ROWS]);
    }

    return [];
  }

  const targetPlayerId = definition.abilities.includes("spy")
    ? getOpponentId(activePlayerId)
    : activePlayerId;

  return definition.rows.map((rowId) => ({
    playerId: targetPlayerId,
    rowId,
  }));
}

export function createRowTargetAction(
  state: MatchState,
  cardInstanceId: CardInstanceId,
  rowTarget: RowInteractionTarget,
): GameAction | undefined {
  const validRows = getValidRowTargets(state, cardInstanceId);

  if (!validRows.some((validRow) => sameRow(validRow, rowTarget))) {
    return undefined;
  }

  const card = state.cards[cardInstanceId];

  if (!card) {
    return undefined;
  }

  if (card.zone === "leader") {
    return {
      type: "use-leader",
      playerId: state.round.activePlayerId,
      rowId: rowTarget.rowId,
    };
  }

  return {
    type: "play-card",
    playerId: state.round.activePlayerId,
    cardInstanceId,
    rowId: rowTarget.rowId,
  };
}

export function createImmediateAction(
  state: MatchState,
  cardInstanceId: CardInstanceId,
): GameAction | undefined {
  if (state.phase !== "playing") {
    return undefined;
  }

  const card = state.cards[cardInstanceId];

  if (!card) {
    return undefined;
  }

  const definition = state.cardDefinitions[card.definitionId];

  if (card.zone === "leader" && card.ownerId === state.round.activePlayerId && !state.players[card.ownerId].leaderUsed) {
    if (definition.tags.includes("leader:draw-extra-card") || definition.rows.length > 0) {
      return {
        type: "use-leader",
        playerId: state.round.activePlayerId,
      };
    }
  }

  if (card.zone !== "hand" || card.ownerId !== state.round.activePlayerId || definition.type !== "special") {
    return undefined;
  }

  if (definition.abilities.includes("scorch") || definition.abilities.includes("clear-weather")) {
    return {
      type: "play-card",
      playerId: state.round.activePlayerId,
      cardInstanceId,
    };
  }

  return undefined;
}

function updateRaycaster(
  event: PointerEvent,
  domElement: HTMLElement,
  pointer: THREE.Vector2,
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
) {
  const rect = domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
}

function pickCard(
  simulationRenderer: SimulationRenderer,
  raycaster: THREE.Raycaster,
): CardInstanceId | undefined {
  const intersection = raycaster.intersectObjects(simulationRenderer.getInteractiveCardObjects(), true)
    .find((hit) => simulationRenderer.getCardInstanceIdFromObject(hit.object));

  return intersection
    ? simulationRenderer.getCardInstanceIdFromObject(intersection.object)
    : undefined;
}

function pickRow(
  board: BoardScene,
  raycaster: THREE.Raycaster,
): RowInteractionTarget | undefined {
  const intersection = raycaster.intersectObjects(board.getInteractiveRowObjects(), false)[0];

  if (!intersection) {
    return undefined;
  }

  const playerId = intersection.object.userData.playerId;
  const rowId = intersection.object.userData.rowId;

  if (isPlayerId(playerId) && isRowId(rowId)) {
    return {
      playerId,
      rowId,
    };
  }

  return undefined;
}

function getInspection(
  simulationRenderer: SimulationRenderer,
  cardInstanceId?: CardInstanceId,
): CardInspection | undefined {
  return cardInstanceId ? simulationRenderer.getCardInspection(cardInstanceId) : undefined;
}

function getCursor(
  state: MatchState,
  options: {
    hoveredCardId?: CardInstanceId;
    selectedCardId?: CardInstanceId;
    draggedCardId?: CardInstanceId;
    hoveredRow?: RowInteractionTarget;
    validRows: RowInteractionTarget[];
  },
): string {
  if (options.draggedCardId) {
    return "grabbing";
  }

  const hoveredRow = options.hoveredRow;

  if (options.selectedCardId && hoveredRow) {
    return options.validRows.some((row) => sameRow(row, hoveredRow)) ? "copy" : "not-allowed";
  }

  if (options.hoveredCardId && isSelectableCard(state, options.hoveredCardId)) {
    return "grab";
  }

  return "";
}

function isSelectableCard(state: MatchState, cardInstanceId: CardInstanceId): boolean {
  const card = state.cards[cardInstanceId];

  if (!card || state.phase !== "playing") {
    return false;
  }

  return (card.zone === "hand" || card.zone === "leader") && card.ownerId === state.round.activePlayerId;
}

function rowTargetsForRows(rows: RowId[]): RowInteractionTarget[] {
  return rows.flatMap((rowId) => [
    {
      playerId: "player" as const,
      rowId,
    },
    {
      playerId: "opponent" as const,
      rowId,
    },
  ]);
}

function sameRow(a: RowInteractionTarget, b: RowInteractionTarget): boolean {
  return a.playerId === b.playerId && a.rowId === b.rowId;
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "player" ? "opponent" : "player";
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "player" || value === "opponent";
}

function isRowId(value: unknown): value is RowId {
  return value === "close" || value === "ranged" || value === "siege";
}
