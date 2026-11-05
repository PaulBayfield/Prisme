import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

import { ResumeRefresh } from "./resume-refresh";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("ResumeRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockClear();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes when the app comes back after being hidden for a while", () => {
    render(<ResumeRefresh />);
    setVisibility("hidden");
    vi.advanceTimersByTime(5 * 60_000);
    setVisibility("visible");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh after a quick app switch", () => {
    render(<ResumeRefresh />);
    setVisibility("hidden");
    vi.advanceTimersByTime(5_000);
    setVisibility("visible");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when restored from the back/forward cache", () => {
    render(<ResumeRefresh />);
    const event = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
