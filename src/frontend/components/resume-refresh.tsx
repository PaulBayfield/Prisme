"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// How long the app has to sit in the background before coming back to it
// re-fetches the server-rendered data. Short enough that reopening the PWA
// the next morning (or after a sync ran) shows fresh numbers, long enough
// that quickly switching apps doesn't trigger a refetch every time.
const STALE_AFTER_MS = 60_000;

// An installed PWA (especially on iOS/Android) is rarely reloaded: the OS
// suspends it and resumes the exact page it last rendered, possibly days
// later. Every page here is a server component, so without a navigation
// nothing ever asks the server for new data - the app looks frozen at
// whenever it was last really loaded. Refresh the RSC payload when the app
// comes back to the foreground after being hidden for a while, or when it
// is restored from the back/forward cache.
export function ResumeRefresh() {
  const router = useRouter();

  useEffect(() => {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS) {
        router.refresh();
      }
      hiddenAt = null;
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) router.refresh();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
