import type { WhatsNewStorage } from "./types";

export const DEFAULT_STORAGE_KEY = "fancy-whats-new:seen";

/** The browser's localStorage, or null where there is none (SSR) or it is blocked. */
function area(): Storage | null {
  try {
    return typeof localStorage === "undefined" || localStorage === null ? null : localStorage;
  } catch {
    // Some browsers throw on merely READING `localStorage` when storage is disabled.
    return null;
  }
}

/**
 * The default store: the last cursor seen, in this browser's localStorage
 * under `key`. Creating it touches nothing, so it is safe during SSR;
 * `<WhatsNew>` only calls it from effects. A blocked or full storage reads as
 * "never seen" and a failed write is dropped -- a notice is never worth an
 * exception.
 *
 * It is per BROWSER. For people who use several devices, store the cursor on
 * their account instead (`createHttpStorage` in fancy-inertia, or any `{ load, save }`).
 */
export function localStorageStore(key: string = DEFAULT_STORAGE_KEY): WhatsNewStorage {
  return {
    load() {
      try {
        return area()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    save(cursor: string) {
      try {
        area()?.setItem(key, cursor);
      } catch {
        // Private mode or a full quota: they will see the notice again, which is
        // the honest outcome of not being able to remember.
      }
    },
  };
}
