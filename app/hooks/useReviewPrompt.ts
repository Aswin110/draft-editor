import { useCallback, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

/**
 * Asks for an App Store review through Shopify's own review modal
 * (`shopify.reviews.request()`), right after the merchant succeeded at
 * something.
 *
 * Shopify does the heavy lifting on not being annoying: it refuses the request
 * outright for a merchant who already reviewed, who installed too recently, who
 * has been asked too often this year, or who is still inside a cooldown. Those
 * refusals are silent — no modal appears — so there is no state worth keeping
 * on our side.
 *
 * What is left to us is picking the moment, which is all this hook does:
 *
 *  - never on the merchant's first success after opening the app, so a save is
 *    a save and not a trade for a favour;
 *  - once per browser session at most;
 *  - a short pause so the success toast is read before the modal covers it, and
 *    nothing at all if they have since looked away;
 *  - silent on every failure. A missed review prompt costs nothing; an error
 *    over a save that worked costs trust.
 */

const ASKED_KEY = "draft-pen:review-asked";
const MILESTONE_KEY = "draft-pen:review-milestones";

/** Successful actions in this session before the first ask. */
const MILESTONES_BEFORE_ASKING = 2;
/** Long enough for "Draft order updated" to land and be read. */
const DELAY_BEFORE_MODAL_MS = 2500;

// Module scope keeps the count across client-side navigation; sessionStorage
// carries it across the full page loads the embedded admin sometimes does.
// Neither survives the tab closing, which is the point.
let askedThisSession = false;
let milestonesThisSession = 0;

const readSession = (key: string): number => {
  try {
    return Number(sessionStorage.getItem(key)) || 0;
  } catch {
    // Private browsing or a partitioned iframe; module state still holds.
    return 0;
  }
};

const writeSession = (key: string, value: number | string) => {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // Ignore — the module-level flags are enough for one page load.
  }
};

const alreadyAsked = (): boolean =>
  askedThisSession || readSession(ASKED_KEY) === 1;

const countMilestone = (): number => {
  milestonesThisSession = Math.max(milestonesThisSession, readSession(MILESTONE_KEY)) + 1;
  writeSession(MILESTONE_KEY, milestonesThisSession);
  return milestonesThisSession;
};

const markAsked = () => {
  askedThisSession = true;
  writeSession(ASKED_KEY, 1);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useReviewPrompt() {
  const shopify = useAppBridge();
  const inFlight = useRef(false);

  /**
   * Call after a task the merchant completed successfully. Cheap to call on
   * every success — the overwhelmingly common outcome is that nothing happens.
   */
  return useCallback(async () => {
    if (inFlight.current || alreadyAsked()) return;

    // App Bridge is served from Shopify's CDN, so the reviews API may not be
    // there on an older admin. Nothing to fall back to; just skip.
    if (typeof shopify.reviews?.request !== "function") return;

    if (countMilestone() < MILESTONES_BEFORE_ASKING) return;

    inFlight.current = true;
    try {
      // Claim the session's one slot before the pause, so two quick saves
      // can't queue up two modals.
      markAsked();
      await wait(DELAY_BEFORE_MODAL_MS);

      // They switched tabs while we waited. Interrupting them on return is
      // exactly the annoyance we're avoiding.
      if (document.visibilityState !== "visible") return;

      await shopify.reviews.request();
    } catch (e) {
      console.error("Review prompt failed:", e);
    } finally {
      inFlight.current = false;
    }
  }, [shopify]);
}
