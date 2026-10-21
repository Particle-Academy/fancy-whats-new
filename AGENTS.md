# AGENTS.md — fancy-whats-new

"Show these once, stacked, then remember they were seen", for any React app.
`CLAUDE.md` symlinks here. This file describes **this package's code**; process
rules live in the envelope's `RULES.md`.

**It is general-purpose.** A group is a release, a welcome, a post, anything.
Never let "release", "version" or "feature" into a public name, type or default
label: the owner scoped it that way on 2026-10-21.

## Layout

- `src/WhatsNew.tsx` — the component: loads the last-seen cursor, asks
  `load(since)`, shows the newer groups, records "seen"; on demand (`open`) shows
  the page-load notice if it is up, otherwise `load(null)`'s newest group.
- `src/select.ts` — pure: which groups a load shows and which cursor it records.
  Every `missed` x `firstVisit` combination is tested here.
- `src/storage.ts` — the default `localStorage` store.
- `src/types.ts` — `WhatsNewGroup`, `WhatsNewCard`, the loader, `WhatsNewStorage`.

## Invariants

- **The cards are NOT in this repo.** They are `FeatureCards` from
  `@particle-academy/fancy-app-update/cards`, external in `tsup.config.ts`. Never
  copy them here: a fix there must reach both notices. A card change is a
  fancy-app-update change; run this suite against its local build first.
- **Every handle is `data-fancy-whats-new-*`** (`NAMESPACE`, passed to
  `FeatureCards` as `namespace`).
- **Nothing touches storage or calls `load` during render.** Both run in effects,
  so SSR renders nothing and reads nothing.
- **A failure is never news.** A store that cannot load shows nothing (the person
  may have seen everything); a loader that throws shows nothing.
- **"Seen" is recorded on SHOW, in a visible tab, and is the newest cursor
  SHOWN** — not the newest returned: an empty group above it may still get cards.
  A first visit that shows nothing records the newest returned as a baseline.
  Written once per cursor (`saved` ref).
- **On demand is one thing only**: show the current cards. No paging, no menu, no
  history — removed from the 0.1.0 scaffold by the owner's scope, do not re-add.
- **`load(null)` for `open` is asked once per mount** (`asked` / `answered`
  refs). Re-arm only if it never answered; reading state in the effect cleanup
  reads a stale closure and asks twice (a test pins it).
- **A card's link is a react-fancy `Button` with `href`**, so unsafe schemes are
  sanitised there; following it closes the notice. It is put in the card's
  `description` slot (or after `renderCard`'s output), since `FeatureCards` has
  one shared action, not one per card.
- The fancy-app-update traps carry over: no Tailwind class that react-fancy's dist
  does not contain; Button has `transition-all` (read computed colours 200ms+
  later); jsdom does not restyle on an attribute change (set `.dark` before
  rendering).

## Checking a change

`npm test` (vitest + jsdom). jsdom does not lay out: look at it in a real
browser with Tailwind built from react-fancy's `dist`.
