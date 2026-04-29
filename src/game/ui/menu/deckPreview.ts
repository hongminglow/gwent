import { FACTIONS } from "../../data/factions";
import { STARTER_DECKS, getStarterDeckDefinitions } from "../../data/starterDecks";
import type { CardDefinition, FactionDefinition, FactionId } from "../../simulation/types";

export type DeckPreviewCard = {
  abilities: string[];
  count: number;
  id: string;
  name: string;
  power: number;
  rows: string[];
  type: CardDefinition["type"];
};

export type DeckPreviewModel = {
  abilitySummary: string[];
  cards: DeckPreviewCard[];
  counts: {
    total: number;
    units: number;
    specials: number;
    totalPower: number;
  };
  faction: FactionDefinition;
  leader: DeckPreviewCard;
};

export function createDeckPreviewModel(factionId: FactionId): DeckPreviewModel {
  const faction = FACTIONS.find((candidate) => candidate.id === factionId);

  if (!faction) {
    throw new Error(`Unknown faction: ${factionId}`);
  }

  const starterDeck = STARTER_DECKS[factionId];
  const definitions = getStarterDeckDefinitions(factionId);
  const cards = createCardList(definitions.deck);

  return {
    abilitySummary: createAbilitySummary(definitions.deck),
    cards,
    counts: {
      total: starterDeck.unitIds.length + starterDeck.specialIds.length,
      units: starterDeck.unitIds.length,
      specials: starterDeck.specialIds.length,
      totalPower: definitions.deck.reduce((sum, card) => sum + card.basePower, 0),
    },
    faction,
    leader: toPreviewCard(definitions.leader, 1),
  };
}

function createCardList(cards: CardDefinition[]): DeckPreviewCard[] {
  const counts = new Map<string, number>();

  for (const card of cards) {
    counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([cardId, count]) => {
      const card = cards.find((candidate) => candidate.id === cardId);

      if (!card) {
        throw new Error(`Missing preview card: ${cardId}`);
      }

      return toPreviewCard(card, count);
    })
    .sort((a, b) => b.power - a.power || a.name.localeCompare(b.name));
}

function toPreviewCard(card: CardDefinition, count: number): DeckPreviewCard {
  return {
    abilities: card.abilities,
    count,
    id: card.id,
    name: card.name,
    power: card.basePower,
    rows: card.rows,
    type: card.type,
  };
}

function createAbilitySummary(cards: CardDefinition[]): string[] {
  const counts = new Map<string, number>();

  for (const card of cards) {
    for (const ability of card.abilities) {
      counts.set(ability, (counts.get(ability) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([ability, count]) => `${formatAbility(ability)} x${count}`);
}

function formatAbility(ability: string): string {
  return ability
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
