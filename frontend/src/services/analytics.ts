/**
 * Product analytics (PostHog). Disabled until VITE_POSTHOG_KEY is set.
 * Default host is EU cloud (Israel / nearby); override VITE_POSTHOG_HOST for US or self-hosted.
 */
import posthog from "posthog-js";

let initialized = false;

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) return;

  const apiHost =
    import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

  posthog.init(key, {
    api_host: apiHost,
    capture_pageview: false,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    disable_session_recording: true,
  });
  initialized = true;
}

export function trackEvent(
  event: string,
  props?: Record<string, unknown>
): void {
  if (!initialized) return;
  posthog.capture(event, props);
}

export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>
): void {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}
