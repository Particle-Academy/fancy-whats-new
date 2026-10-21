# Changelog

Notable changes to `@particle-academy/fancy-whats-new`, in
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

**BREAKING** marks anything that can stop working on upgrade. This package is
pre-1.0, so breaking changes land in MINOR releases — read those entries before
upgrading. Each one says what you must do.

---

## [Unreleased]

## [0.1.0] - 2026-10-21

The first release. **Show these once, stacked, then remember they were seen**:
for release notes after an app update, a welcome message, new posts, or anything
else that needs that UX.

### Added

- **`<WhatsNew load={(since) => WhatsNewGroup[]}>`**: on the first load after a
  refresh or login, the groups of cards newer than what this person last saw.
  `since` is the newest cursor they were shown (`null` on a first visit); groups
  come back newest first, as `{ id, label?, date?, cards }`, and a group with no
  cards is skipped. Cursors (a version, a post id, a timestamp) are compared for
  equality only and stored as strings.
- **Cards** in fancy-app-update's shape (`title`, `description?`, `image?`,
  `imageDark?`, `imageAlt?`, `id?`), plus one optional link,
  `action: { label, href }`, which closes the notice when followed.
- **`missed="all" | "latest"`**: stack every newer group (each card labelled with
  its group's `label` and `date` when present), or only the newest.
- **`firstVisit="latest" | "none" | "all"`**: what a first visit shows. `"none"`
  still records a baseline.
- **`storage={{ load, save }}`**, sync or async, defaulting to `localStorage`
  under `storageKey` (SSR-safe, touched only in effects). A store that fails to
  load shows nothing.
- **Seen on show**: the newest cursor shown is recorded once the notice is on
  screen in a visible tab. The README says why, and why "shown" rather than
  "returned".
- **`open` / `onOpenChange`**: a button shows the current cards on demand (the
  page-load notice if it is up, otherwise the newest group).
- **`labels`**, `position`, `style`, `className`, `cardClassName`, `depth`,
  `offset`, `color`, `scrollHint`, `renderCard` (told the card's group),
  `render`, `onSeen`, `onClose`.
- **Stable `data-fancy-whats-new-*` handles** on the notice (with its mode), every
  card (with its group's cursor) and every control.
- **`localStorageStore(key)`, `selectNew`, `withCards`, `cursorOf`** exported for
  custom surfaces.
- The cards are fancy-app-update's `FeatureCards` (`>=0.7.0 <2.0`), imported
  rather than copied.
