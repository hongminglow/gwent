import * as THREE from "three";
import { FACTIONS } from "../data/factions";
import { debugFlags } from "../diagnostics/debugFlags";
import { calculateScores } from "../simulation/scoring";
import type {
  CardDefinition,
  CardInstance,
  CardInstanceId,
  GameEvent,
  MatchState,
  PlayerId,
  RowId,
} from "../simulation/types";
import type { VisualAnimationQueue } from "./animationQueue";
import type { BoardAnchors } from "./boardScene";
import { createCardMesh, type CardMesh } from "./cardMesh";

export type SimulationRenderer = {
  applySnapshot: (state: MatchState, options?: { animateEvents?: boolean }) => void;
  getCardInstanceIdFromObject: (object: THREE.Object3D) => CardInstanceId | undefined;
  getCardInspection: (cardInstanceId: CardInstanceId) => CardInspection | undefined;
  getInteractiveCardObjects: () => THREE.Object3D[];
  setInteractionState: (state: RenderInteractionState) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

export type CardInspection = {
  cardInstanceId: CardInstanceId;
  name: string;
  type: CardDefinition["type"];
  basePower: number;
  rows: RowId[];
  abilities: string[];
  zone: CardInstance["zone"];
  ownerId: PlayerId;
  controllerId: PlayerId;
};

export type RenderInteractionState = {
  hoveredCardId?: CardInstanceId;
  selectedCardId?: CardInstanceId;
  draggedCardId?: CardInstanceId;
  rejectedCardId?: CardInstanceId;
  dragPreviewPosition?: THREE.Vector3;
};

type RenderedCard = {
  card: CardMesh;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  targetScale: number;
};

const ROWS = ["close", "ranged", "siege"] as const;
const PLAYERS = ["player", "opponent"] as const;
const HAND_Z: Record<PlayerId, number> = {
  player: 7.15,
  opponent: -7.15,
};
const CARD_ROTATION_X = -Math.PI / 2 + 0.06;
const FACTION_ACCENTS = Object.fromEntries(
  FACTIONS.map((faction) => [faction.id, faction.accentColor]),
);

export function createSimulationRenderer(
  root: THREE.Group,
  anchors: BoardAnchors,
  queue: VisualAnimationQueue,
): SimulationRenderer {
  const renderedCards = new Map<CardInstanceId, RenderedCard>();
  let lastEventSequence = Number.NEGATIVE_INFINITY;
  let latestState: MatchState | undefined;
  let interactionState: RenderInteractionState = {};

  return {
    applySnapshot(state, options = {}) {
      latestState = state;
      ensureRenderedCards(root, renderedCards, state);
      syncCardTargets(root, anchors, renderedCards, state);
      applyCardInteractionState(renderedCards, interactionState);

      const animateEvents = options.animateEvents ?? true;
      if (animateEvents) {
        enqueueNewEvents(renderedCards, queue, state, lastEventSequence);
      }

      lastEventSequence = getLatestEventSequence(state);

      if (!animateEvents) {
        snapRenderedCards(renderedCards);
      }
    },
    update(deltaSeconds) {
      queue.update(deltaSeconds);
      settleRenderedCards(
        renderedCards,
        debugFlags.fastAnimations ? 1 : Math.min(deltaSeconds * 12, 1),
        interactionState,
      );
    },
    getCardInstanceIdFromObject(object) {
      return getCardInstanceIdFromObject(object);
    },
    getCardInspection(cardInstanceId) {
      if (!latestState) {
        return undefined;
      }

      return createCardInspection(latestState, cardInstanceId);
    },
    getInteractiveCardObjects() {
      return [...renderedCards.values()]
        .filter((renderedCard) => renderedCard.card.root.visible)
        .map((renderedCard) => renderedCard.card.root);
    },
    setInteractionState(state) {
      interactionState = state;
      applyCardInteractionState(renderedCards, interactionState);
    },
    dispose() {
      for (const renderedCard of renderedCards.values()) {
        renderedCard.card.dispose();
        renderedCard.card.root.removeFromParent();
      }

      renderedCards.clear();
      queue.clear();
    },
  };
}

function ensureRenderedCards(
  root: THREE.Group,
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
) {
  for (const card of Object.values(state.cards)) {
    if (renderedCards.has(card.id)) {
      continue;
    }

    const definition = state.cardDefinitions[card.definitionId];
    const renderedCard = createRenderedCard(card, definition);
    markInteractiveCard(renderedCard.card.root, card.id);
    renderedCards.set(card.id, renderedCard);
    root.add(renderedCard.card.root);
  }
}

function createRenderedCard(card: CardInstance, definition: CardDefinition): RenderedCard {
  const accentColor = FACTION_ACCENTS[definition.faction] ?? "#d6bb73";
  const cardMesh = createCardMesh({
    label: definition.name,
    accentColor,
    faceColor: definition.type === "hero" ? "#41301c" : undefined,
  });
  cardMesh.root.name = `Card:${card.id}:${definition.id}`;

  return {
    card: cardMesh,
    targetPosition: new THREE.Vector3(),
    targetRotation: new THREE.Euler(CARD_ROTATION_X, 0, 0),
    targetScale: definition.type === "leader" ? 1.04 : 1,
  };
}

function syncCardTargets(
  root: THREE.Group,
  anchors: BoardAnchors,
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
) {
  root.updateWorldMatrix(true, true);
  const assignedCards = new Set<CardInstanceId>();

  for (const playerId of PLAYERS) {
    syncLeaderTarget(root, anchors, renderedCards, state, playerId, assignedCards);
    syncHandTargets(renderedCards, state, playerId, assignedCards);
    syncPileTargets(root, anchors, renderedCards, state, playerId, "deck", assignedCards);
    syncPileTargets(root, anchors, renderedCards, state, playerId, "discard", assignedCards);

    for (const rowId of ROWS) {
      syncRowTargets(root, anchors, renderedCards, state, playerId, rowId, assignedCards);
    }
  }

  for (const [cardInstanceId, renderedCard] of renderedCards) {
    if (!assignedCards.has(cardInstanceId)) {
      const card = state.cards[cardInstanceId];
      renderedCard.card.root.visible = card?.zone !== "discard";
    }
  }
}

function syncLeaderTarget(
  root: THREE.Group,
  anchors: BoardAnchors,
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
  playerId: PlayerId,
  assignedCards: Set<CardInstanceId>,
) {
  const leaderCardId = state.players[playerId].leaderCardId;

  if (!leaderCardId) {
    return;
  }

  const renderedCard = renderedCards.get(leaderCardId);

  if (!renderedCard) {
    return;
  }

  const anchorPosition = getAnchorPosition(root, anchors.piles[playerId].leader);
  setRenderedCardTarget(renderedCard, {
    position: anchorPosition,
    rotation: new THREE.Euler(CARD_ROTATION_X, 0, playerId === "player" ? 0.02 : Math.PI + 0.02),
    scale: state.players[playerId].leaderUsed ? 0.92 : 1.04,
    visible: true,
  });
  assignedCards.add(leaderCardId);
}

function syncHandTargets(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
  playerId: PlayerId,
  assignedCards: Set<CardInstanceId>,
) {
  const handCards = state.players[playerId].hand.cards;
  const spacing = Math.min(0.82, 8.8 / Math.max(handCards.length - 1, 1));
  const startX = -((handCards.length - 1) * spacing) / 2;

  handCards.forEach((cardInstanceId, index) => {
    const renderedCard = renderedCards.get(cardInstanceId);

    if (!renderedCard) {
      return;
    }

    setRenderedCardTarget(renderedCard, {
      position: new THREE.Vector3(
        startX + index * spacing,
        0.42 + index * 0.004,
        HAND_Z[playerId],
      ),
      rotation: new THREE.Euler(
        CARD_ROTATION_X,
        0,
        playerId === "player" ? (index - handCards.length / 2) * -0.018 : Math.PI,
      ),
      scale: playerId === "player" ? 1 : 0.92,
      visible: playerId === "player" || index < 8,
    });
    assignedCards.add(cardInstanceId);
  });
}

function syncPileTargets(
  root: THREE.Group,
  anchors: BoardAnchors,
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
  playerId: PlayerId,
  pile: "deck" | "discard",
  assignedCards: Set<CardInstanceId>,
) {
  const pileCards = state.players[playerId][pile].cards;
  const anchorPosition = getAnchorPosition(root, anchors.piles[playerId][pile]);

  pileCards.forEach((cardInstanceId, index) => {
    const renderedCard = renderedCards.get(cardInstanceId);

    if (!renderedCard) {
      return;
    }

    const stackIndex = Math.min(index, 7);
    setRenderedCardTarget(renderedCard, {
      position: new THREE.Vector3(
        anchorPosition.x + stackIndex * 0.012,
        anchorPosition.y + stackIndex * 0.012,
        anchorPosition.z - stackIndex * 0.01,
      ),
      rotation: new THREE.Euler(CARD_ROTATION_X, 0, playerId === "player" ? 0 : Math.PI),
      scale: 0.95,
      visible: index < 8 || pile === "discard",
    });
    assignedCards.add(cardInstanceId);
  });
}

function syncRowTargets(
  root: THREE.Group,
  anchors: BoardAnchors,
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
  playerId: PlayerId,
  rowId: RowId,
  assignedCards: Set<CardInstanceId>,
) {
  const rowCards = state.board.rows[playerId][rowId].cards;
  const anchorPosition = getAnchorPosition(root, anchors.rowZones[playerId][rowId]);
  const spacing = Math.min(1.02, 9.6 / Math.max(rowCards.length - 1, 1));
  const startX = -((rowCards.length - 1) * spacing) / 2;

  rowCards.forEach((cardInstanceId, index) => {
    const renderedCard = renderedCards.get(cardInstanceId);

    if (!renderedCard) {
      return;
    }

    const definition = state.cardDefinitions[state.cards[cardInstanceId].definitionId];
    setRenderedCardTarget(renderedCard, {
      position: new THREE.Vector3(
        anchorPosition.x + startX + index * spacing,
        anchorPosition.y + index * 0.006,
        anchorPosition.z,
      ),
      rotation: new THREE.Euler(CARD_ROTATION_X, 0, playerId === "player" ? 0 : Math.PI),
      scale: definition.type === "hero" ? 1.06 : 1,
      visible: true,
    });
    assignedCards.add(cardInstanceId);
  });
}

function setRenderedCardTarget(
  renderedCard: RenderedCard,
  options: {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: number;
    visible: boolean;
  },
) {
  renderedCard.targetPosition.copy(options.position);
  renderedCard.targetRotation.copy(options.rotation);
  renderedCard.targetScale = options.scale;
  renderedCard.card.root.visible = options.visible;
}

function snapRenderedCards(renderedCards: Map<CardInstanceId, RenderedCard>) {
  for (const renderedCard of renderedCards.values()) {
    renderedCard.card.root.position.copy(renderedCard.targetPosition);
    renderedCard.card.root.rotation.copy(renderedCard.targetRotation);
    renderedCard.card.root.scale.setScalar(renderedCard.targetScale);
  }
}

function settleRenderedCards(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  alpha: number,
  interactionState: RenderInteractionState,
) {
  for (const [cardInstanceId, renderedCard] of renderedCards) {
    const targetPosition = getInteractionPosition(cardInstanceId, renderedCard, interactionState);
    const targetScale = getInteractionScale(cardInstanceId, renderedCard, interactionState);
    renderedCard.card.root.position.lerp(targetPosition, alpha);
    renderedCard.card.root.rotation.x = THREE.MathUtils.lerp(renderedCard.card.root.rotation.x, renderedCard.targetRotation.x, alpha);
    renderedCard.card.root.rotation.y = THREE.MathUtils.lerp(renderedCard.card.root.rotation.y, renderedCard.targetRotation.y, alpha);
    renderedCard.card.root.rotation.z = THREE.MathUtils.lerp(renderedCard.card.root.rotation.z, renderedCard.targetRotation.z, alpha);
    const scale = THREE.MathUtils.lerp(renderedCard.card.root.scale.x, targetScale, alpha);
    renderedCard.card.root.scale.setScalar(scale);
  }
}

function getInteractionPosition(
  cardInstanceId: CardInstanceId,
  renderedCard: RenderedCard,
  interactionState: RenderInteractionState,
): THREE.Vector3 {
  if (interactionState.draggedCardId === cardInstanceId && interactionState.dragPreviewPosition) {
    return new THREE.Vector3(
      interactionState.dragPreviewPosition.x,
      interactionState.dragPreviewPosition.y + 0.22,
      interactionState.dragPreviewPosition.z,
    );
  }

  const lifted = interactionState.hoveredCardId === cardInstanceId
    || interactionState.selectedCardId === cardInstanceId
    || interactionState.draggedCardId === cardInstanceId;
  const position = renderedCard.targetPosition.clone();

  if (lifted) {
    position.y += interactionState.selectedCardId === cardInstanceId ? 0.18 : 0.12;
  }

  return position;
}

function getInteractionScale(
  cardInstanceId: CardInstanceId,
  renderedCard: RenderedCard,
  interactionState: RenderInteractionState,
): number {
  if (interactionState.draggedCardId === cardInstanceId) {
    return renderedCard.targetScale + 0.12;
  }

  if (interactionState.selectedCardId === cardInstanceId) {
    return renderedCard.targetScale + 0.08;
  }

  if (interactionState.hoveredCardId === cardInstanceId) {
    return renderedCard.targetScale + 0.05;
  }

  return renderedCard.targetScale;
}

function applyCardInteractionState(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  interactionState: RenderInteractionState,
) {
  for (const [cardInstanceId, renderedCard] of renderedCards) {
    renderedCard.card.setInteractionState({
      hovered: interactionState.hoveredCardId === cardInstanceId,
      selected: interactionState.selectedCardId === cardInstanceId,
      dragging: interactionState.draggedCardId === cardInstanceId,
      rejected: interactionState.rejectedCardId === cardInstanceId,
    });
  }
}

function enqueueNewEvents(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  queue: VisualAnimationQueue,
  state: MatchState,
  lastEventSequence: number,
) {
  const newEvents = state.eventLog
    .filter((event) => event.sequence > lastEventSequence)
    .sort((a, b) => a.sequence - b.sequence);

  for (const event of newEvents) {
    queue.enqueue({
      id: event.id,
      event,
      blocking: event.blocking,
      durationSeconds: getEventDuration(event),
      onUpdate: (progress) => animateEvent(renderedCards, state, event, progress),
      onComplete: () => completeEvent(renderedCards, event),
    });
  }
}

function animateEvent(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
  event: GameEvent,
  progress: number,
) {
  const cardInstanceId = getPayloadString(event, "cardInstanceId")
    ?? getPayloadString(event, "leaderCardInstanceId");

  if (cardInstanceId) {
    const renderedCard = renderedCards.get(cardInstanceId);

    if (renderedCard) {
      const pulse = Math.sin(progress * Math.PI);
      renderedCard.card.root.position.y = renderedCard.targetPosition.y + pulse * 0.22;
      renderedCard.card.root.scale.setScalar(renderedCard.targetScale + pulse * 0.12);
      return;
    }
  }

  if (event.type === "round.ended") {
    const scores = calculateScores(state);
    const winningPlayer = scores.player > scores.opponent ? "player" : scores.opponent > scores.player ? "opponent" : undefined;

    if (winningPlayer) {
      for (const cardInstanceId of state.players[winningPlayer].hand.cards) {
        const renderedCard = renderedCards.get(cardInstanceId);

        if (renderedCard) {
          const pulse = Math.sin(progress * Math.PI);
          renderedCard.card.root.position.y = renderedCard.targetPosition.y + pulse * 0.08;
        }
      }
    }
  }
}

function completeEvent(renderedCards: Map<CardInstanceId, RenderedCard>, event: GameEvent) {
  const cardInstanceId = getPayloadString(event, "cardInstanceId")
    ?? getPayloadString(event, "leaderCardInstanceId");

  if (!cardInstanceId) {
    return;
  }

  const renderedCard = renderedCards.get(cardInstanceId);

  if (!renderedCard) {
    return;
  }

  renderedCard.card.root.position.copy(renderedCard.targetPosition);
  renderedCard.card.root.scale.setScalar(renderedCard.targetScale);
}

function getEventDuration(event: GameEvent): number {
  switch (event.type) {
    case "card.drawn":
      return 0.22;
    case "card.played":
    case "card.revived":
    case "leader.used":
      return 0.34;
    case "card.destroyed":
      return 0.48;
    case "weather.applied":
    case "weather.cleared":
    case "row.buff.applied":
      return 0.28;
    case "round.ended":
    case "match.ended":
      return 0.55;
    case "phase.changed":
    case "turn.changed":
    case "player.passed":
    case "match.created":
      return 0.12;
    default:
      return assertNever(event.type);
  }
}

function getAnchorPosition(root: THREE.Group, anchor: THREE.Group): THREE.Vector3 {
  const worldPosition = anchor.getWorldPosition(new THREE.Vector3());
  return root.worldToLocal(worldPosition);
}

function getLatestEventSequence(state: MatchState): number {
  return state.eventLog.reduce((latest, event) => Math.max(latest, event.sequence), lastInitialEventSequence());
}

function lastInitialEventSequence(): number {
  return Number.NEGATIVE_INFINITY;
}

function getPayloadString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function markInteractiveCard(root: THREE.Object3D, cardInstanceId: CardInstanceId) {
  root.traverse((object) => {
    object.userData.cardInstanceId = cardInstanceId;
    object.userData.interactionType = "card";
  });
}

function getCardInstanceIdFromObject(object: THREE.Object3D): CardInstanceId | undefined {
  let current: THREE.Object3D | null = object;

  while (current) {
    const cardInstanceId = current.userData.cardInstanceId;

    if (typeof cardInstanceId === "string") {
      return cardInstanceId;
    }

    current = current.parent;
  }

  return undefined;
}

function createCardInspection(
  state: MatchState,
  cardInstanceId: CardInstanceId,
): CardInspection | undefined {
  const card = state.cards[cardInstanceId];

  if (!card) {
    return undefined;
  }

  const definition = state.cardDefinitions[card.definitionId];

  return {
    cardInstanceId,
    name: definition.name,
    type: definition.type,
    basePower: definition.basePower,
    rows: definition.rows,
    abilities: definition.abilities,
    zone: card.zone,
    ownerId: card.ownerId,
    controllerId: card.controllerId,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled event type: ${JSON.stringify(value)}`);
}
