import { describe, expect, it } from "vitest";
import { selectNew, withCards } from "../select";
import type { WhatsNewGroup } from "../types";

/*
 * Which groups one page load shows, and which cursor it records as seen.
 * Cursors are compared for equality only: a version, a post id, a timestamp.
 */

const g = (id: string | number, cards: number): WhatsNewGroup => ({
  id,
  cards: Array.from({ length: cards }, (_, i) => ({ title: `${id}-${i}` })),
});

const G4 = g("4", 0); // nothing to say
const G3 = g("3", 2);
const G2 = g("2", 1);
const G1 = g("1", 1);

const ids = (list: readonly WhatsNewGroup[]) => list.map((x) => String(x.id));

describe("withCards", () => {
  it("skips groups with no cards, and anything that is not a group", () => {
    expect(ids(withCards([G4, G3, G2]))).toEqual(["3", "2"]);
    expect(withCards([null, { id: "x" }, { id: "y", cards: "no" }] as never)).toEqual([]);
  });
});

describe("selectNew -- a returning visitor", () => {
  it("missed='all' (default) shows every newer group with cards, newest first", () => {
    const s = selectNew([G3, G2], "1", {});
    expect(ids(s.show)).toEqual(["3", "2"]);
  });

  it("missed='latest' shows the newest group with cards only", () => {
    const s = selectNew([G4, G3, G2], "1", { missed: "latest" });
    expect(ids(s.show)).toEqual(["3"]);
  });

  it("records the NEWEST CURSOR SHOWN, not a newer empty group above it", () => {
    // An empty group may still get cards (a post being written); recording past
    // it would lose them for good.
    expect(selectNew([G4, G3, G2], "1", {}).seen).toBe("3");
  });

  it("records nothing when there is nothing to show", () => {
    const s = selectNew([G4], "3", {});
    expect(s.show).toEqual([]);
    expect(s.seen).toBeNull();
  });

  it("cuts an inclusive answer at `since`, so what was seen is never shown again", () => {
    const s = selectNew([G3, G2, G1], "2", {});
    expect(ids(s.show)).toEqual(["3"]);
  });

  it("compares numeric and string cursors as the same cursor", () => {
    const s = selectNew([g(30, 1), g(20, 1), g(10, 1)], "20", {});
    expect(ids(s.show)).toEqual(["30"]);
    expect(s.seen).toBe("30");
  });

  it("an unknown `since` trusts the loader: everything it returned is new", () => {
    expect(ids(selectNew([G3, G2], "zzz", {}).show)).toEqual(["3", "2"]);
  });

  it("a malformed answer shows nothing and records nothing", () => {
    expect(selectNew("oops" as never, "1", {})).toEqual({ show: [], seen: null });
  });
});

describe("selectNew -- a first visit (since is null)", () => {
  it("firstVisit='latest' (default) shows the newest group with cards", () => {
    const s = selectNew([G4, G3, G2], null, {});
    expect(ids(s.show)).toEqual(["3"]);
    expect(s.seen).toBe("3");
  });

  it("firstVisit='all' shows every group with cards", () => {
    expect(ids(selectNew([G3, G2, G1], null, { firstVisit: "all" }).show)).toEqual(["3", "2", "1"]);
  });

  it("firstVisit='none' shows nothing but records the newest cursor as a baseline", () => {
    // Without a baseline every visit is a first visit, and "newer than last
    // seen" never starts.
    const s = selectNew([G4, G3], null, { firstVisit: "none" });
    expect(s.show).toEqual([]);
    expect(s.seen).toBe("4");
  });

  it("a first visit with only empty groups still records a baseline", () => {
    expect(selectNew([G4], null, {})).toEqual({ show: [], seen: "4" });
  });

  it("missed does not narrow a first visit: firstVisit decides it", () => {
    expect(ids(selectNew([G3, G2], null, { firstVisit: "all", missed: "latest" }).show)).toEqual(["3", "2"]);
  });

  it("nothing at all: no baseline to record", () => {
    expect(selectNew([], null, {})).toEqual({ show: [], seen: null });
  });
});
