# Card Art Pipeline

Oathbound now supports real card artwork through static assets in `public/assets/cards`.

## Runtime Contract

- Every card definition has an `artKey` like `cards.mo-fiend`.
- `src/game/assets/manifest.ts` maps that key to `/assets/cards/<card-id>.png`.
- The Three.js renderer tries to load that PNG for the card face.
- If an image is missing, the existing generated placeholder texture remains as a fallback, so the game still runs while the art set is incomplete.

## Current Seed Asset

The first generated monster sample is installed as:

```text
public/assets/cards/mo-fiend.png
```

This means the Fiend card now uses real generated art in-game.

## Generating The Full Set

Run:

```powershell
npm run art:plan
```

This writes:

```text
docs/card-art-prompts.json
```

Each record contains:

- `id`: card id from the data set.
- `name`: display name.
- `output`: expected project asset path.
- `prompt`: generation prompt shaped for vertical premium card art.

Generate cards faction by faction, then save each selected image to the matching `output` path.

## Recommended Batch Order

1. Monsters, because the visual identity has the highest impact.
2. Neutral special/weather cards, because effects are reusable and easy to read.
3. Northern Realms.
4. Nilfgaardian Empire.
5. Scoia'tael.
6. Leaders and legendary heroes as a final premium pass.

## Art Rules

- Use vertical card art only, with no card frame, no UI, no numbers, and no printed text.
- Keep the subject readable at small card size.
- Use faction-specific color and silhouette language.
- Ability hints should be visual, not textual.
- Save as PNG for now. A later optimization pass can convert the final approved set to WebP or AVIF.
