import type { MatchPreviewState } from "../../simulation/types";

export type Hud = {
  dispose: () => void;
};

export function createHud(root: HTMLElement, state: MatchPreviewState): Hud {
  const shell = document.createElement("main");
  shell.className = "app-shell";

  const hud = document.createElement("section");
  hud.className = "hud";
  hud.setAttribute("aria-label", "Match HUD");

  hud.innerHTML = `
    <div class="hud__status">
      <h1 class="hud__title">${state.appName}</h1>
      <p class="hud__meta">Phase 1 foundation preview. Selected faction: ${state.selectedFaction.name}.</p>
      <p class="hud__meta">${state.selectedFaction.perk}</p>
    </div>
    <div class="hud__strip" aria-label="Match setup">
      <div class="hud__chip">
        <span class="hud__chip-label">Rows</span>
        <span class="hud__chip-value">${state.rows.length} x 2</span>
      </div>
      <div class="hud__chip">
        <span class="hud__chip-label">Opening Hand</span>
        <span class="hud__chip-value">10</span>
      </div>
      <div class="hud__chip">
        <span class="hud__chip-label">Redraw</span>
        <span class="hud__chip-value">2</span>
      </div>
      <div class="hud__chip">
        <span class="hud__chip-label">Rounds</span>
        <span class="hud__chip-value">Best of 3</span>
      </div>
    </div>
    <div class="hud__hint">Foundation scaffold: renderer, HUD, input, assets, diagnostics, and faction data boundaries are active.</div>
  `;

  shell.appendChild(hud);
  root.appendChild(shell);

  return {
    dispose() {
      shell.remove();
    },
  };
}
