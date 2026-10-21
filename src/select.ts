import type { FirstVisitMode, MissedMode, WhatsNewGroup } from "./types";

/** A group's cursor as stored: `42` and `"42"` are the same cursor. */
export function cursorOf(group: WhatsNewGroup): string {
  return String(group.id);
}

/** Groups with at least one card. Anything that is not a group is dropped too. */
export function withCards(list: readonly WhatsNewGroup[]): WhatsNewGroup[] {
  return list.filter(
    (g) => g != null && (typeof g.id === "string" || typeof g.id === "number") && Array.isArray(g.cards) && g.cards.length > 0,
  );
}

export interface Selection {
  /** The groups to show, newest first. */
  show: WhatsNewGroup[];
  /** The cursor to record as seen once `show` is on screen, or `null` to record nothing. */
  seen: string | null;
}

/**
 * What one page load shows, from the loader's answer (newest first).
 *
 * The answer is cut at `since` if the loader returned the seen group too (an
 * inclusive `since` is an easy mistake, and its symptom would be showing someone
 * what they already saw). Cursors are compared for equality only.
 *
 * `seen` is the NEWEST CURSOR SHOWN. An empty group above it is not recorded:
 * it may still get cards (a post being written), and recording past it would
 * lose them for good. The one exception is a first visit that shows nothing,
 * which records the newest cursor returned as a baseline -- without one, every
 * visit would be a first visit and "newer than last seen" would never start.
 */
export function selectNew(
  list: readonly WhatsNewGroup[],
  since: string | null,
  { missed = "all", firstVisit = "latest" }: { missed?: MissedMode; firstVisit?: FirstVisitMode },
): Selection {
  if (!Array.isArray(list)) return { show: [], seen: null };

  let fresh: readonly WhatsNewGroup[] = list.filter((g) => g != null);
  if (since !== null) {
    const at = fresh.findIndex((g) => String(g.id) === since);
    if (at !== -1) fresh = fresh.slice(0, at);
  }
  const shown = withCards(fresh);

  if (since === null) {
    const show = firstVisit === "none" ? [] : firstVisit === "all" ? shown : shown.slice(0, 1);
    const baseline = fresh[0] ? cursorOf(fresh[0]) : null;
    return { show, seen: show[0] ? cursorOf(show[0]) : baseline };
  }

  const show = missed === "latest" ? shown.slice(0, 1) : shown;
  return { show, seen: show[0] ? cursorOf(show[0]) : null };
}
