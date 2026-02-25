"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";

type ContentstackUserContextValue = {
  /** Email from Contentstack SDK (when app runs inside dashboard) */
  email: string | null;
  setEmail: (email: string | null) => void;
  /** Email to use for prefilling Stripe links */
  prefilledEmail: string | null;
  /** org_uid from Contentstack SDK (for Stripe client_reference_id) */
  orgUid: string | null;
  setOrgUid: (s: string | null) => void;
};

const ContentstackUserContext = createContext<ContentstackUserContextValue | null>(null);

export function ContentstackUserProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [orgUid, setOrgUid] = useState<string | null>(null);
  const prefilledEmail = email?.trim() || null;
  const value: ContentstackUserContextValue = useMemo(
    () => ({
      email,
      setEmail,
      prefilledEmail,
      orgUid,
      setOrgUid,
    }),
    [email, prefilledEmail, orgUid]
  );
  return (
    <ContentstackUserContext.Provider value={value}>
      {children}
    </ContentstackUserContext.Provider>
  );
}

export function useContentstackUser(): ContentstackUserContextValue {
  const ctx = useContext(ContentstackUserContext);
  if (!ctx) {
    return {
      email: null,
      setEmail: () => {},
      prefilledEmail: null,
      orgUid: null,
      setOrgUid: () => {},
    };
  }
  return ctx;
}
