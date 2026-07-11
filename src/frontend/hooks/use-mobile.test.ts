import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

// jsdom doesn't implement matchMedia, so useIsMobile's subscribe/getSnapshot
// (window.matchMedia + window.innerWidth) need a minimal fake. The listener
// registered via addEventListener is stashed so tests can fire a "change"
// manually after moving innerWidth across the breakpoint.
function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
}

function installMatchMediaMock() {
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return {
    fireChange: () => {
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size,
  };
}

describe("useIsMobile", () => {
  const originalInnerWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    setViewportWidth(originalInnerWidth);
    window.matchMedia = originalMatchMedia;
  });

  it("reports non-mobile above the 768px breakpoint", () => {
    setViewportWidth(1024);
    installMatchMediaMock();

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("reports mobile below the 768px breakpoint", () => {
    setViewportWidth(767);
    installMatchMediaMock();

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reports non-mobile exactly at the breakpoint (768px is not mobile)", () => {
    setViewportWidth(768);
    installMatchMediaMock();

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when the viewport crosses the breakpoint and a change event fires", () => {
    setViewportWidth(1024);
    const mql = installMatchMediaMock();

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(500);
      mql.fireChange();
    });

    expect(result.current).toBe(true);
  });

  it("subscribes to the matchMedia change event on mount", () => {
    setViewportWidth(1024);
    const mql = installMatchMediaMock();

    renderHook(() => useIsMobile());
    expect(mql.listenerCount()).toBe(1);
  });
});
