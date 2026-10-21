/**
 * @particle-academy/fancy-whats-new
 *
 * Show these once, stacked, then remember they were seen. On the first load
 * after a refresh or login, the groups of cards newer than what this person last
 * saw: a release's features, a welcome, new posts -- whatever the host's loader
 * returns. Remembers the newest cursor shown (localStorage, or any `{ load, save }`
 * store), and opens on demand from a button.
 *
 * The cards are fancy-app-update's (`FeatureCards`, from
 * `@particle-academy/fancy-app-update/cards`), so its refresh notice and this
 * one look and behave the same.
 */
export { WhatsNew, NAMESPACE } from "./WhatsNew";
export type { WhatsNewProps, WhatsNewApi, WhatsNewLabels, WhatsNewPosition, WhatsNewCardState } from "./WhatsNew";

export { localStorageStore, DEFAULT_STORAGE_KEY } from "./storage";
export { selectNew, withCards, cursorOf } from "./select";
export type { Selection } from "./select";

export type {
  WhatsNewCard,
  WhatsNewCardAction,
  WhatsNewGroup,
  WhatsNewLoader,
  WhatsNewStorage,
  MissedMode,
  FirstVisitMode,
} from "./types";
