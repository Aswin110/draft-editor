import { useEffect } from "react";
import { useRevalidator } from "react-router";

/**
 * Reloads the current page's data when the merchant comes back to it after
 * looking elsewhere.
 *
 * Draft orders change behind this app's back: in the Shopify admin, through
 * the customer account extension, from another device. A page opened a while
 * ago and left in a background tab would otherwise keep showing whatever it
 * loaded first, and the merchant's next edit would start from stale numbers.
 *
 * Two signals cover the ways a page comes back into view:
 *
 *  - `visibilitychange` to "visible": the tab holding the admin (and so this
 *    app's iframe) was switched back to;
 *  - `pageshow` with `persisted`: the browser restored the page from its
 *    back/forward cache instead of loading it again.
 *
 * Window `focus` is deliberately not used. Inside an embedded iframe it fires
 * on every click that moves focus from the admin chrome into the app, which
 * would turn ordinary use into a stream of reloads.
 */
export function useRevalidateOnReturn() {
  const { revalidate, state } = useRevalidator();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // A reload already in flight will bring the same data.
      if (state !== "idle") return;
      void revalidate();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onVisible();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [revalidate, state]);
}
