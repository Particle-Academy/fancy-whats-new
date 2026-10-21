import { afterEach, describe, expect, it, vi } from "vitest";
import { localStorageStore, DEFAULT_STORAGE_KEY } from "../storage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("localStorageStore", () => {
  it("loads null for someone who has never been shown anything", () => {
    expect(localStorageStore().load()).toBeNull();
  });

  it("saves and loads the cursor under its key", () => {
    const store = localStorageStore();
    store.save("1.4.0");
    expect(store.load()).toBe("1.4.0");
    expect(localStorage.getItem(DEFAULT_STORAGE_KEY)).toBe("1.4.0");
  });

  it("keys are separate: two apps on one origin do not share a last-seen", () => {
    localStorageStore("app-a").save("2.0.0");
    expect(localStorageStore("app-b").load()).toBeNull();
    expect(localStorageStore("app-a").load()).toBe("2.0.0");
  });

  it("a storage that throws (private mode, quota, disabled) reads as null and never throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const store = localStorageStore();
    expect(store.load()).toBeNull();
    expect(() => store.save("1.0.0")).not.toThrow();
  });

  it("is SSR-safe: creating it touches nothing, and with no window it is inert", () => {
    vi.stubGlobal("localStorage", undefined);
    const store = localStorageStore();
    expect(store.load()).toBeNull();
    expect(() => store.save("1.0.0")).not.toThrow();
  });
});
