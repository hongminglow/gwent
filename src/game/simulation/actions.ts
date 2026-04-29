import type { AbilityId, CardInstanceId, FactionId, PlayerId, RowId } from "./types";

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
  | { type: "use-leader"; playerId: PlayerId; rowId?: RowId }
  | {
      type: "debug-force-hand";
      playerId: PlayerId;
      definitionIds: string[];
    }
  | {
      type: "debug-spawn-card";
      playerId: PlayerId;
      definitionId: string;
      zone: "hand" | "board";
      rowId?: RowId;
    }
  | {
      type: "debug-trigger-ability";
      abilityId: AbilityId;
      playerId: PlayerId;
      rowId?: RowId;
    }
  | { type: "debug-trigger-scorch"; playerId: PlayerId; rowId?: RowId }
  | { type: "debug-trigger-slain"; playerId: PlayerId; rowId?: RowId }
  | { type: "debug-skip-round"; winnerId?: PlayerId }
  | {
      type: "debug-start-match";
      playerFactionId: FactionId;
      opponentFactionId: FactionId;
    };

export function isDebugAction(action: GameAction): boolean {
  return action.type.startsWith("debug-");
}
