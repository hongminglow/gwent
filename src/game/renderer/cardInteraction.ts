import * as THREE from "three";
import type { GameAction } from "../simulation/actions";
import type { CardDefinition, CardInstanceId, MatchState, PlayerId, RowId } from "../simulation/types";
import type { BoardScene, RowInteractionTarget } from "./boardScene";
import type { CardInspection, SimulationRenderer } from "./simulationBridge";

export type InteractionAudioCue = {
  cardInstanceId: CardInstanceId;
  cue: "card.hover";
};

export type CardInteractionHudState = {
  blockedCardTargets: CardInstanceId[];
  feedback?: string;
  inspection?: CardInspection;
  pointer?: {
    x: number;
    y: number;
  };
  selectedCardId?: CardInstanceId;
  validCardTargets: CardInstanceId[];
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
  let pointerPosition: CardInteractionHudState["pointer"];
  let pointerDownState: PointerDownState | undefined;
  let feedback: string | undefined;
  let rejectTimeoutId: number | undefined;

  const syncVisualState = () => {
    const state = options.getState();
    const validRows = selectedCardId ? getValidRowTargets(state, selectedCardId) : [];
    const validCardTargets = selectedCardId ? getValidCardTargets(state, selectedCardId) : [];
    const blockedCardTargets = selectedCardId
      ? getBlockedCardTargets(state, selectedCardId, validCardTargets)
      : [];
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
      validTargetCardIds: validCardTargets,
      blockedTargetCardIds: blockedCardTargets,
    });
    options.onInteractionChange({
      blockedCardTargets,
      feedback,
      inspection: getInspection(options.simulationRenderer, state, hoveredCardId ?? selectedCardId),
      pointer: pointerPosition,
      selectedCardId,
      validCardTargets,
      validRows,
    });
    options.domElement.style.cursor = getCursor(state, {
      hoveredCardId,
      selectedCardId,
      draggedCardId,
      hoveredRow,
      validCardTargets,
      validRows,
    });
  };

  const onPointerMove = (event: PointerEvent) => {
    pointerPosition = {
      x: event.clientX,
      y: event.clientY,
    };

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

    setHoveredCardId(getPublicCardId(options.getState(), pickCard(options.simulationRenderer, raycaster)));
    hoveredRow = selectedCardId ? pickRow(options.board, raycaster) : undefined;
    syncVisualState();
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || options.isInputBlocked()) {
      return;
    }

    pointerPosition = {
      x: event.clientX,
      y: event.clientY,
    };
    updateRaycaster(event, options.domElement, pointer, raycaster, options.camera);
    const state = options.getState();
    const cardInstanceId = getPublicCardId(state, pickCard(options.simulationRenderer, raycaster));
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
    pointerPosition = {
      x: event.clientX,
      y: event.clientY,
    };

    if (event.button !== 0 || options.isInputBlocked()) {
      clearDrag();
      syncVisualState();
      return;
    }

    updateRaycaster(event, options.domElement, pointer, raycaster, options.camera);
    const rowTarget = pickRow(options.board, raycaster);
    const state = options.getState();
    const cardInstanceId = getPublicCardId(state, pickCard(options.simulationRenderer, raycaster));
    const selectedId = draggedCardId ?? selectedCardId;

    if (selectedId && cardInstanceId && selectedId !== cardInstanceId && isCardTargetSelectionMode(state, selectedId)) {
      commitCardTarget(selectedId, cardInstanceId);
      clearDrag();
      syncVisualState();
      return;
    }

    if (selectedId && rowTarget) {
      commitRowTarget(selectedId, rowTarget);
      clearDrag();
      syncVisualState();
      return;
    }

    if (cardInstanceId) {
      const immediateAction = createImmediateAction(state, cardInstanceId);

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
    pointerPosition = undefined;
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
      rejectInteraction(cardInstanceId, rowTarget, getPlacementRejectionReason(state, cardInstanceId, rowTarget));
      return;
    }

    try {
      options.onIntent(action);
      clearSelection();
    } catch (error) {
      rejectInteraction(cardInstanceId, rowTarget, error instanceof Error
        ? error.message
        : "The match rejected that move.");
    }
  };

  const commitCardTarget = (cardInstanceId: CardInstanceId, targetCardInstanceId: CardInstanceId) => {
    const state = options.getState();
    const action = createCardTargetAction(state, cardInstanceId, targetCardInstanceId);

    if (!action) {
      rejectCardTarget(targetCardInstanceId, getCardTargetRejectionReason(state, cardInstanceId, targetCardInstanceId));
      return;
    }

    try {
      options.onIntent(action);
      clearSelection();
    } catch (error) {
      rejectCardTarget(targetCardInstanceId, error instanceof Error
        ? error.message
        : "The match rejected that target.");
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

  const rejectCardTarget = (
    cardInstanceId: CardInstanceId,
    message: string,
  ) => {
    clearRejection();
    rejectedCardId = cardInstanceId;
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

export function getValidCardTargets(
  state: MatchState,
  cardInstanceId: CardInstanceId,
): CardInstanceId[] {
  if (!isCardTargetSelectionMode(state, cardInstanceId)) {
    return [];
  }

  const activePlayerId = state.round.activePlayerId;
  const definition = getDefinition(state, cardInstanceId);

  if (definition.abilities.includes("decoy")) {
    return getBattlefieldCards(state, activePlayerId).filter((targetCardInstanceId) => {
      const targetDefinition = getDefinition(state, targetCardInstanceId);
      return !isHeroDefinition(targetDefinition);
    });
  }

  return [];
}

export function createCardTargetAction(
  state: MatchState,
  cardInstanceId: CardInstanceId,
  targetCardInstanceId: CardInstanceId,
): GameAction | undefined {
  if (!getValidCardTargets(state, cardInstanceId).includes(targetCardInstanceId)) {
    return undefined;
  }

  return {
    type: "play-card",
    playerId: state.round.activePlayerId,
    cardInstanceId,
    targetCardInstanceId,
  };
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

  const definition = state.cardDefinitions[card.definitionId];

  const targetCardInstanceId = definition.abilities.includes("medic")
    ? getDefaultMedicTarget(state, state.round.activePlayerId)
    : undefined;
  const action: GameAction = {
    type: "play-card",
    playerId: state.round.activePlayerId,
    cardInstanceId,
    rowId: rowTarget.rowId,
  };

  return targetCardInstanceId
    ? {
        ...action,
        targetCardInstanceId,
      }
    : action;
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

export function getPlacementRejectionReason(
  state: MatchState,
  cardInstanceId: CardInstanceId,
  rowTarget: RowInteractionTarget,
): string {
  if (state.phase !== "playing") {
    return "Cards can be placed only after both redraws are finished.";
  }

  const card = state.cards[cardInstanceId];

  if (!card) {
    return "That card is no longer in the match.";
  }

  const activePlayerId = state.round.activePlayerId;
  const definition = state.cardDefinitions[card.definitionId];

  if (card.ownerId !== activePlayerId) {
    return `It is ${formatPlayer(activePlayerId)}'s turn. ${formatPlayer(card.ownerId)} cards cannot be placed now.`;
  }

  if (card.zone === "leader") {
    if (state.players[activePlayerId].leaderUsed) {
      return "That leader ability has already been used this match.";
    }

    if (definition.abilities.includes("weather")) {
      return `${definition.name} targets ${formatRows(definition.rows.length > 0 ? definition.rows : [...ROWS])}.`;
    }

    return `${definition.name} does not use a row target.`;
  }

  if (card.zone !== "hand") {
    return `${definition.name} is in ${card.zone}; only cards in hand can be placed.`;
  }

  if (definition.type === "special") {
    return getSpecialPlacementRejectionReason(state, activePlayerId, definition, rowTarget);
  }

  const targetPlayerId = definition.abilities.includes("spy")
    ? getOpponentId(activePlayerId)
    : activePlayerId;
  const legalRows = formatRows(definition.rows);

  if (rowTarget.playerId !== targetPlayerId) {
    return definition.abilities.includes("spy")
      ? `Spy cards must be placed on the opponent's ${legalRows} row, then they draw cards for you.`
      : `${definition.name} must be placed on your ${legalRows} row.`;
  }

  if (!definition.rows.includes(rowTarget.rowId)) {
    return definition.abilities.includes("agile")
      ? `${definition.name} is Agile: choose Close or Ranged, not ${formatRow(rowTarget.rowId)}.`
      : `${definition.name} is a ${legalRows} card and cannot be placed on ${formatRow(rowTarget.rowId)}.`;
  }

  return `${definition.name} cannot be placed on that row.`;
}

function getSpecialPlacementRejectionReason(
  state: MatchState,
  activePlayerId: PlayerId,
  definition: CardDefinition,
  rowTarget: RowInteractionTarget,
): string {
  if (definition.abilities.includes("scorch") || definition.abilities.includes("clear-weather")) {
    return `${definition.name} resolves without a row. Click the selected card again to play it.`;
  }

  if (definition.abilities.includes("decoy")) {
    return "Decoy needs one of your non-hero battlefield units as a target, not an empty row.";
  }

  if (definition.abilities.includes("commanders-horn")) {
    if (rowTarget.playerId !== activePlayerId) {
      return "Commander's Horn can buff only one of your own rows.";
    }

    if (state.board.rows[activePlayerId][rowTarget.rowId].hornActive) {
      return `Commander's Horn is already active on your ${formatRow(rowTarget.rowId)} row.`;
    }

    return "Commander's Horn must be placed on one of your rows.";
  }

  if (definition.abilities.includes("weather")) {
    const affectedRows = definition.rows.length > 0 ? definition.rows : [...ROWS];

    if (!affectedRows.includes(rowTarget.rowId)) {
      return `${definition.name} affects ${formatRows(affectedRows)}, not ${formatRow(rowTarget.rowId)}.`;
    }
  }

  return `${definition.name} does not use that row target.`;
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
  state: MatchState,
  cardInstanceId?: CardInstanceId,
): CardInspection | undefined {
  return cardInstanceId && !isPrivateCard(state, cardInstanceId)
    ? simulationRenderer.getCardInspection(cardInstanceId)
    : undefined;
}

function getPublicCardId(state: MatchState, cardInstanceId?: CardInstanceId): CardInstanceId | undefined {
  return cardInstanceId && !isPrivateCard(state, cardInstanceId) ? cardInstanceId : undefined;
}

function getCursor(
  state: MatchState,
  options: {
    hoveredCardId?: CardInstanceId;
    selectedCardId?: CardInstanceId;
    draggedCardId?: CardInstanceId;
    hoveredRow?: RowInteractionTarget;
    validCardTargets: CardInstanceId[];
    validRows: RowInteractionTarget[];
  },
): string {
  if (options.draggedCardId) {
    return "grabbing";
  }

  if (
    options.selectedCardId
    && options.hoveredCardId
    && options.hoveredCardId !== options.selectedCardId
    && isCardTargetSelectionMode(state, options.selectedCardId)
  ) {
    return options.validCardTargets.includes(options.hoveredCardId) ? "copy" : "not-allowed";
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

function isPrivateCard(state: MatchState, cardInstanceId: CardInstanceId): boolean {
  const card = state.cards[cardInstanceId];

  if (!card) {
    return true;
  }

  return card.ownerId === "opponent" && (card.zone === "hand" || card.zone === "deck");
}

function getDefaultMedicTarget(
  state: MatchState,
  playerId: PlayerId,
): CardInstanceId | undefined {
  return state.players[playerId].discard.cards
    .filter((cardInstanceId) => {
      const definition = state.cardDefinitions[state.cards[cardInstanceId].definitionId];
      return definition.type === "unit" && !definition.abilities.includes("hero");
    })
    .sort((firstId, secondId) => {
      const first = state.cardDefinitions[state.cards[firstId].definitionId];
      const second = state.cardDefinitions[state.cards[secondId].definitionId];

      return second.basePower - first.basePower;
    })[0];
}

function getBlockedCardTargets(
  state: MatchState,
  cardInstanceId: CardInstanceId,
  validCardTargets: CardInstanceId[],
): CardInstanceId[] {
  if (!isCardTargetSelectionMode(state, cardInstanceId)) {
    return [];
  }

  const activePlayerId = state.round.activePlayerId;
  const validTargetSet = new Set(validCardTargets);
  return getBattlefieldCards(state, activePlayerId).filter((targetCardInstanceId) =>
    !validTargetSet.has(targetCardInstanceId),
  );
}

function getCardTargetRejectionReason(
  state: MatchState,
  cardInstanceId: CardInstanceId,
  targetCardInstanceId: CardInstanceId,
): string {
  const definition = getDefinition(state, cardInstanceId);
  const targetCard = state.cards[targetCardInstanceId];

  if (definition.abilities.includes("decoy")) {
    if (!targetCard || targetCard.zone !== "board" || targetCard.controllerId !== state.round.activePlayerId) {
      return "Decoy targets only your battlefield units.";
    }

    if (isHeroDefinition(getDefinition(state, targetCardInstanceId))) {
      return "Decoy cannot target hero cards.";
    }
  }

  return `${definition.name} cannot target that card.`;
}

function isCardTargetSelectionMode(state: MatchState, cardInstanceId: CardInstanceId): boolean {
  if (state.phase !== "playing") {
    return false;
  }

  const card = state.cards[cardInstanceId];

  if (!card || card.zone !== "hand" || card.ownerId !== state.round.activePlayerId) {
    return false;
  }

  const definition = getDefinition(state, cardInstanceId);
  return definition.abilities.includes("decoy");
}

function getBattlefieldCards(state: MatchState, playerId: PlayerId): CardInstanceId[] {
  return ROWS.flatMap((rowId) => state.board.rows[playerId][rowId].cards);
}

function getDefinition(state: MatchState, cardInstanceId: CardInstanceId): CardDefinition {
  return state.cardDefinitions[state.cards[cardInstanceId].definitionId];
}

function isHeroDefinition(definition: CardDefinition): boolean {
  return definition.type === "hero" || definition.abilities.includes("hero");
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

function formatPlayer(playerId: PlayerId): string {
  return playerId === "player" ? "Player" : "Opponent";
}

function formatRow(rowId: RowId): string {
  return rowId[0].toUpperCase() + rowId.slice(1);
}

function formatRows(rows: RowId[]): string {
  return rows.map(formatRow).join("/");
}

function isPlayerId(value: unknown): value is PlayerId {
  return value === "player" || value === "opponent";
}

function isRowId(value: unknown): value is RowId {
  return value === "close" || value === "ranged" || value === "siege";
}
