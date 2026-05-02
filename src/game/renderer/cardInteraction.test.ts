import { describe, expect, it } from "vitest";
import { createMatchFromFaction } from "../simulation/matchFlow";
import { matchReducer } from "../simulation/reducer";
import type { CardId, CardInstanceId, MatchState, PlayerId, RowId } from "../simulation/types";
import {
  createCardTargetAction,
  createImmediateAction,
  createRowTargetAction,
  getValidCardTargets,
  getPlacementRejectionReason,
  getValidRowTargets,
} from "./cardInteraction";

describe("card interaction helpers", () => {
  it("maps active hand units to their own legal rows", () => {
    const { cardId, state } = readyMatchWithActiveCard("unit-row-targets", "nr-blue-stripes-commando");

    expect(getValidRowTargets(state, cardId)).toEqual([
      {
        playerId: "player",
        rowId: "close",
      },
    ]);
    expect(createRowTargetAction(state, cardId, { playerId: "player", rowId: "close" })).toEqual({
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
      rowId: "close",
    });
    expect(createRowTargetAction(state, cardId, { playerId: "player", rowId: "ranged" })).toBeUndefined();
  });

  it("targets spy units onto the opponent row", () => {
    const { cardId, state } = readyMatchWithActiveCard("spy-row-targets", "nr-thaler");

    expect(getValidRowTargets(state, cardId)).toEqual([
      {
        playerId: "opponent",
        rowId: "siege",
      },
    ]);
    expect(createRowTargetAction(state, cardId, { playerId: "opponent", rowId: "siege" })).toEqual({
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
      rowId: "siege",
    });
    expect(createRowTargetAction(state, cardId, { playerId: "player", rowId: "siege" })).toBeUndefined();
  });

  it("adds the strongest eligible discard target when playing Medic", () => {
    const medic = readyMatchWithActiveCard("medic-row-targets", "nr-dun-banner-medic");
    const weakTargetId = findOwnedCardByDefinition(medic.state, "player", "nr-thaler");
    const strongTargetId = findOwnedCardByDefinition(medic.state, "player", "nr-catapult");
    const ineligibleHeroId = findOwnedCardByDefinition(medic.state, "player", "nr-vernon-roche");
    let state = putCardInDiscard(medic.state, "player", weakTargetId);
    state = putCardInDiscard(state, "player", ineligibleHeroId);
    state = putCardInDiscard(state, "player", strongTargetId);

    expect(createRowTargetAction(state, medic.cardId, { playerId: "player", rowId: "siege" })).toEqual({
      type: "play-card",
      playerId: "player",
      cardInstanceId: medic.cardId,
      rowId: "siege",
      targetCardInstanceId: strongTargetId,
    });
  });

  it("shows weather specials as row targets for both sides", () => {
    const { cardId, state } = readyMatchWithActiveCard("weather-row-targets", "neutral-biting-frost");

    expect(getValidRowTargets(state, cardId)).toEqual([
      {
        playerId: "player",
        rowId: "close",
      },
      {
        playerId: "opponent",
        rowId: "close",
      },
    ]);
    expect(createRowTargetAction(state, cardId, { playerId: "opponent", rowId: "close" })).toEqual({
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
      rowId: "close",
    });
  });

  it("keeps immediate specials off row targets", () => {
    const { cardId, state } = readyMatchWithActiveCard("immediate-specials", "neutral-scorch");

    expect(getValidRowTargets(state, cardId)).toEqual([]);
    expect(createImmediateAction(state, cardId)).toEqual({
      type: "play-card",
      playerId: "player",
      cardInstanceId: cardId,
    });
  });

  it("uses Decoy as a highlighted card-target ability", () => {
    const decoy = readyMatchWithActiveCard("decoy-card-targets", "neutral-decoy");
    const targetId = findOwnedCardByDefinition(decoy.state, "player", "nr-blue-stripes-commando");
    const heroId = findOwnedCardByDefinition(decoy.state, "player", "nr-vernon-roche");
    let state = putCardOnBoard(decoy.state, "player", targetId, "close");
    state = putCardOnBoard(state, "player", heroId, "close");

    expect(getValidCardTargets(state, decoy.cardId)).toEqual([targetId]);
    expect(createCardTargetAction(state, decoy.cardId, targetId)).toEqual({
      type: "play-card",
      playerId: "player",
      cardInstanceId: decoy.cardId,
      targetCardInstanceId: targetId,
    });
    expect(createCardTargetAction(state, decoy.cardId, heroId)).toBeUndefined();
  });

  it("explains rejected row targets with the concrete rule", () => {
    const spy = readyMatchWithActiveCard("spy-rejection", "nr-thaler");
    expect(getPlacementRejectionReason(spy.state, spy.cardId, { playerId: "player", rowId: "siege" }))
      .toBe("Spy cards must be placed on the opponent's Siege row, then they draw cards for you.");

    const unit = readyMatchWithActiveCard("row-rejection", "nr-blue-stripes-commando");
    expect(getPlacementRejectionReason(unit.state, unit.cardId, { playerId: "player", rowId: "ranged" }))
      .toBe("Blue Stripes Commando is a Close card and cannot be placed on Ranged.");

    const special = readyMatchWithActiveCard("special-rejection", "neutral-scorch");
    expect(getPlacementRejectionReason(special.state, special.cardId, { playerId: "player", rowId: "close" }))
      .toBe("Scorch resolves without a row. Click the selected card again to play it.");
  });

  it("supports targeted and immediate leader abilities", () => {
    const targetedState = readyMatch("leader-targeted", "monsters");
    const targetedLeaderId = targetedState.players.player.leaderCardId;

    if (!targetedLeaderId) {
      throw new Error("Missing player leader card.");
    }

    expect(getValidRowTargets(targetedState, targetedLeaderId)).toEqual([
      { playerId: "player", rowId: "close" },
      { playerId: "opponent", rowId: "close" },
      { playerId: "player", rowId: "ranged" },
      { playerId: "opponent", rowId: "ranged" },
      { playerId: "player", rowId: "siege" },
      { playerId: "opponent", rowId: "siege" },
    ]);
    expect(createRowTargetAction(targetedState, targetedLeaderId, { playerId: "opponent", rowId: "ranged" })).toEqual({
      type: "use-leader",
      playerId: "player",
      rowId: "ranged",
    });

    const immediateState = readyMatch("leader-immediate", "scoiatael");
    const immediateLeaderId = immediateState.players.player.leaderCardId;

    if (!immediateLeaderId) {
      throw new Error("Missing player leader card.");
    }

    expect(getValidRowTargets(immediateState, immediateLeaderId)).toEqual([]);
    expect(createImmediateAction(immediateState, immediateLeaderId)).toEqual({
      type: "use-leader",
      playerId: "player",
    });
  });
});

function readyMatchWithActiveCard(id: string, definitionId: CardId) {
  let state = readyMatch(id);
  const cardId = findOwnedCardByDefinition(state, "player", definitionId);
  state = putCardInActiveHand(state, "player", cardId);

  return {
    cardId,
    state,
  };
}

function readyMatch(
  id: string,
  playerFactionId: MatchState["players"]["player"]["factionId"] = "northern-realms",
): MatchState {
  let state = createMatchFromFaction({
    id,
    seed: id,
    playerFactionId,
  });

  state = matchReducer(state, {
    type: "finish-redraw",
    playerId: "player",
  });
  state = matchReducer(state, {
    type: "finish-redraw",
    playerId: "opponent",
  });

  return {
    ...state,
    round: {
      ...state.round,
      activePlayerId: "player",
    },
  };
}

function findOwnedCardByDefinition(
  state: MatchState,
  playerId: PlayerId,
  definitionId: CardId,
): CardInstanceId {
  const card = Object.values(state.cards).find(
    (candidate) => candidate.ownerId === playerId && candidate.definitionId === definitionId,
  );

  if (!card) {
    throw new Error(`Missing ${definitionId} for ${playerId}.`);
  }

  return card.id;
}

function putCardInActiveHand(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): MatchState {
  return {
    ...state,
    cards: {
      ...state.cards,
      [cardInstanceId]: {
        ...state.cards[cardInstanceId],
        zone: "hand",
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        hand: {
          ...state.players[playerId].hand,
          cards: [cardInstanceId, ...state.players[playerId].hand.cards.filter((id) => id !== cardInstanceId)],
        },
      },
    },
  };
}

function putCardInDiscard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): MatchState {
  return {
    ...state,
    cards: {
      ...state.cards,
      [cardInstanceId]: {
        ...state.cards[cardInstanceId],
        controllerId: playerId,
        rowId: undefined,
        zone: "discard",
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        deck: {
          cards: state.players[playerId].deck.cards.filter((id) => id !== cardInstanceId),
        },
        hand: {
          ...state.players[playerId].hand,
          cards: state.players[playerId].hand.cards.filter((id) => id !== cardInstanceId),
        },
        discard: {
          cards: [
            ...state.players[playerId].discard.cards.filter((id) => id !== cardInstanceId),
            cardInstanceId,
          ],
        },
      },
    },
  };
}

function putCardOnBoard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  rowId: RowId,
): MatchState {
  return {
    ...state,
    cards: {
      ...state.cards,
      [cardInstanceId]: {
        ...state.cards[cardInstanceId],
        controllerId: playerId,
        rowId,
        zone: "board",
      },
    },
    board: {
      ...state.board,
      rows: {
        ...state.board.rows,
        [playerId]: {
          ...state.board.rows[playerId],
          [rowId]: {
            ...state.board.rows[playerId][rowId],
            cards: [
              ...state.board.rows[playerId][rowId].cards.filter((id) => id !== cardInstanceId),
              cardInstanceId,
            ],
          },
        },
      },
    },
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        deck: {
          cards: state.players[playerId].deck.cards.filter((id) => id !== cardInstanceId),
        },
        hand: {
          ...state.players[playerId].hand,
          cards: state.players[playerId].hand.cards.filter((id) => id !== cardInstanceId),
        },
        discard: {
          cards: state.players[playerId].discard.cards.filter((id) => id !== cardInstanceId),
        },
      },
    },
  };
}
