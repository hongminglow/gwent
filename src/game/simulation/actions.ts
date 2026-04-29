import type { CardInstanceId, PlayerId, RowId } from "./types";

export type GameAction =
  | { type: "clear-event-log" }
  | { type: "start-redraw"; playerId: PlayerId }
  | { type: "redraw-card"; playerId: PlayerId; cardInstanceId: CardInstanceId }
  | { type: "finish-redraw"; playerId: PlayerId }
  | {
      type: "play-card";
      playerId: PlayerId;
      cardInstanceId: CardInstanceId;
      rowId?: RowId;
      targetCardInstanceId?: CardInstanceId;
    }
  | { type: "pass-round"; playerId: PlayerId }
  | { type: "use-leader"; playerId: PlayerId; rowId?: RowId };
