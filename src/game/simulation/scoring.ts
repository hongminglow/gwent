import type { AbilityId, CardInstanceId, MatchState, PlayerId, RowId } from "./types";

export type ScoreSnapshot = Record<PlayerId, number>;

export type CardScoreBreakdown = {
  cardInstanceId: CardInstanceId;
  definitionId: string;
  name: string;
  basePower: number;
  finalPower: number;
  modifiers: ScoreModifier[];
};

export type ScoreModifier = {
  source: "weather" | "tight-bond" | "commanders-horn" | "morale-boost" | "hero-immunity";
  amount?: number;
  multiplier?: number;
  note: string;
};

export type RowScoreBreakdown = {
  rowId: RowId;
  weatherActive: boolean;
  hornActive: boolean;
  total: number;
  cards: CardScoreBreakdown[];
};

export type PlayerScoreBreakdown = {
  playerId: PlayerId;
  total: number;
  rows: Record<RowId, RowScoreBreakdown>;
};

export type MatchScoreBreakdown = Record<PlayerId, PlayerScoreBreakdown>;

export function calculateScores(state: MatchState): ScoreSnapshot {
  const breakdown = calculateScoreBreakdown(state);

  return {
    player: breakdown.player.total,
    opponent: breakdown.opponent.total,
  };
}

export function calculatePlayerScore(state: MatchState, playerId: PlayerId): number {
  return calculatePlayerScoreBreakdown(state, playerId).total;
}

export function calculateScoreBreakdown(state: MatchState): MatchScoreBreakdown {
  return {
    player: calculatePlayerScoreBreakdown(state, "player"),
    opponent: calculatePlayerScoreBreakdown(state, "opponent"),
  };
}

export function calculatePlayerScoreBreakdown(
  state: MatchState,
  playerId: PlayerId,
): PlayerScoreBreakdown {
  const rows = {
    close: calculateRowScoreBreakdown(state, playerId, "close"),
    ranged: calculateRowScoreBreakdown(state, playerId, "ranged"),
    siege: calculateRowScoreBreakdown(state, playerId, "siege"),
  };

  return {
    playerId,
    rows,
    total: rows.close.total + rows.ranged.total + rows.siege.total,
  };
}

export function calculateRowScoreBreakdown(
  state: MatchState,
  playerId: PlayerId,
  rowId: RowId,
): RowScoreBreakdown {
  const row = state.board.rows[playerId][rowId];
  const cardIds = row.cards;
  const hornActive = row.hornActive || rowHasAbility(state, cardIds, "commanders-horn");
  const moraleBoosters = cardIds.filter((cardInstanceId) =>
    cardHasAbility(state, cardInstanceId, "morale-boost"),
  );
  const tightBondCounts = getTightBondCounts(state, cardIds);
  const cards = cardIds.map((cardInstanceId) =>
    calculateCardScoreBreakdown(state, {
      cardInstanceId,
      hornActive,
      moraleBoosters,
      rowId,
      tightBondCount: tightBondCounts.get(getBondKey(state, cardInstanceId)) ?? 1,
    }),
  );

  return {
    rowId,
    weatherActive: state.board.weather[rowId],
    hornActive,
    cards,
    total: cards.reduce((sum, card) => sum + card.finalPower, 0),
  };
}

function calculateCardScoreBreakdown(
  state: MatchState,
  options: {
    cardInstanceId: CardInstanceId;
    hornActive: boolean;
    moraleBoosters: CardInstanceId[];
    rowId: RowId;
    tightBondCount: number;
  },
): CardScoreBreakdown {
  const card = state.cards[options.cardInstanceId];
  const definition = state.cardDefinitions[card.definitionId];
  const modifiers: ScoreModifier[] = [];
  const isHero = definition.type === "hero" || definition.abilities.includes("hero");
  let power = definition.basePower;

  if (isHero) {
    modifiers.push({
      source: "hero-immunity",
      note: "Hero cards ignore weather and strength modifiers.",
    });

    return {
      cardInstanceId: options.cardInstanceId,
      definitionId: definition.id,
      name: definition.name,
      basePower: definition.basePower,
      finalPower: power,
      modifiers,
    };
  }

  if (state.board.weather[options.rowId]) {
    power = 1;
    modifiers.push({
      source: "weather",
      note: "Weather reduces eligible units in this row to strength 1.",
    });
  }

  if (definition.abilities.includes("tight-bond") && options.tightBondCount > 1) {
    power *= options.tightBondCount;
    modifiers.push({
      source: "tight-bond",
      multiplier: options.tightBondCount,
      note: `Tight Bond multiplies matching units by ${options.tightBondCount}.`,
    });
  }

  if (options.hornActive) {
    power *= 2;
    modifiers.push({
      source: "commanders-horn",
      multiplier: 2,
      note: "Commander's Horn doubles eligible units in this row.",
    });
  }

  const moraleBonus = options.moraleBoosters.filter((sourceId) => sourceId !== options.cardInstanceId).length;

  if (moraleBonus > 0) {
    power += moraleBonus;
    modifiers.push({
      source: "morale-boost",
      amount: moraleBonus,
      note: `Morale Boost adds ${moraleBonus} from other booster card(s) in this row.`,
    });
  }

  return {
    cardInstanceId: options.cardInstanceId,
    definitionId: definition.id,
    name: definition.name,
    basePower: definition.basePower,
    finalPower: power,
    modifiers,
  };
}

function getTightBondCounts(
  state: MatchState,
  cardInstanceIds: CardInstanceId[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const cardInstanceId of cardInstanceIds) {
    if (!cardHasAbility(state, cardInstanceId, "tight-bond")) {
      continue;
    }

    const key = getBondKey(state, cardInstanceId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function getBondKey(state: MatchState, cardInstanceId: CardInstanceId): string {
  const card = state.cards[cardInstanceId];
  const definition = state.cardDefinitions[card.definitionId];
  return definition.tags.find((tag) => tag.startsWith("bond:")) ?? definition.name;
}

function rowHasAbility(
  state: MatchState,
  cardInstanceIds: CardInstanceId[],
  abilityId: AbilityId,
): boolean {
  return cardInstanceIds.some((cardInstanceId) => cardHasAbility(state, cardInstanceId, abilityId));
}

function cardHasAbility(
  state: MatchState,
  cardInstanceId: CardInstanceId,
  abilityId: AbilityId,
): boolean {
  const card = state.cards[cardInstanceId];
  const definition = state.cardDefinitions[card.definitionId];
  return definition.abilities.includes(abilityId);
}
