import "./style.css";
import { createInitialMatchPreview } from "./game/simulation/initialState";
import { createHud } from "./game/ui/hud/createHud";
import { createThreeApp } from "./game/renderer/threeApp";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const previewState = createInitialMatchPreview("northern-realms");
const hud = createHud(root, previewState);
const threeApp = createThreeApp(root, previewState);

threeApp.start();

window.addEventListener("beforeunload", () => {
  threeApp.dispose();
  hud.dispose();
});
