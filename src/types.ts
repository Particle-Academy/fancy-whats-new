import type { ReactNode } from "react";
import type { AppUpdateFeature } from "@particle-academy/fancy-app-update/cards";

/** A card's one link: where a welcome, a post or a feature takes the person. */
export interface WhatsNewCardAction {
  label: ReactNode;
  /** Followed as a normal link. Unsafe schemes (`javascript:`, ...) render no link. */
  href: string;
}

/**
 * One card. The same shape as fancy-app-update's cards, so cards written for
 * one work in the other -- `{ id?, title, description?, image?, imageAlt?,
 * imageDark? }` -- plus an optional link.
 */
export interface WhatsNewCard extends AppUpdateFeature {
  action?: WhatsNewCardAction;
}

/**
 * A group of cards that are new together: a release, a post, a welcome,
 * a batch of announcements. Whatever the host says it is.
 */
export interface WhatsNewGroup {
  /**
   * The cursor: a version, a post id, a timestamp. Compared for equality only,
   * never ordered, and stored as a string (`42` and `"42"` are one cursor).
   */
  id: string | number;
  /** Shown above each of its cards, when given. */
  label?: string;
  /** Shown beside the label, as given (`"2026-10-21"`, `"2 hours ago"`, ...). */
  date?: string;
  /** Its cards. A group with none is skipped. */
  cards: readonly WhatsNewCard[];
}

/**
 * Groups newer than `since`, NEWEST FIRST. `since` is the newest cursor this
 * person was shown, or `null` when they have never been shown one (a first
 * visit, or an on-demand `open`) -- return a short, recent list then;
 * `firstVisit` decides how much of it shows.
 */
export type WhatsNewLoader = (since: string | null) => readonly WhatsNewGroup[] | Promise<readonly WhatsNewGroup[]>;

/** Where the last-seen cursor lives. Either half may be async. */
export interface WhatsNewStorage {
  /** The last cursor seen, or `null` for someone who has never been shown one. */
  load(): string | null | Promise<string | null>;
  /** Remember `cursor` as the newest this person has been shown. */
  save(cursor: string): void | Promise<void>;
}

export type MissedMode = "all" | "latest";
export type FirstVisitMode = "latest" | "none" | "all";
