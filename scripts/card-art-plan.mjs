import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cardsPath = path.join(rootDir, "src", "game", "data", "cards.ts");
const outputPath = path.join(rootDir, "docs", "card-art-prompts.json");

const sourceText = fs.readFileSync(cardsPath, "utf8");
const sourceFile = ts.createSourceFile(cardsPath, sourceText, ts.ScriptTarget.Latest, true);
const cards = [];

visit(sourceFile);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(cards.map(toPromptRecord), null, 2)}\n`);

console.log(`Wrote ${cards.length} card art prompt records to ${path.relative(rootDir, outputPath)}.`);

function visit(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    const kind = node.expression.text;

    if (["unit", "special", "leader"].includes(kind)) {
      const input = objectLiteralToRecord(node.arguments[0]);

      if (input?.id && input.name) {
        cards.push({
          abilities: input.abilities ?? [],
          faction: input.faction ?? "neutral",
          id: input.id,
          kind,
          name: input.name,
          power: input.power ?? 0,
          rows: input.rows ?? [],
          type: input.type ?? kind,
        });
      }
    }
  }

  ts.forEachChild(node, visit);
}

function objectLiteralToRecord(node) {
  if (!node || !ts.isObjectLiteralExpression(node)) {
    return undefined;
  }

  const record = {};

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const key = getPropertyName(property.name);

    if (!key) {
      continue;
    }

    record[key] = expressionToValue(property.initializer);
  }

  return record;
}

function getPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function expressionToValue(expression) {
  if (ts.isStringLiteral(expression)) {
    return expression.text;
  }

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map(expressionToValue);
  }

  return undefined;
}

function toPromptRecord(card) {
  return {
    id: card.id,
    name: card.name,
    output: `public/assets/cards/${card.id}.png`,
    prompt: createPrompt(card),
  };
}

function createPrompt(card) {
  const factionStyle = getFactionStyle(card.faction);
  const subject = getSubject(card);
  const abilityMood = card.abilities.length > 0
    ? `Visual hint for ability: ${card.abilities.join(", ")}.`
    : "No explicit ability iconography; focus on identity and faction mood.";

  return [
    "Use case: stylized-concept",
    "Asset type: fantasy trading card artwork, vertical portrait art without card frame or UI text",
    `Primary request: original premium card art for ${card.name}.`,
    `Subject: ${subject}.`,
    `Faction direction: ${factionStyle}.`,
    `Gameplay hint: ${card.kind} card, rows ${card.rows.join("/") || "none"}, power ${card.power}. ${abilityMood}`,
    "Composition: vertical 2:3 card-art crop, centered readable silhouette, strong face/weapon/creature focus, enough background detail for a premium card.",
    "Style: high-end dark fantasy concept art, realistic painterly rendering, dramatic rim light, detailed materials, cinematic atmosphere.",
    "Avoid: no text, no numbers, no logos, no watermark, no card border, no UI, no direct copy of existing copyrighted artwork.",
  ].join("\n");
}

function getFactionStyle(faction) {
  switch (faction) {
    case "northern-realms":
      return "war-torn northern medieval army, blue and steel accents, banners, siege smoke, disciplined battlefield realism";
    case "nilfgaardian-empire":
      return "black-and-gold imperial military, polished armor, strict hierarchy, controlled menace, sunless court intrigue";
    case "scoiatael":
      return "forest insurgents, elves and dwarves, green/brown leather, woodland ambush mood, old stone and autumn light";
    case "monsters":
      return "dark Slavic-fantasy creature horror, bogs, ruins, cold mist, sickly glow, predatory silhouette";
    default:
      return "neutral battlefield magic or equipment, readable tactical fantasy prop, strong atmospheric lighting";
  }
}

function getSubject(card) {
  if (card.kind === "special") {
    return `${card.name}, represented as a dramatic magical or tactical effect rather than a character`;
  }

  if (card.kind === "leader") {
    return `${card.name}, an imposing faction leader portrait with a commanding stance`;
  }

  return `${card.name}, interpreted as an original faction-appropriate character, unit, creature, or war machine`;
}
