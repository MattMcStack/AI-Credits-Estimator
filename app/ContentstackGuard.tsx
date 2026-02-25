"use client";

import { useEffect, useState } from "react";
import { AppFailed } from "./AppFailed";
import { useContentstackUser } from "./ContentstackUserContext";

type Status = "loading" | "inside" | "outside";

function getOrgUid(user: Record<string, unknown>): string | null {
  const def = user.defaultOrganization;
  if (def != null && typeof def === "string" && def.trim()) return def.trim();
  const shared = user.shared_org_uid;
  if (Array.isArray(shared) && shared.length > 0 && typeof shared[0] === "string")
    return shared[0].trim();
  const orgUid = user.org_uid;
  if (orgUid != null && typeof orgUid === "string" && orgUid.trim()) return orgUid.trim();
  if (typeof orgUid === "number") return String(orgUid);
  return null;
}

export function ContentstackGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const { setEmail, setOrgUid } = useContentstackUser();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ContentstackAppSDK = (await import("@contentstack/app-sdk")).default;
        const sdk = await ContentstackAppSDK.init();
        if (!cancelled) {
          const user = sdk?.currentUser;
          const userObj = user && typeof user === "object" ? (user as Record<string, unknown>) : null;
          setOrgUid(userObj ? getOrgUid(userObj) : null);

          const uid = userObj?.uid;
          const uidStr = typeof uid === "string" ? uid.trim() : typeof uid === "number" ? String(uid) : null;
          if (uidStr) {
            const base = (sdk as { endpoints?: { CMA?: string } }).endpoints?.CMA ?? "https://api.contentstack.io";
            const res = await (sdk as { api: (url: string, opts?: RequestInit) => Promise<Response> }).api(
              `${base}/v3/user/${uidStr}`,
              { method: "GET", headers: { "Content-Type": "application/json" } }
            );
            if (!cancelled && res.ok) {
              const data = (await res.json()) as Record<string, unknown> & { user?: { email?: string }; email?: string };
              const emailVal = data?.user?.email ?? data?.email;
              const email = typeof emailVal === "string" ? emailVal.trim() : null;
              setEmail(email || null);
            }
          }
          setStatus("inside");
        }
      } catch {
        if (!cancelled) setStatus("outside");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setEmail, setOrgUid]);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 text-sm font-medium">Loading...</div>
      </div>
    );
  }

  if (status === "outside") {
    return <AppFailed />;
  }

  return <>{children}</>;
}
