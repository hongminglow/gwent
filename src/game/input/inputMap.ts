import type { InputAction } from "./actions";

export function actionFromKeyboardEvent(event: KeyboardEvent): InputAction | null {
  if (event.key === "Escape") {
    return { type: "cancel-selection" };
  }

  if (event.key.toLowerCase() === "p") {
    return { type: "pass-round" };
  }

  if (event.key.toLowerCase() === "l") {
    return { type: "use-leader" };
  }

  if (event.key === "`") {
    return { type: "toggle-debug" };
  }

  return null;
}
