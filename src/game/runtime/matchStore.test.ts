import { describe, expect, it } from "vitest";
import { createMatchFromFaction } from "../simulation/matchFlow";
import { createMatchStore } from "./matchStore";

describe("match store", () => {
  it("emits serializable match state snapshots after reducer dispatches", () => {
    const store = createMatchStore(
      createMatchFromFaction({
        id: "store-test",
        seed: "store-test",
        playerFactionId: "northern-realms",
      }),
    );
    const snapshots: string[] = [];
    const unsubscribe = store.subscribe((state) => {
      snapshots.push(state.phase);
    });

    store.dispatch({
      type: "finish-redraw",
      playerId: "player",
    });
    unsubscribe();
    store.dispatch({
      type: "finish-redraw",
      playerId: "opponent",
    });

    expect(snapshots).toEqual(["redraw", "redraw"]);
    expect(store.getState().phase).toBe("playing");
  });
});
