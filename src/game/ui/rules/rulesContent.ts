export type RulesSection = {
  title: string;
  items: string[];
};

export const RULES_SECTIONS: RulesSection[] = [
  {
    title: "Goal",
    items: [
      "Win the match by winning two rounds before your opponent does.",
      "A round is won by having the higher total board strength after both players can no longer act.",
      "Cards are a long-term resource. Most cards are not redrawn between rounds, so spending too much early can lose the match later.",
    ],
  },
  {
    title: "Setup",
    items: [
      "Choose one faction before the match. The opponent receives a random different faction.",
      "Each player starts with a leader card, a shuffled deck, and an opening hand.",
      "During Opening Redraw, each player may replace up to two cards once before round one starts.",
    ],
  },
  {
    title: "Turn Flow",
    items: [
      "Players alternate turns while the round is active.",
      "On your turn, play one card, use your leader, or pass.",
      "Passing means you stop acting for the rest of the round. If the other player has not passed, they may keep playing cards.",
      "The round ends when both players have passed or when neither player can act.",
    ],
  },
  {
    title: "Rows",
    items: [
      "Unit cards are played into Close, Ranged, or Siege rows based on their allowed row icons.",
      "Agile cards can choose between Close and Ranged rows.",
      "A player's score is the total strength across all three rows.",
      "After a round, most board cards move to discard. Monster decks keep one random normal unit on the board between rounds.",
    ],
  },
  {
    title: "Card Types",
    items: [
      "Unit cards add strength to a row and can be affected by weather, Horn, Tight Bond, and Morale Boost.",
      "Hero cards add strength but ignore weather and strength modifiers. They also cannot be targeted by Decoy or Medic.",
      "Special cards apply an immediate tactical effect instead of staying as normal strength units.",
      "Leader cards are available beside the board and can be used once per match.",
    ],
  },
  {
    title: "Scoring Effects",
    items: [
      "Weather reduces eligible units in the affected row to strength 1.",
      "Commander's Horn doubles eligible unit strength in one row.",
      "Tight Bond multiplies matching units by the number of matching copies in the same row.",
      "Morale Boost adds +1 strength to other eligible units in the same row.",
      "Hero cards ignore all of these strength changes.",
    ],
  },
  {
    title: "Abilities",
    items: [
      "Spy: play the card on the opponent's board, then draw two cards.",
      "Medic: revive one eligible normal unit from your discard pile.",
      "Muster: automatically pull matching group cards from deck or hand onto the board.",
      "Scorch: destroy every strongest non-hero unit on the battlefield when their final strength is above 0.",
      "Decoy: swap a Decoy from hand with one eligible non-hero unit on your side of the battlefield.",
      "Clear Weather: remove all active weather effects.",
    ],
  },
  {
    title: "Faction Perks",
    items: [
      "Northern Realms: draw one extra card after winning a round.",
      "Nilfgaardian Empire: win rounds that end in a draw.",
      "Scoia'tael: controls first-turn advantage through flexible opening pressure.",
      "Monsters: keep one random normal unit on the battlefield after each non-final round.",
    ],
  },
  {
    title: "Practical Tips",
    items: [
      "Do not chase every round. Passing early can force the opponent to spend more cards.",
      "Spies are powerful because they trade board strength for more hand resources.",
      "Weather is strongest against crowded rows and weakest against heroes.",
      "Save Scorch for high-value targets, but remember it can destroy your own strongest units too.",
      "Try to win two rounds with the fewest cards possible.",
    ],
  },
  {
    title: "Controls",
    items: [
      "Hover a card to inspect it.",
      "Click or drag a playable card, then choose a valid row.",
      "Use Finish Redraw during the opening redraw phase.",
      "Use Pass when you want to stop playing cards for the current round.",
      "Use Leader once per match when the leader action is available.",
    ],
  },
];

