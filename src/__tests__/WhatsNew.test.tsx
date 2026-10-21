import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WhatsNew, type WhatsNewGroup, type WhatsNewStorage } from "../index";

/*
 * <WhatsNew>: on a page load, the groups of cards newer than what this person
 * last saw, shown once. On demand (`open`), the current cards. Nothing here is
 * about releases: a group is whatever the host says it is -- a version, a post,
 * a welcome.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const group = (id: string | number, titles: string[], extra: Partial<WhatsNewGroup> = {}): WhatsNewGroup => ({
  id,
  cards: titles.map((title, i) => ({ id: `${id}-${i}`, title })),
  ...extra,
});

const G3 = group("v3", ["Dark mode", "Faster search"], { label: "v3", date: "2026-10-21" });
const G2 = group("v2", ["Exports to PDF"], { label: "v2" });
const G1 = group("v1", ["Keyboard shortcuts"]);
const EMPTY = group("v4", []);

/** A store held in memory, so a test sees exactly what was read and written. */
function memory(initial: string | null): WhatsNewStorage & { saved: string[] } {
  let value = initial;
  const saved: string[] = [];
  return {
    saved,
    load: vi.fn(() => value),
    save: vi.fn((v: string) => {
      value = v;
      saved.push(v);
    }),
  };
}

const root = () => document.querySelector<HTMLElement>("[data-fancy-whats-new-stack]");
const cards = () => document.querySelectorAll("[data-react-fancy-toast-stack-card]");
const front = () => document.querySelector<HTMLElement>('[data-react-fancy-toast-stack-card="front"]')!;
const control = (name: string) => front().querySelector<HTMLElement>(`[data-fancy-whats-new-control="${name}"]`)!;
const settle = () => act(async () => new Promise((res) => setTimeout(res, 10)));

describe("WhatsNew -- on a page load", () => {
  it("asks for groups since the stored cursor, and stacks every newer group's cards", async () => {
    const store = memory("v1");
    const load = vi.fn(() => [G3, G2]);
    render(<WhatsNew load={load} storage={store} />);
    await waitFor(() => expect(cards().length).toBe(3));
    expect(load).toHaveBeenCalledWith("v1");
    expect(root()!.getAttribute("data-fancy-whats-new-mode")).toBe("auto");
    expect(front().textContent).toContain("Dark mode");
  });

  it("accepts an async loader and an async store", async () => {
    const store: WhatsNewStorage = { load: async () => "v1", save: vi.fn(async () => {}) };
    render(<WhatsNew load={async () => [G2]} storage={store} />);
    await waitFor(() => expect(cards().length).toBe(1));
  });

  it("labels each card with its group's label and date, and tags it with the group id", async () => {
    render(<WhatsNew load={() => [G3, G2]} storage={memory("v1")} />);
    await waitFor(() => expect(cards().length).toBe(3));
    expect(front().querySelector("[data-fancy-whats-new-group-label]")!.textContent).toBe("v3");
    expect(front().querySelector("[data-fancy-whats-new-eyebrow]")!.textContent).toContain("2026-10-21");
    expect(front().querySelector('[data-fancy-whats-new-card][data-fancy-whats-new-group="v3"]')).not.toBeNull();

    fireEvent.click(control("next"));
    fireEvent.click(control("next"));
    expect(front().textContent).toContain("Exports to PDF");
    expect(front().querySelector("[data-fancy-whats-new-group-label]")!.textContent).toBe("v2");
    expect(front().querySelector('[data-fancy-whats-new-group="v2"]')).not.toBeNull();
  });

  it("a group with no label and no date gets no label row at all", async () => {
    render(<WhatsNew load={() => [G1]} storage={memory("v0")} />);
    await waitFor(() => expect(cards().length).toBe(1));
    expect(front().querySelector("[data-fancy-whats-new-eyebrow]")).toBeNull();
  });

  it("labels.group replaces the label", async () => {
    render(
      <WhatsNew load={() => [G2]} storage={memory("v1")} labels={{ group: (g) => `Release ${g.id}` }} />,
    );
    await waitFor(() => expect(cards().length).toBe(1));
    expect(front().querySelector("[data-fancy-whats-new-group-label]")!.textContent).toBe("Release v2");
  });

  it("missed='latest' shows only the newest group", async () => {
    render(<WhatsNew load={() => [G3, G2]} storage={memory("v1")} missed="latest" />);
    await waitFor(() => expect(cards().length).toBe(2));
    expect(document.querySelector('[data-fancy-whats-new-group="v2"]')).toBeNull();
  });

  it("skips groups with no cards; if none remain, nothing shows and nothing is recorded", async () => {
    const store = memory("v3");
    render(<WhatsNew load={() => [EMPTY]} storage={store} />);
    await settle();
    expect(root()).toBeNull();
    expect(store.saved).toEqual([]);
  });

  it("calls the loader once per page load, not on every re-render", async () => {
    const load = vi.fn(() => [G2]);
    const { rerender } = render(<WhatsNew load={load} storage={memory("v1")} />);
    await waitFor(() => expect(cards().length).toBe(1));
    rerender(<WhatsNew load={() => [G2]} storage={memory("v1")} />);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("WhatsNew -- a first visit", () => {
  it("passes null as since, and firstVisit='latest' (default) shows the newest group", async () => {
    const load = vi.fn(() => [G3, G2]);
    render(<WhatsNew load={load} storage={memory(null)} />);
    await waitFor(() => expect(cards().length).toBe(2));
    expect(load).toHaveBeenCalledWith(null);
  });

  it("firstVisit='all' shows every group", async () => {
    render(<WhatsNew load={() => [G3, G2]} storage={memory(null)} firstVisit="all" />);
    await waitFor(() => expect(cards().length).toBe(3));
  });

  it("firstVisit='none' shows nothing but records a baseline", async () => {
    const store = memory(null);
    render(<WhatsNew load={() => [G3, G2]} storage={store} firstVisit="none" />);
    await waitFor(() => expect(store.saved).toEqual(["v3"]));
    expect(root()).toBeNull();
  });

  it("a welcome: one card, one group, with a link that goes somewhere", async () => {
    const welcome: WhatsNewGroup = {
      id: "welcome",
      cards: [
        {
          title: "Welcome to Tribeshare",
          description: "Start by finding your people.",
          action: { label: "Find people", href: "/people" },
        },
      ],
    };
    render(<WhatsNew load={() => [welcome]} storage={memory(null)} />);
    await waitFor(() => expect(cards().length).toBe(1));
    const link = control("action");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/people");
    expect(link.textContent).toBe("Find people");
    // A single card has nowhere to page to.
    expect(front().querySelector('[data-fancy-whats-new-control="next"]')).toBeNull();
  });
});

describe("WhatsNew -- remembering what was seen", () => {
  it("records the newest cursor SHOWN as soon as it is on screen, so a reload does not bring it back", async () => {
    const store = memory("v1");
    const { unmount } = render(<WhatsNew load={() => [EMPTY, G3, G2]} storage={store} />);
    await waitFor(() => expect(store.saved).toEqual(["v3"]));
    unmount();

    // The next page load: the loader answers from the new cursor.
    const load = vi.fn((since: string | null) => (since === "v3" ? [EMPTY] : [EMPTY, G3, G2]));
    render(<WhatsNew load={load} storage={store} />);
    await settle();
    expect(load).toHaveBeenCalledWith("v3");
    expect(root()).toBeNull();
  });

  it("a notice in a background tab is not seen until the tab is looked at", async () => {
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const store = memory("v1");
    render(<WhatsNew load={() => [G2]} storage={store} />);
    await waitFor(() => expect(cards().length).toBe(1));
    await settle();
    expect(store.saved).toEqual([]);

    vis.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(store.saved).toEqual(["v2"]));
  });

  it("numeric cursors are saved as strings", async () => {
    const store = memory("41");
    render(<WhatsNew load={() => [group(42, ["New post"])]} storage={store} />);
    await waitFor(() => expect(store.saved).toEqual(["42"]));
  });

  it("calls onSeen with the cursor once the store has it", async () => {
    const onSeen = vi.fn();
    render(<WhatsNew load={() => [G2]} storage={memory("v1")} onSeen={onSeen} />);
    await waitFor(() => expect(onSeen).toHaveBeenCalledWith("v2"));
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("defaults to localStorage, under a configurable key", async () => {
    localStorage.setItem("my-app:seen", "v1");
    const load = vi.fn(() => [G2]);
    render(<WhatsNew load={load} storageKey="my-app:seen" />);
    await waitFor(() => expect(localStorage.getItem("my-app:seen")).toBe("v2"));
    expect(load).toHaveBeenCalledWith("v1");
  });

  it("a store that cannot be read shows nothing, and the loader is never asked", async () => {
    const load = vi.fn(() => [G2]);
    const store: WhatsNewStorage = {
      load: () => {
        throw new Error("down");
      },
      save: vi.fn(),
    };
    render(<WhatsNew load={load} storage={store} />);
    await settle();
    expect(root()).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("a loader that throws shows nothing and records nothing", async () => {
    const store = memory("v1");
    render(
      <WhatsNew
        load={() => {
          throw new Error("500");
        }}
        storage={store}
      />,
    );
    await settle();
    expect(root()).toBeNull();
    expect(store.saved).toEqual([]);
  });
});

describe("WhatsNew -- closing", () => {
  it("the close button and 'got it' both close it, once, and call onClose", async () => {
    for (const name of ["close", "dismiss"]) {
      const onClose = vi.fn();
      const { unmount } = render(<WhatsNew load={() => [G2]} storage={memory("v1")} onClose={onClose} />);
      await waitFor(() => expect(cards().length).toBe(1));
      fireEvent.click(control(name));
      expect(root()).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("following a card's link closes the notice too", async () => {
    const g = group("p1", []);
    const post = { ...g, cards: [{ title: "New post", action: { label: "Read it", href: "#post-1" } }] };
    render(<WhatsNew load={() => [post]} storage={memory("p0")} />);
    await waitFor(() => expect(cards().length).toBe(1));
    fireEvent.click(control("action"));
    expect(root()).toBeNull();
  });

  it("a javascript: link is not rendered as a link", async () => {
    const post = { id: "p1", cards: [{ title: "x", action: { label: "Run", href: "javascript:alert(1)" } }] };
    render(<WhatsNew load={() => [post]} storage={memory("p0")} />);
    await waitFor(() => expect(cards().length).toBe(1));
    expect(front().querySelector("a[href^='javascript']")).toBeNull();
  });
});

describe("WhatsNew -- on demand (open)", () => {
  function Host({ load, store }: { load: (since: string | null) => WhatsNewGroup[]; store: WhatsNewStorage }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          {"What's new"}
        </button>
        <WhatsNew load={load} storage={store} open={open} onOpenChange={setOpen} />
      </>
    );
  }

  it("with nothing new, a button shows the newest group's cards, and close hands open back", async () => {
    const store = memory("v3");
    const load = vi.fn((since: string | null) => (since === null ? [EMPTY, G3, G2] : []));
    render(<Host load={load} store={store} />);
    await settle();
    expect(root()).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "What's new" }));
    await waitFor(() => expect(cards().length).toBe(2));
    expect(load).toHaveBeenLastCalledWith(null);
    expect(root()!.getAttribute("data-fancy-whats-new-mode")).toBe("open");
    expect(document.querySelector('[data-fancy-whats-new-group="v2"]')).toBeNull();

    fireEvent.click(control("dismiss"));
    expect(root()).toBeNull();

    // Opens again, without asking the loader a second time.
    fireEvent.click(screen.getByRole("button", { name: "What's new" }));
    await waitFor(() => expect(cards().length).toBe(2));
    expect(load.mock.calls.filter(([s]) => s === null)).toHaveLength(1);
  });

  it("while the page-load notice is up, open shows that notice rather than replacing it", async () => {
    const load = vi.fn(() => [G3, G2]);
    const onOpenChange = vi.fn();
    const store = memory("v1");
    const { rerender } = render(<WhatsNew load={load} storage={store} open={false} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(cards().length).toBe(3));
    rerender(<WhatsNew load={load} storage={store} open onOpenChange={onOpenChange} />);
    await settle();
    expect(cards().length).toBe(3);
    expect(load).toHaveBeenCalledTimes(1);
    fireEvent.click(control("close"));
    expect(root()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("open with nothing at all shows nothing", async () => {
    render(<WhatsNew load={() => []} storage={memory("v1")} open />);
    await settle();
    expect(root()).toBeNull();
  });

  it("records what it showed", async () => {
    const store = memory("v1");
    render(<WhatsNew load={(since) => (since === null ? [G3] : [])} storage={store} open />);
    await waitFor(() => expect(store.saved).toEqual(["v3"]));
  });
});

describe("WhatsNew -- overrides", () => {
  it("renderCard replaces a card's title and description, and is told its group", async () => {
    const renderCard = vi.fn((card: { title: unknown }, s: { group: WhatsNewGroup }) => (
      <span data-test-custom="">{`${String(s.group.id)}: ${String(card.title)}`}</span>
    ));
    render(<WhatsNew load={() => [G2]} storage={memory("v1")} renderCard={renderCard} />);
    await waitFor(() => expect(cards().length).toBe(1));
    expect(front().querySelector("[data-test-custom]")!.textContent).toBe("v2: Exports to PDF");
    // The close button and "got it" stay.
    expect(control("close")).not.toBeNull();
    expect(control("dismiss")).not.toBeNull();
  });

  it("render replaces the whole notice and gets what it needs", async () => {
    render(
      <WhatsNew
        load={() => [G3, G2]}
        storage={memory("v1")}
        render={({ mode, groups, close }) => (
          <div data-test-own="">
            {mode}:{groups.map((g) => g.id).join(",")}
            <button type="button" onClick={close}>
              bye
            </button>
          </div>
        )}
      />,
    );
    await waitFor(() => expect(document.querySelector("[data-test-own]")!.textContent).toContain("auto:v3,v2"));
    fireEvent.click(screen.getByRole("button", { name: "bye" }));
    expect(document.querySelector("[data-test-own]")).toBeNull();
  });

  it("labels name the controls and the notice", async () => {
    render(
      <WhatsNew
        load={() => [G3]}
        storage={memory("v2")}
        labels={{ dismiss: "ok", close: "Hide", previous: "back", next: "on", notice: "Updates" }}
      />,
    );
    await waitFor(() => expect(cards().length).toBe(2));
    expect(control("dismiss").textContent).toBe("ok");
    expect(control("close").getAttribute("aria-label")).toBe("Hide");
    expect(control("previous").textContent).toBe("back");
    expect(control("next").textContent).toBe("on");
    expect(document.querySelector('[aria-label="Updates"]')).not.toBeNull();
  });

  it("position, style and classes reach the notice", async () => {
    render(
      <WhatsNew
        load={() => [G2]}
        storage={memory("v1")}
        position="top-left"
        style={{ top: 64 }}
        className="my-notice"
        cardClassName="my-card"
      />,
    );
    await waitFor(() => expect(cards().length).toBe(1));
    expect(root()!.getAttribute("data-position")).toBe("top-left");
    expect(root()!.style.top).toBe("64px");
    expect(document.querySelector(".my-notice")).not.toBeNull();
    expect(document.querySelector(".my-card")).not.toBeNull();
  });
});

describe("WhatsNew -- SSR", () => {
  it("renders nothing on the server and touches neither the store nor the loader", () => {
    const load = vi.fn(() => [G2]);
    const store = memory("v1");
    expect(renderToString(<WhatsNew load={load} storage={store} />)).toBe("");
    expect(load).not.toHaveBeenCalled();
    expect(store.load).not.toHaveBeenCalled();
  });
});
