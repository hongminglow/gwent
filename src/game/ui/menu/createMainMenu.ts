import { FACTIONS } from "../../data/factions";
import type { FactionId } from "../../simulation/types";
import { createDeckPreviewModel, type DeckPreviewModel } from "./deckPreview";

export type MainMenu = {
  dispose: () => void;
  hide: () => void;
  hideLoading: () => void;
  setSelectedFaction: (factionId: FactionId) => void;
  show: () => void;
  showLoading: (factionId: FactionId) => void;
};

export type MainMenuOptions = {
  onStartMatch: (factionId: FactionId) => void;
};

export function createMainMenu(root: HTMLElement, options: MainMenuOptions): MainMenu {
  const shell = document.createElement("section");
  shell.className = "main-menu";
  shell.setAttribute("aria-label", "Main menu");

  const stage = document.createElement("div");
  stage.className = "main-menu__stage";

  const masthead = document.createElement("div");
  masthead.className = "main-menu__masthead";
  const title = document.createElement("h1");
  title.className = "main-menu__title";
  title.textContent = "Oathbound";
  const subtitle = document.createElement("p");
  subtitle.className = "main-menu__subtitle";
  subtitle.textContent = "Choose a faction and enter a best-of-three row battle.";
  masthead.append(title, subtitle);

  const factionGrid = document.createElement("div");
  factionGrid.className = "main-menu__factions";

  const preview = document.createElement("aside");
  preview.className = "main-menu__preview";
  preview.setAttribute("aria-label", "Deck preview");

  const actions = document.createElement("div");
  actions.className = "main-menu__actions";
  const startButton = document.createElement("button");
  startButton.className = "main-menu__start";
  startButton.type = "button";
  startButton.textContent = "Start Match";
  actions.append(startButton);

  stage.append(masthead, factionGrid, preview, actions);
  shell.append(stage);

  const loading = document.createElement("div");
  loading.className = "match-loading";
  loading.hidden = true;
  const loadingPanel = document.createElement("div");
  loadingPanel.className = "match-loading__panel";
  const loadingTitle = document.createElement("h2");
  loadingTitle.className = "match-loading__title";
  const loadingMeta = document.createElement("p");
  loadingMeta.className = "match-loading__meta";
  const loadingBar = document.createElement("div");
  loadingBar.className = "match-loading__bar";
  loadingBar.appendChild(document.createElement("span"));
  loadingPanel.append(loadingTitle, loadingMeta, loadingBar);
  loading.appendChild(loadingPanel);
  shell.appendChild(loading);

  root.appendChild(shell);

  let selectedFactionId: FactionId = "northern-realms";
  const factionButtons = new Map<FactionId, HTMLButtonElement>();

  for (const faction of FACTIONS) {
    const button = document.createElement("button");
    button.className = "faction-option";
    button.type = "button";
    button.style.setProperty("--faction-accent", faction.accentColor);
    button.innerHTML = `
      <span class="faction-option__name">${faction.name}</span>
      <span class="faction-option__identity">${faction.tacticalIdentity}</span>
      <span class="faction-option__perk">${faction.perk}</span>
    `;
    button.addEventListener("click", () => setSelectedFaction(faction.id));
    factionButtons.set(faction.id, button);
    factionGrid.appendChild(button);
  }

  startButton.addEventListener("click", () => {
    showLoading(selectedFactionId);
    options.onStartMatch(selectedFactionId);
  });

  const setSelectedFaction = (factionId: FactionId) => {
    selectedFactionId = factionId;
    const previewModel = createDeckPreviewModel(factionId);

    for (const [buttonFactionId, button] of factionButtons) {
      button.classList.toggle("faction-option--selected", buttonFactionId === factionId);
      button.setAttribute("aria-pressed", String(buttonFactionId === factionId));
    }

    renderDeckPreview(preview, previewModel);
  };

  function showLoading(factionId: FactionId) {
    const previewModel = createDeckPreviewModel(factionId);
    loadingTitle.textContent = "Preparing match";
    loadingMeta.textContent = `${previewModel.faction.name} versus a random rival faction.`;
    loading.hidden = false;
    shell.classList.add("main-menu--loading");
  }

  setSelectedFaction(selectedFactionId);

  return {
    dispose() {
      shell.remove();
    },
    hide() {
      shell.hidden = true;
    },
    hideLoading() {
      loading.hidden = true;
      shell.classList.remove("main-menu--loading");
    },
    setSelectedFaction,
    show() {
      shell.hidden = false;
      loading.hidden = true;
      shell.classList.remove("main-menu--loading");
    },
    showLoading,
  };
}

function renderDeckPreview(root: HTMLElement, preview: DeckPreviewModel) {
  const topCards = preview.cards.slice(0, 10);
  root.innerHTML = "";

  const header = document.createElement("div");
  header.className = "deck-preview__header";
  header.innerHTML = `
    <span class="deck-preview__eyebrow">Deck Preview</span>
    <h2 class="deck-preview__title">${preview.faction.name}</h2>
    <p class="deck-preview__leader">Leader: ${preview.leader.name}</p>
  `;

  const stats = document.createElement("div");
  stats.className = "deck-preview__stats";
  stats.append(
    createStat("Units", `${preview.counts.units}`),
    createStat("Specials", `${preview.counts.specials}`),
    createStat("Cards", `${preview.counts.total}`),
    createStat("Power", `${preview.counts.totalPower}`),
  );

  const abilityList = document.createElement("div");
  abilityList.className = "deck-preview__abilities";
  abilityList.textContent = preview.abilitySummary.length > 0
    ? preview.abilitySummary.join(" / ")
    : "No major ability clusters.";

  const cardList = document.createElement("div");
  cardList.className = "deck-preview__cards";
  for (const card of topCards) {
    const item = document.createElement("div");
    item.className = "deck-preview__card";
    item.innerHTML = `
      <span>${card.count > 1 ? `${card.count}x ` : ""}${card.name}</span>
      <span>${card.type === "special" ? "Special" : card.power}</span>
    `;
    cardList.appendChild(item);
  }

  root.append(header, stats, abilityList, cardList);
}

function createStat(label: string, value: string): HTMLElement {
  const stat = document.createElement("div");
  stat.className = "deck-preview__stat";
  stat.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return stat;
}
