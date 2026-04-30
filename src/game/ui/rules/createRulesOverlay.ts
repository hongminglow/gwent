import { RULES_SECTIONS } from "./rulesContent";

export type RulesOverlay = {
  dispose: () => void;
  hide: () => void;
  isOpen: () => boolean;
  root: HTMLElement;
  show: () => void;
  toggle: () => void;
};

export type RulesOverlayOptions = {
  onOpenChange?: (open: boolean) => void;
};

export function createRulesOverlay(options: RulesOverlayOptions = {}): RulesOverlay {
  const root = document.createElement("section");
  root.className = "rules-overlay";
  root.hidden = true;
  root.setAttribute("aria-label", "Game rules");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("role", "dialog");
  root.tabIndex = -1;

  const panel = document.createElement("article");
  panel.className = "rules-overlay__panel";

  const header = document.createElement("header");
  header.className = "rules-overlay__header";
  const headingGroup = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "rules-overlay__eyebrow";
  eyebrow.textContent = "Handbook";
  const title = document.createElement("h2");
  title.textContent = "How To Play";
  const intro = document.createElement("p");
  intro.textContent = "A compact rules reference for the full match loop, card rows, scoring, and abilities.";
  headingGroup.append(eyebrow, title, intro);

  const closeButton = document.createElement("button");
  closeButton.className = "rules-overlay__close";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => hide());
  header.append(headingGroup, closeButton);

  const body = document.createElement("div");
  body.className = "rules-overlay__body";
  for (const section of RULES_SECTIONS) {
    const sectionElement = document.createElement("section");
    sectionElement.className = "rules-overlay__section";
    const sectionTitle = document.createElement("h3");
    sectionTitle.textContent = section.title;
    const list = document.createElement("ul");

    for (const item of section.items) {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.appendChild(listItem);
    }

    sectionElement.append(sectionTitle, list);
    body.appendChild(sectionElement);
  }

  panel.append(header, body);
  root.appendChild(panel);

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      hide();
    }
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (root.hidden) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      hide();
    }

    event.stopImmediatePropagation();
  };

  window.addEventListener("keydown", onKeyDown, true);

  function show() {
    root.hidden = false;
    options.onOpenChange?.(true);
    closeButton.focus();
  }

  function hide() {
    root.hidden = true;
    options.onOpenChange?.(false);
  }

  return {
    dispose() {
      window.removeEventListener("keydown", onKeyDown, true);
      root.remove();
    },
    hide,
    isOpen() {
      return !root.hidden;
    },
    root,
    show,
    toggle() {
      if (root.hidden) {
        show();
      } else {
        hide();
      }
    },
  };
}
