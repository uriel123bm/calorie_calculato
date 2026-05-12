/**
 * Web Push subscription hook.
 *
 * - Requests Notification permission from the browser.
 * - POSTs the PushSubscription to the backend (/push/subscribe).
 * - Exposes permission state + subscribed boolean.
 *
 * The VAPID public key is provided by the server (GET /push/vapid-public-key)
 * so it never needs to be baked into the frontend bundle.
 */
import { useCallback, useEffect, useState } from "react";
import { client } from "../services/api";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export interface UsePushNotificationsResult {
  permission: PushPermission;
  subscribed: boolean;
  requesting: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission as PushPermission;
  });
  const [subscribed, setSubscribed] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    // Check existing SW subscription on mount.
    navigator.serviceWorker?.ready
      .then((reg) => reg.pushManager?.getSubscription())
      .then((sub) => { if (sub) setSubscribed(true); })
      .catch(() => { /* ignore */ });
  }, []);

  const subscribe = useCallback(async () => {
    if (typeof Notification === "undefined" || !navigator.serviceWorker) return;
    setRequesting(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return;

      // Fetch VAPID public key from backend.
      const { data } = await client.get<{ public_key: string }>("/push/vapid-public-key");
      const applicationServerKey = urlBase64ToArrayBuffer(data.public_key);

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const json = sub.toJSON();
      await client.post("/push/subscribe", {
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      });
      setSubscribed(true);
    } catch (err) {
      console.error("Push subscribe error:", err);
    } finally {
      setRequesting(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker?.ready;
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        await client.delete("/push/unsubscribe", {
          data: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
  }, []);

  return { permission, subscribed, requesting, subscribe, unsubscribe };
}
