import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, type ButtonColor } from "@particle-academy/react-fancy";
import {
  FeatureCards,
  LINK_STYLE,
  type FeatureCard,
  type FeatureCardsPosition,
} from "@particle-academy/fancy-app-update/cards";
import { cursorOf, selectNew, withCards } from "./select";
import { localStorageStore } from "./storage";
import type {
  FirstVisitMode,
  MissedMode,
  WhatsNewCard,
  WhatsNewGroup,
  WhatsNewLoader,
  WhatsNewStorage,
} from "./types";

/** The data-* prefix of every handle: `data-fancy-whats-new-card`, `-control`, ... */
export const NAMESPACE = "fancy-whats-new";

export type WhatsNewPosition = FeatureCardsPosition;

/** Every word a person sees. */
export interface WhatsNewLabels {
  /** The button that closes the notice. Default `"got it"`. */
  dismiss?: ReactNode;
  /** The close button's accessible name. Default `"Close"`. */
  close?: string;
  /** Back one card. Default `"prev"`. */
  previous?: string;
  /** On one card. Default `"next"`. */
  next?: string;
  /** The notice's accessible name. Default `"What's new"`. */
  notice?: string;
  /** The line above each card. Default: the group's `label`, or none. */
  group?: (group: WhatsNewGroup) => ReactNode;
}

export interface WhatsNewApi {
  /** `"auto"` on a page load; `"open"` when `open` asked for it. */
  mode: "auto" | "open";
  /** The groups being shown, newest first. */
  groups: readonly WhatsNewGroup[];
  /** Close it (and hand `open` back through `onOpenChange`). */
  close: () => void;
}

export interface WhatsNewCardState {
  group: WhatsNewGroup;
  index: number;
  count: number;
  isFront: boolean;
}

export interface WhatsNewProps {
  /**
   * Groups newer than `since`, NEWEST FIRST -- `since` is the newest cursor this
   * person was shown, `null` on a first visit. Called once per page load, after
   * mount (never during SSR), and with `null` the first time `open` is set while
   * nothing is showing.
   */
  load: WhatsNewLoader;
  /** `"all"` (default) stacks every newer group, each card labelled; `"latest"` shows the newest only. */
  missed?: MissedMode;
  /** A first visit (nothing seen yet): `"latest"` (default), `"none"` (records a baseline), or `"all"`. */
  firstVisit?: FirstVisitMode;
  /** Where the last-seen cursor lives. Default: localStorage under `storageKey`. */
  storage?: WhatsNewStorage;
  /** The default store's localStorage key. Default `"fancy-whats-new:seen"`. */
  storageKey?: string;
  /**
   * Show the current cards on demand (a button): the page-load notice if it is
   * up, otherwise the newest group. Controlled -- set it back from `onOpenChange`.
   */
  open?: boolean;
  /** Called with `false` when the person closes a notice `open` is showing. */
  onOpenChange?: (open: boolean) => void;
  /** Called after a cursor is recorded as seen. */
  onSeen?: (cursor: string) => void;
  /** Called when the person closes the notice. */
  onClose?: () => void;
  labels?: WhatsNewLabels;
  /** The fading "scroll" hint over two or more cards. `false` turns it off; a string replaces it. */
  scrollHint?: boolean | string;
  /** react-fancy colour of the "got it" button. Default `"violet"`. */
  color?: ButtonColor;
  /** A screen position, or `"inline"`. Default `"bottom-right"`. */
  position?: WhatsNewPosition;
  /** Merged over the position's preset. */
  style?: CSSProperties;
  /** Classes on the notice. */
  className?: string;
  /** Classes on each card. */
  cardClassName?: string;
  /** How many cards show behind the front one. Default 2. */
  depth?: number;
  /** How far each card behind peeks out, in px. Default 8. */
  offset?: number;
  /**
   * Replace a card's image, title and description. Its label line, its link,
   * close, "got it" and prev / next stay.
   */
  renderCard?: (card: WhatsNewCard, state: WhatsNewCardState) => ReactNode;
  /** Replace the whole notice. */
  render?: (api: WhatsNewApi) => ReactNode;
}

type GroupOf = Map<string, WhatsNewGroup>;

/**
 * Show these once, stacked, then remember they were seen: on the first load
 * after a refresh or login, the groups of cards newer than what this person
 * last saw. A release's features, a welcome, new posts -- whatever the host's
 * `load` returns.
 *
 * ```tsx
 * <WhatsNew load={(since) => fetch(`/notices?since=${since ?? ""}`).then((r) => r.json())} />
 * ```
 */
export function WhatsNew({
  load,
  missed = "all",
  firstVisit = "latest",
  storage,
  storageKey,
  open,
  onOpenChange,
  onSeen,
  onClose,
  labels = {},
  scrollHint = true,
  color = "violet",
  position = "bottom-right",
  style,
  className,
  cardClassName,
  depth,
  offset,
  renderCard,
  render,
}: WhatsNewProps) {
  const {
    dismiss: dismissLabel = "got it",
    close: closeLabel = "Close",
    previous: previousLabel = "prev",
    next: nextLabel = "next",
    notice: noticeLabel = "What's new",
    group: groupLabel = (g: WhatsNewGroup) => g.label,
  } = labels;

  // Creating the default store touches nothing; it is only called from effects.
  const store = useMemo(() => storage ?? localStorageStore(storageKey), [storage, storageKey]);
  // Latest props for effects that must not re-run when a caller passes a new arrow each render.
  const latest = useRef({ load, store, onSeen, missed, firstVisit });
  latest.current = { load, store, onSeen, missed, firstVisit };

  // ---- recording "seen" ---------------------------------------------------
  const saved = useRef<string | null>(null);
  const save = (cursor: string | null) => {
    if (cursor === null || saved.current === cursor) return;
    saved.current = cursor;
    const { store: s, onSeen: done } = latest.current;
    Promise.resolve()
      .then(() => s.save(cursor))
      .then(
        () => done?.(cursor),
        () => {
          // Not remembered: a later show or close tries again.
          if (saved.current === cursor) saved.current = null;
        },
      );
  };

  // ---- the page load ------------------------------------------------------
  const [auto, setAuto] = useState<{ show: WhatsNewGroup[]; seen: string | null } | null>(null);
  const [autoClosed, setAutoClosed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { store: s, load: get, missed: m, firstVisit: f } = latest.current;
      let since: string | null;
      try {
        const raw = await s.load();
        since = raw == null ? null : String(raw);
      } catch {
        // A store that cannot be read may belong to someone who has seen
        // everything. Showing them a first-visit notice is the false positive.
        return;
      }
      let list: readonly WhatsNewGroup[];
      try {
        list = await get(since);
      } catch {
        return;
      }
      if (!alive) return;
      const picked = selectNew(list, since, { missed: m, firstVisit: f });
      if (picked.show.length === 0) {
        // Nothing to show; a first visit still records its baseline.
        save(picked.seen);
        return;
      }
      setAuto(picked);
    })();
    return () => {
      alive = false;
    };
    // Once per mount: a page load is the unit of "newer than last seen".
  }, []);

  const autoUp = auto !== null && !autoClosed;

  // ---- on demand ----------------------------------------------------------
  const [shut, setShut] = useState(false);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setShut(false);
  }
  const onDemand = open === true && !shut;

  const [newest, setNewest] = useState<WhatsNewGroup | null | undefined>(undefined);
  const asked = useRef(false);
  const answered = useRef(false);
  useEffect(() => {
    // While the page-load notice is up, it IS the current cards.
    if (!onDemand || autoUp || asked.current) return;
    asked.current = true;
    let alive = true;
    Promise.resolve()
      .then(() => latest.current.load(null))
      .then(
        (list) => {
          if (!alive) return;
          answered.current = true;
          setNewest(Array.isArray(list) ? (withCards(list)[0] ?? null) : null);
        },
        () => {
          if (!alive) return;
          answered.current = true;
          setNewest(null);
        },
      );
    return () => {
      alive = false;
      // Unmounted (or StrictMode's rehearsal) before it answered: ask again next time.
      if (!answered.current) asked.current = false;
    };
  }, [onDemand, autoUp]);

  // ---- what is showing ----------------------------------------------------
  let mode: "auto" | "open" | null = null;
  let groups: WhatsNewGroup[] = [];
  let seen: string | null = null;
  if (autoUp) {
    mode = "auto";
    groups = auto.show;
    seen = auto.seen;
  } else if (onDemand && newest) {
    mode = "open";
    groups = [newest];
    seen = cursorOf(newest);
  }

  // ---- "seen" on show -----------------------------------------------------
  useEffect(() => {
    if (mode === null || typeof document === "undefined") return;
    if (document.visibilityState !== "hidden") {
      save(seen);
      return;
    }
    // A notice in a background tab has not been seen. Record it once the tab is looked at.
    const onVisible = () => {
      if (document.visibilityState !== "hidden") save(seen);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [mode, seen]);

  if (typeof document === "undefined" || mode === null) return null;

  /** Closing closes everything showing. */
  const close = () => {
    save(seen);
    if (autoUp) setAutoClosed(true);
    if (open) {
      setShut(true);
      onOpenChange?.(false);
    }
    onClose?.();
  };

  if (render) return <>{render({ mode, groups, close })}</>;

  const eyebrow = (group: WhatsNewGroup): ReactNode => {
    const name = groupLabel(group);
    if (name == null && !group.date) return undefined;
    return (
      <>
        {name != null ? (
          <span {...{ [`data-${NAMESPACE}-group-label`]: "" }} style={{ fontWeight: 600, opacity: 0.75 }}>
            {name}
          </span>
        ) : null}
        {group.date ? (
          <span {...{ [`data-${NAMESPACE}-date`]: "" }} style={{ opacity: 0.55 }}>
            {group.date}
          </span>
        ) : null}
      </>
    );
  };

  const link = (card: WhatsNewCard): ReactNode =>
    card.action ? (
      <div style={{ marginTop: 6 }}>
        <Button
          variant="ghost"
          size="xs"
          href={card.action.href}
          onClick={close}
          // Underlined at rest: unlike prev / next it leaves the notice, and must read as a link.
          style={{ ...LINK_STYLE, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}
          {...{ [`data-${NAMESPACE}-link`]: "", [`data-${NAMESPACE}-control`]: "action" }}
        >
          {card.action.label}
        </Button>
      </div>
    ) : null;

  const groupOf: GroupOf = new Map();
  const cardOf = new Map<string, WhatsNewCard>();
  const cards: FeatureCard[] = groups.flatMap((group) =>
    group.cards.map((card, i) => {
      const id = `${cursorOf(group)}:${card.id ?? i}`;
      groupOf.set(id, group);
      cardOf.set(id, card);
      const { action: _action, ...face } = card;
      return {
        ...face,
        id,
        description: card.action ? (
          <>
            {card.description}
            {link(card)}
          </>
        ) : (
          card.description
        ),
        eyebrow: eyebrow(group),
        attributes: { [`data-${NAMESPACE}-group`]: cursorOf(group) } as Record<`data-${string}`, string>,
      };
    }),
  );

  return (
    <FeatureCards
      cards={cards}
      onClose={close}
      action={{ label: dismissLabel, onClick: close, control: "dismiss" }}
      namespace={NAMESPACE}
      resetKey={`${mode}:${groups.map(cursorOf).join(",")}`}
      closeLabel={closeLabel}
      previousLabel={previousLabel}
      nextLabel={nextLabel}
      scrollHint={scrollHint}
      color={color}
      position={position}
      style={style}
      className={className}
      cardClassName={cardClassName}
      depth={depth}
      offset={offset}
      label={noticeLabel}
      attributes={{ [`data-${NAMESPACE}-mode`]: mode }}
      renderFeature={
        renderCard
          ? (feature, state) => {
              const id = feature.id ?? "";
              const card = cardOf.get(id);
              const group = groupOf.get(id);
              if (!card || !group) return null;
              return (
                <>
                  {renderCard(card, { ...state, group })}
                  {link(card)}
                </>
              );
            }
          : undefined
      }
    />
  );
}

WhatsNew.displayName = "WhatsNew";
