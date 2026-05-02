import * as THREE from "three";
import { assetManifest } from "../assets/manifest";
import { FACTIONS } from "../data/factions";
import { debugFlags } from "../diagnostics/debugFlags";
import type {
  CardDefinition,
  CardInstance,
  CardInstanceId,
  GameEvent,
  MatchState,
  PlayerId,
  RowId,
} from "../simulation/types";
import type { VisualAnimation, VisualAnimationQueue } from "./animationQueue";
import type { BoardAnchors } from "./boardScene";
import { createCardMesh, type CardMesh } from "./cardMesh";
import {
  createSlainAnimationContract,
  createSlainCardEffect,
  type SlainAnimationContract,
  type SlainCardEffect,
} from "./vfx/slainEffect";
import { createAbilityEventEffect, type AbilityEventEffect } from "./vfx/abilityEventEffects";

export type SimulationRenderer = {
  applySnapshot: (state: MatchState, options?: { animateEvents?: boolean }) => void;
  getCardInstanceIdFromObject: (object: THREE.Object3D) => CardInstanceId | undefined;
  getCardInspection: (cardInstanceId: CardInstanceId) => CardInspection | undefined;
  getInteractiveCardObjects: () => THREE.Object3D[];
  setInteractionState: (state: RenderInteractionState) => void;
  update: (deltaSeconds: number) => void;
  dispose: () => void;
};

export type RendererAudioCue = {
  cardInstanceId: CardInstanceId;
  cue: "slain-slash";
  intensity: "major" | "normal";
  reason: string;
};

export type SimulationRendererOptions = {
  loadCardTexture?: (url: string) => THREE.Texture;
  onAudioCue?: (cue: RendererAudioCue) => void;
  onCameraFocus?: (worldPosition: THREE.Vector3, intensity: number) => void;
  prefersReducedMotion?: () => boolean;
};

export type CardInspection = {
  cardInstanceId: CardInstanceId;
  name: string;
  type: CardDefinition["type"];
  basePower: number;
  rows: RowId[];
  abilities: CardDefinition["abilities"];
  zone: CardInstance["zone"];
  ownerId: PlayerId;
  controllerId: PlayerId;
};

export type RenderInteractionState = {
  blockedTargetCardIds?: CardInstanceId[];
  hoveredCardId?: CardInstanceId;
  selectedCardId?: CardInstanceId;
  draggedCardId?: CardInstanceId;
  rejectedCardId?: CardInstanceId;
  dragPreviewPosition?: THREE.Vector3;
  validTargetCardIds?: CardInstanceId[];
};

type RenderedCard = {
  card: CardMesh;
  slainEffect?: SlainCardEffect;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  targetScale: number;
};

type RenderedCardPose = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
};

const ROWS = ["close", "ranged", "siege"] as const;
const PLAYERS = ["player", "opponent"] as const;
const HAND_Z: Record<PlayerId, number> = {
  player: 6.68,
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
  rendererOptions: SimulationRendererOptions = {},
): SimulationRenderer {
  const renderedCards = new Map<CardInstanceId, RenderedCard>();
  const activelyAnimatedCards = new Set<CardInstanceId>();
  let lastEventSequence = Number.NEGATIVE_INFINITY;
  let latestState: MatchState | undefined;
  let interactionState: RenderInteractionState = {};

  return {
    applySnapshot(state, applyOptions = {}) {
      const previousPoses = snapshotRenderedCardPoses(renderedCards);
      const animateEvents = applyOptions.animateEvents ?? true;
      const hasRoundCleanup = animateEvents && hasNewRoundCleanup(state, lastEventSequence);
      latestState = state;
      ensureRenderedCards(root, renderedCards, state, rendererOptions);
      syncCardTargets(root, anchors, renderedCards, state);
      if (hasRoundCleanup) {
        snapCardsInZone(renderedCards, state, "discard");
      }
      applyCardInteractionState(renderedCards, interactionState);

      if (animateEvents) {
        enqueueNewEvents(
          renderedCards,
          queue,
          state,
          lastEventSequence,
          previousPoses,
          root,
          anchors,
          activelyAnimatedCards,
          rendererOptions,
        );
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
        activelyAnimatedCards,
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
        renderedCard.slainEffect?.dispose();
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
  rendererOptions: SimulationRendererOptions,
) {
  for (const card of Object.values(state.cards)) {
    if (renderedCards.has(card.id)) {
      continue;
    }

    const definition = state.cardDefinitions[card.definitionId];
    const renderedCard = createRenderedCard(card, definition, rendererOptions);
    markInteractiveCard(renderedCard.card.root, card.id);
    renderedCards.set(card.id, renderedCard);
    root.add(renderedCard.card.root);
  }
}

function createRenderedCard(
  card: CardInstance,
  definition: CardDefinition,
  options: SimulationRendererOptions,
): RenderedCard {
  const accentColor = FACTION_ACCENTS[definition.faction] ?? "#d6bb73";
  const artUrl = assetManifest.cards[definition.artKey];
  const cardMesh = createCardMesh({
    label: definition.name,
    accentColor,
    faceColor: definition.type === "hero" ? "#41301c" : undefined,
    frontTexture: artUrl ? options.loadCardTexture?.(artUrl) : undefined,
    powerLabel: definition.type === "special" || definition.type === "leader" ? "" : `${definition.basePower}`,
    typeLabel: formatCardType(definition),
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
  const spacing = playerId === "player"
    ? Math.min(0.8, 8.7 / Math.max(handCards.length - 1, 1))
    : Math.min(0.74, 8.4 / Math.max(handCards.length - 1, 1));
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
        HAND_Z[playerId] + (playerId === "player" ? Math.sin((index / Math.max(handCards.length - 1, 1)) * Math.PI) * -0.08 : 0),
      ),
      rotation: new THREE.Euler(
        CARD_ROTATION_X,
        0,
        playerId === "player"
          ? (index - (handCards.length - 1) / 2) * -0.022
          : Math.PI + (index - (handCards.length - 1) / 2) * 0.012,
      ),
      scale: playerId === "player" ? 0.92 : 0.86,
      visible: playerId === "player" || index < 10,
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
  const visibleDiscardStart = pile === "discard" ? Math.max(0, pileCards.length - 7) : 0;

  pileCards.forEach((cardInstanceId, index) => {
    const renderedCard = renderedCards.get(cardInstanceId);

    if (!renderedCard) {
      return;
    }

    if (pile === "discard") {
      const displayIndex = index - visibleDiscardStart;
      const discardPose = getDiscardPilePose(anchorPosition, playerId, displayIndex);
      setRenderedCardTarget(renderedCard, {
        position: discardPose.position,
        rotation: discardPose.rotation,
        scale: discardPose.scale,
        visible: displayIndex >= 0,
      });
      assignedCards.add(cardInstanceId);
      return;
    }

    const stackIndex = Math.min(index, 3);
    setRenderedCardTarget(renderedCard, {
      position: new THREE.Vector3(
        anchorPosition.x + stackIndex * 0.012,
        anchorPosition.y + stackIndex * 0.012,
        anchorPosition.z - stackIndex * 0.01,
      ),
      rotation: new THREE.Euler(CARD_ROTATION_X, 0, playerId === "player" ? 0 : Math.PI),
      scale: 0.95,
      visible: index < 4,
    });
    assignedCards.add(cardInstanceId);
  });
}

function getDiscardPilePose(
  anchorPosition: THREE.Vector3,
  playerId: PlayerId,
  displayIndex: number,
): {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: number;
} {
  const fan = [
    { x: -0.23, z: -0.34, turn: -0.26 },
    { x: 0.18, z: -0.22, turn: 0.18 },
    { x: -0.08, z: -0.04, turn: -0.08 },
    { x: 0.24, z: 0.12, turn: 0.28 },
    { x: -0.18, z: 0.28, turn: -0.18 },
    { x: 0.07, z: 0.42, turn: 0.08 },
    { x: -0.02, z: 0.02, turn: 0.02 },
  ];
  const visibleIndex = Math.max(0, displayIndex);
  const pose = fan[visibleIndex % fan.length];
  const ownerRotation = playerId === "player" ? 0 : Math.PI;

  return {
    position: new THREE.Vector3(
      anchorPosition.x + pose.x,
      anchorPosition.y + 0.085 + visibleIndex * 0.032,
      anchorPosition.z + pose.z,
    ),
    rotation: new THREE.Euler(CARD_ROTATION_X, 0, ownerRotation + pose.turn),
    scale: 0.82,
  };
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

function snapCardsInZone(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  state: MatchState,
  zone: CardInstance["zone"],
) {
  for (const [cardInstanceId, renderedCard] of renderedCards) {
    if (state.cards[cardInstanceId]?.zone !== zone) {
      continue;
    }

    renderedCard.card.root.position.copy(renderedCard.targetPosition);
    renderedCard.card.root.rotation.copy(renderedCard.targetRotation);
    renderedCard.card.root.scale.setScalar(renderedCard.targetScale);
  }
}

function snapshotRenderedCardPoses(
  renderedCards: Map<CardInstanceId, RenderedCard>,
): Map<CardInstanceId, RenderedCardPose> {
  return new Map(
    [...renderedCards.entries()].map(([cardInstanceId, renderedCard]) => [
      cardInstanceId,
      {
        position: renderedCard.card.root.position.clone(),
        rotation: renderedCard.card.root.rotation.clone(),
        scale: renderedCard.card.root.scale.x,
      },
    ]),
  );
}

function settleRenderedCards(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  alpha: number,
  interactionState: RenderInteractionState,
  activelyAnimatedCards: Set<CardInstanceId>,
) {
  for (const [cardInstanceId, renderedCard] of renderedCards) {
    if (activelyAnimatedCards.has(cardInstanceId)) {
      continue;
    }

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
  const validTargets = new Set(interactionState.validTargetCardIds ?? []);
  const blockedTargets = new Set(interactionState.blockedTargetCardIds ?? []);

  for (const [cardInstanceId, renderedCard] of renderedCards) {
    renderedCard.card.setInteractionState({
      blockedTarget: blockedTargets.has(cardInstanceId),
      hovered: interactionState.hoveredCardId === cardInstanceId,
      selected: interactionState.selectedCardId === cardInstanceId,
      dragging: interactionState.draggedCardId === cardInstanceId,
      rejected: interactionState.rejectedCardId === cardInstanceId,
      validTarget: validTargets.has(cardInstanceId),
    });
  }
}

function enqueueNewEvents(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  queue: VisualAnimationQueue,
  state: MatchState,
  lastEventSequence: number,
  previousPoses: Map<CardInstanceId, RenderedCardPose>,
  root: THREE.Group,
  anchors: BoardAnchors,
  activelyAnimatedCards: Set<CardInstanceId>,
  options: SimulationRendererOptions,
) {
  const newEvents = state.eventLog
    .filter((event) => event.sequence > lastEventSequence)
    .sort((a, b) => a.sequence - b.sequence);

  for (const event of newEvents) {
    const slainContract = createSlainAnimationContract(event, state, {
      reducedMotion: prefersReducedMotion(options),
    });

    if (slainContract) {
      queue.enqueue(createSlainAnimation(
        renderedCards,
        event,
        slainContract,
        previousPoses,
        activelyAnimatedCards,
        options,
      ));
      continue;
    }

    queue.enqueue(createEventAnimation(renderedCards, root, anchors, state, event));
  }
}

function createEventAnimation(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  root: THREE.Group,
  anchors: BoardAnchors,
  state: MatchState,
  event: GameEvent,
): VisualAnimation {
  let abilityEffect: AbilityEventEffect | undefined;

  return {
    id: event.id,
    event,
    blocking: event.blocking,
    durationSeconds: getEventDuration(event),
    onStart: () => {
      abilityEffect = createAbilityEventEffect(event, state, {
        anchors,
        boardRoot: root,
        getCardRoot: (cardInstanceId) => renderedCards.get(cardInstanceId)?.card.root,
      });
      abilityEffect?.update(0);
    },
    onUpdate: (progress) => {
      animateEvent(renderedCards, event, progress);
      abilityEffect?.update(progress);
    },
    onComplete: () => {
      abilityEffect?.dispose();
      completeEvent(renderedCards, event);
    },
  };
}

function createSlainAnimation(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  event: GameEvent,
  contract: SlainAnimationContract,
  previousPoses: Map<CardInstanceId, RenderedCardPose>,
  activelyAnimatedCards: Set<CardInstanceId>,
  options: SimulationRendererOptions,
): VisualAnimation {
  return {
    id: event.id,
    event,
    blocking: event.blocking,
    durationSeconds: contract.durationSeconds,
    onStart: () => {
      const renderedCard = renderedCards.get(contract.cardInstanceId);

      if (!renderedCard) {
        return;
      }

      const startPose = getAnimationStartPose(renderedCard, previousPoses.get(contract.cardInstanceId));
      renderedCard.card.root.position.copy(startPose.position);
      renderedCard.card.root.rotation.copy(startPose.rotation);
      renderedCard.card.root.scale.setScalar(startPose.scale);
      activelyAnimatedCards.add(contract.cardInstanceId);

      if (!contract.reducedMotion) {
        renderedCard.slainEffect?.dispose();
        renderedCard.slainEffect = createSlainCardEffect(contract);
        renderedCard.card.root.add(renderedCard.slainEffect.root);
        renderedCard.slainEffect.update(0);
      }

      options.onAudioCue?.({
        cardInstanceId: contract.cardInstanceId,
        cue: "slain-slash",
        intensity: contract.major ? "major" : "normal",
        reason: contract.reason,
      });
    },
    onUpdate: (progress) => animateSlainEvent(
      renderedCards,
      contract,
      previousPoses,
      progress,
    ),
    onComplete: () => completeSlainEvent(renderedCards, contract, activelyAnimatedCards),
  };
}

function animateSlainEvent(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  contract: SlainAnimationContract,
  previousPoses: Map<CardInstanceId, RenderedCardPose>,
  progress: number,
) {
  const renderedCard = renderedCards.get(contract.cardInstanceId);

  if (!renderedCard) {
    return;
  }

  const startPose = getAnimationStartPose(renderedCard, previousPoses.get(contract.cardInstanceId));

  if (contract.reducedMotion) {
    animateReducedMotionSlain(renderedCard, startPose, progress);
    return;
  }

  const travelProgress = clamp01((progress - 0.72) / 0.28);

  if (travelProgress <= 0) {
    renderedCard.card.root.position.copy(startPose.position);
    renderedCard.card.root.rotation.copy(startPose.rotation);
    renderedCard.card.root.scale.setScalar(startPose.scale);
  } else {
    const easedTravel = easeInOutCubic(travelProgress);
    renderedCard.card.root.position.lerpVectors(startPose.position, renderedCard.targetPosition, easedTravel);
    lerpEuler(renderedCard.card.root.rotation, startPose.rotation, renderedCard.targetRotation, easedTravel);
    renderedCard.card.root.scale.setScalar(THREE.MathUtils.lerp(startPose.scale * 0.9, renderedCard.targetScale, easedTravel));
  }

  renderedCard.slainEffect?.update(progress);
}

function animateReducedMotionSlain(
  renderedCard: RenderedCard,
  startPose: RenderedCardPose,
  progress: number,
) {
  const eased = easeInOutCubic(progress);
  renderedCard.card.root.position.lerpVectors(startPose.position, renderedCard.targetPosition, eased);
  lerpEuler(renderedCard.card.root.rotation, startPose.rotation, renderedCard.targetRotation, eased);
  renderedCard.card.root.scale.setScalar(renderedCard.targetScale + Math.sin(progress * Math.PI) * 0.05);
}

function completeSlainEvent(
  renderedCards: Map<CardInstanceId, RenderedCard>,
  contract: SlainAnimationContract,
  activelyAnimatedCards: Set<CardInstanceId>,
) {
  const renderedCard = renderedCards.get(contract.cardInstanceId);
  activelyAnimatedCards.delete(contract.cardInstanceId);

  if (!renderedCard) {
    return;
  }

  renderedCard.slainEffect?.dispose();
  renderedCard.slainEffect = undefined;
  renderedCard.card.root.position.copy(renderedCard.targetPosition);
  renderedCard.card.root.rotation.copy(renderedCard.targetRotation);
  renderedCard.card.root.scale.setScalar(renderedCard.targetScale);
}

function animateEvent(
  renderedCards: Map<CardInstanceId, RenderedCard>,
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
      return 0.28;
    case "card.played":
      return 0.54;
    case "card.revived":
      return 0.76;
    case "leader.used":
      return 0.84;
    case "card.destroyed":
      return 0.56;
    case "weather.applied":
    case "weather.cleared":
      return 0.76;
    case "row.buff.applied":
      return 0.68;
    case "round.ended":
      return 0.16;
    case "match.ended":
      return 1.18;
    case "phase.changed":
    case "turn.changed":
    case "player.passed":
    case "match.created":
      return 0.12;
    default:
      return assertNever(event.type);
  }
}

function formatCardType(definition: CardDefinition): string {
  if (definition.type === "special") {
    return definition.abilities.length > 0
      ? definition.abilities.map(formatAbility).join(" / ")
      : "Special";
  }

  if (definition.type === "leader") {
    return "Leader";
  }

  return definition.abilities.length > 0
    ? definition.abilities.map(formatAbility).join(" / ")
    : definition.type === "hero" ? "Hero" : "Unit";
}

function formatAbility(ability: string): string {
  return ability
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function getAnchorPosition(root: THREE.Group, anchor: THREE.Group): THREE.Vector3 {
  const worldPosition = anchor.getWorldPosition(new THREE.Vector3());
  return root.worldToLocal(worldPosition);
}

function getLatestEventSequence(state: MatchState): number {
  return state.eventLog.reduce((latest, event) => Math.max(latest, event.sequence), lastInitialEventSequence());
}

function hasNewRoundCleanup(state: MatchState, lastEventSequence: number): boolean {
  return state.eventLog.some((event) => event.sequence > lastEventSequence && event.type === "round.ended");
}

function lastInitialEventSequence(): number {
  return Number.NEGATIVE_INFINITY;
}

function getPayloadString(event: GameEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === "string" ? value : undefined;
}

function getAnimationStartPose(
  renderedCard: RenderedCard,
  previousPose?: RenderedCardPose,
): RenderedCardPose {
  return previousPose ?? {
    position: renderedCard.card.root.position.clone(),
    rotation: renderedCard.card.root.rotation.clone(),
    scale: renderedCard.card.root.scale.x,
  };
}

function lerpEuler(
  target: THREE.Euler,
  from: THREE.Euler,
  to: THREE.Euler,
  alpha: number,
) {
  target.x = THREE.MathUtils.lerp(from.x, to.x, alpha);
  target.y = THREE.MathUtils.lerp(from.y, to.y, alpha);
  target.z = THREE.MathUtils.lerp(from.z, to.z, alpha);
}

function prefersReducedMotion(options: SimulationRendererOptions): boolean {
  if (options.prefersReducedMotion) {
    return options.prefersReducedMotion();
  }

  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress ** 3
    : 1 - (-2 * progress + 2) ** 3 / 2;
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
