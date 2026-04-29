import type { RowId } from "../simulation/types";

export type InputAction =
  | { type: "select-card"; cardInstanceId: string }
  | { type: "inspect-card"; cardInstanceId: string }
  | { type: "play-card"; cardInstanceId: string; row?: RowId }
  | { type: "cancel-selection" }
  | { type: "pass-round" }
  | { type: "use-leader" }
  | { type: "toggle-debug" };
