import { ALL_CARD_DEFINITIONS, CARD_DEFINITIONS_BY_ID } from "./cards";
import { FACTIONS } from "./factions";
import { STARTER_DECKS } from "./starterDecks";
import type { CardDefinition } from "../simulation/types";

export type CardDataValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateCardData(): CardDataValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const card of ALL_CARD_DEFINITIONS) {
    if (ids.has(card.id)) {
      errors.push(`Duplicate card id: ${card.id}`);
    }

    ids.add(card.id);
    validateCardDefinition(card, errors);
  }

  for (const faction of FACTIONS) {
    const starterDeck = STARTER_DECKS[faction.id];

    if (!starterDeck) {
      errors.push(`Missing starter deck for faction: ${faction.id}`);
      continue;
    }

    if (!CARD_DEFINITIONS_BY_ID[starterDeck.leaderId]) {
      errors.push(`Missing leader ${starterDeck.leaderId} for faction ${faction.id}`);
    }

    const unitDefinitions = starterDeck.unitIds.map((id) => CARD_DEFINITIONS_BY_ID[id]);
    const specialDefinitions = starterDeck.specialIds.map((id) => CARD_DEFINITIONS_BY_ID[id]);

    for (const id of [...starterDeck.unitIds, ...starterDeck.specialIds]) {
      if (!CARD_DEFINITIONS_BY_ID[id]) {
        errors.push(`Starter deck ${faction.id} references missing card ${id}`);
      }
    }

    if (unitDefinitions.filter(Boolean).length < 22) {
      errors.push(`Starter deck ${faction.id} has fewer than 22 unit cards`);
    }

    if (unitDefinitions.some((definition) => definition && !["unit", "hero"].includes(definition.type))) {
      errors.push(`Starter deck ${faction.id} has non-unit card in unitIds`);
    }

    if (specialDefinitions.filter(Boolean).length > 10) {
      errors.push(`Starter deck ${faction.id} has more than 10 special cards`);
    }

    if (specialDefinitions.some((definition) => definition && definition.type !== "special")) {
      errors.push(`Starter deck ${faction.id} has non-special card in specialIds`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateCardDefinition(card: CardDefinition, errors: string[]) {
  if (!card.name) {
    errors.push(`Card ${card.id} is missing a name`);
  }

  if (!card.artKey) {
    errors.push(`Card ${card.id} is missing an artKey`);
  }

  if ((card.type === "unit" || card.type === "hero") && card.rows.length === 0) {
    errors.push(`Unit card ${card.id} has no row`);
  }

  if (card.type === "special" && card.basePower !== 0) {
    errors.push(`Special card ${card.id} must have zero power`);
  }

  if (card.type === "hero" && !card.abilities.includes("hero")) {
    errors.push(`Hero card ${card.id} must include hero ability`);
  }

  for (const ability of card.abilities) {
    if (["scorch", "weather", "clear-weather", "commanders-horn", "decoy", "medic", "muster", "spy"].includes(ability) && !card.vfxKey) {
      errors.push(`Card ${card.id} has VFX ability ${ability} but no vfxKey`);
    }
  }
}
