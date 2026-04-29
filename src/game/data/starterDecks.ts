import { CARD_DEFINITIONS_BY_ID, NEUTRAL_SPECIAL_CARD_IDS } from "./cards";
import type { CardDefinition, FactionId } from "../simulation/types";

export type StarterDeckDefinition = {
  factionId: FactionId;
  leaderId: string;
  unitIds: string[];
  specialIds: string[];
};

export type StarterDeckDefinitions = {
  leader: CardDefinition;
  deck: CardDefinition[];
};

export const STARTER_DECKS: Record<FactionId, StarterDeckDefinition> = {
  "northern-realms": {
    factionId: "northern-realms",
    leaderId: "northern-realms-foltest-king-of-temeria",
    unitIds: [
      "nr-blue-stripes-commando",
      "nr-blue-stripes-commando",
      "nr-blue-stripes-commando",
      "nr-catapult",
      "nr-catapult",
      "nr-crinfrid-reavers-dragon-hunter",
      "nr-crinfrid-reavers-dragon-hunter",
      "nr-crinfrid-reavers-dragon-hunter",
      "nr-dun-banner-medic",
      "nr-kaedweni-siege-expert",
      "nr-keira-metz",
      "nr-philippa-eilhart",
      "nr-prince-stennis",
      "nr-sigismund-dijkstra",
      "nr-thaler",
      "nr-trebuchet",
      "nr-vernon-roche",
      "nr-ves",
      "nr-siegfried-of-denesle",
      "nr-siege-tower",
      "nr-sheala-de-tancarville",
      "nr-dethmold",
    ],
    specialIds: [...NEUTRAL_SPECIAL_CARD_IDS],
  },
  "nilfgaardian-empire": {
    factionId: "nilfgaardian-empire",
    leaderId: "nilfgaard-emhyr-his-imperial-majesty",
    unitIds: [
      "ng-black-infantry-archer",
      "ng-black-infantry-archer",
      "ng-etolian-auxiliary-archers",
      "ng-etolian-auxiliary-archers",
      "ng-impera-brigade-guard",
      "ng-impera-brigade-guard",
      "ng-impera-brigade-guard",
      "ng-impera-brigade-guard",
      "ng-nausicaa-cavalry-rider",
      "ng-nausicaa-cavalry-rider",
      "ng-nausicaa-cavalry-rider",
      "ng-letho",
      "ng-menno-coehoorn",
      "ng-morvran-voorhis",
      "ng-shilard-fitz-oesterlen",
      "ng-stefan-skellen",
      "ng-tibor-eggebracht",
      "ng-vattier-de-rideaux",
      "ng-heavy-zerrikanian-fire-scorpion",
      "ng-fringilla-vigo",
      "ng-assire-var-anahid",
      "ng-cahir",
    ],
    specialIds: [...NEUTRAL_SPECIAL_CARD_IDS],
  },
  scoiatael: {
    factionId: "scoiatael",
    leaderId: "scoiatael-francesca-daisy-of-the-valley",
    unitIds: [
      "st-barclay-els",
      "st-ciaran",
      "st-dennis-cranmer",
      "st-dol-blathanna-scout",
      "st-dol-blathanna-scout",
      "st-dol-blathanna-scout",
      "st-dwarven-skirmisher",
      "st-dwarven-skirmisher",
      "st-dwarven-skirmisher",
      "st-elven-skirmisher",
      "st-elven-skirmisher",
      "st-elven-skirmisher",
      "st-havekar-healer",
      "st-havekar-healer",
      "st-havekar-smuggler",
      "st-havekar-smuggler",
      "st-havekar-smuggler",
      "st-iorveth",
      "st-isengrim",
      "st-milva",
      "st-saesenthessis",
      "st-yaevinn",
    ],
    specialIds: [...NEUTRAL_SPECIAL_CARD_IDS],
  },
  monsters: {
    factionId: "monsters",
    leaderId: "monsters-eredin-king-of-the-wild-hunt",
    unitIds: [
      "mo-arachas",
      "mo-arachas",
      "mo-arachas",
      "mo-arachas-behemoth",
      "mo-crone-brewess",
      "mo-crone-weavess",
      "mo-crone-whispess",
      "mo-draug",
      "mo-earth-elemental",
      "mo-fiend",
      "mo-fire-elemental",
      "mo-forktail",
      "mo-ghoul",
      "mo-ghoul",
      "mo-ghoul",
      "mo-grave-hag",
      "mo-griffin",
      "mo-harpy",
      "mo-imlerith",
      "mo-kayran",
      "mo-nekker",
      "mo-nekker",
      "mo-vampire-bruxa",
      "mo-vampire-ekimmara",
      "mo-vampire-fleder",
      "mo-vampire-garkain",
      "mo-vampire-katakan",
    ],
    specialIds: [...NEUTRAL_SPECIAL_CARD_IDS],
  },
};

export function getStarterDeckDefinitions(factionId: FactionId): StarterDeckDefinitions {
  const deck = STARTER_DECKS[factionId];

  if (!deck) {
    throw new Error(`Missing starter deck for faction: ${factionId}`);
  }

  return {
    leader: getCardDefinition(deck.leaderId),
    deck: [...deck.unitIds, ...deck.specialIds].map(getCardDefinition),
  };
}

function getCardDefinition(cardId: string): CardDefinition {
  const definition = CARD_DEFINITIONS_BY_ID[cardId];

  if (!definition) {
    throw new Error(`Missing card definition: ${cardId}`);
  }

  return definition;
}
