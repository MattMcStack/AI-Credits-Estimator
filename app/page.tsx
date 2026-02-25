"use client";

import { useEffect, useState } from "react";
import { useContentstackUser } from "./ContentstackUserContext";
import type { SubscriptionProduct, AddonProduct } from "./data/products";

const FALLBACK_EMAIL = "example@email.com";

function withStripeLinkParams(
  url: string,
  email: string | null,
  orgUid: string | null
): string {
  if (!url) return url;
  const params = new URLSearchParams();
  const emailVal = (email?.trim() || FALLBACK_EMAIL).trim();
  if (emailVal) params.set("prefilled_email", emailVal);
  const orgVal = orgUid?.trim();
  if (orgVal) params.set("client_reference_id", orgVal);
  if (params.toString() === "") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.toString()}`;
}

function TierIcon({ icon }: { icon: "lightning" | "space" | "solar" }) {
  const name = icon === "lightning" ? "bolt" : icon === "space" ? "public" : "wb_sunny";
  return (
    <span className="material-icons tier-icon" aria-hidden>
      {name}
    </span>
  );
}

function InspectModal({
  product,
  onClose,
}: {
  product: SubscriptionProduct | AddonProduct;
  onClose: () => void;
}) {
  const inspect = "inspect" in product ? product.inspect : undefined;
  const paymentLinkUrl = "paymentLinkUrl" in product ? product.paymentLinkUrl : undefined;
  const payload = inspect
    ? {
        productMetadata: inspect.stripeProduct.metadata,
        product: {
          id: inspect.stripeProduct.id,
          name: inspect.stripeProduct.name,
          description: inspect.stripeProduct.description,
        },
        price: inspect.stripePrice ?? null,
        features: inspect.features,
        ...(paymentLinkUrl !== undefined && { paymentLinkUrl }),
      }
    : { product, paymentLinkUrl, note: "No Stripe inspect data" };
  const json = JSON.stringify(payload, null, 2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Product JSON (POC)"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200">
          <span className="text-sm font-medium text-slate-700">
            Product JSON (POC) — metadata, product, price, features
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900"
            aria-label="Close"
          >
            <span className="material-icons text-lg">close</span>
          </button>
        </div>
        <pre className="p-4 overflow-auto text-xs text-slate-800 bg-slate-50 flex-1 rounded-b-lg font-mono whitespace-pre">
          <code>{json}</code>
        </pre>
      </div>
    </div>
  );
}

function InspectButton({
  product,
  onClick,
}: {
  product: SubscriptionProduct | AddonProduct;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-1.5 rounded hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 transition-colors"
      title="Inspect product JSON (POC)"
      aria-label="Inspect product JSON"
    >
      <span className="material-icons text-lg">settings</span>
    </button>
  );
}

const PLAN_API_REQUESTS = 100_000;
const PLAN_BANDWIDTH_GB = 1000; // 1 TB (1000-based GB)
const PRICE_PER_API_REQUEST = 0.00027;
const PRICE_PER_GB = 2.38;

function parseApiInput(s: string): number {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : PLAN_API_REQUESTS;
}

function parseBandwidthInput(s: string): number {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? n : PLAN_BANDWIDTH_GB;
}

function BillingLimitsModal({ onClose }: { onClose: () => void }) {
  const [maxApiRequestsStr, setMaxApiRequestsStr] = useState(String(PLAN_API_REQUESTS));
  const [maxBandwidthStr, setMaxBandwidthStr] = useState(String(PLAN_BANDWIDTH_GB));
  const [allowUnlimitedOverages, setAllowUnlimitedOverages] = useState(false);

  const maxApiRequests = parseApiInput(maxApiRequestsStr);
  const maxBandwidthGb = parseBandwidthInput(maxBandwidthStr);

  const overageApi = Math.max(0, maxApiRequests - PLAN_API_REQUESTS);
  const overageGb = Math.max(0, maxBandwidthGb - PLAN_BANDWIDTH_GB);
  const maxOverageDollars =
    overageApi * PRICE_PER_API_REQUEST + overageGb * PRICE_PER_GB;

  const clampApiOnBlur = () => {
    const n = parseApiInput(maxApiRequestsStr);
    setMaxApiRequestsStr(String(Math.max(PLAN_API_REQUESTS, n)));
  };
  const clampBandwidthOnBlur = () => {
    const n = parseBandwidthInput(maxBandwidthStr);
    setMaxBandwidthStr(String(Math.max(PLAN_BANDWIDTH_GB, n)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="billing-limits-title"
      onClick={onClose}
    >
      <div
        className="billing-limits-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="billing-limits-modal-header">
          <h2 id="billing-limits-title" className="billing-limits-modal-title">
            Set Billing Limits
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="billing-limits-modal-close"
            aria-label="Close"
          >
            <span className="material-icons text-lg">close</span>
          </button>
        </div>
        <p className="billing-limits-modal-intro">
          Set upper limits so the system will not allow usage beyond these caps. Overage is billed when you exceed your plan&apos;s included amounts.
        </p>
        <div className="billing-limits-grid">
          <div className="billing-limits-card">
            <h3 className="billing-limits-card-title">API Requests</h3>
            <p className="billing-limits-card-plan">
              Plan limit: {PLAN_API_REQUESTS.toLocaleString()} requests
            </p>
            <p className="billing-limits-card-price">
              Overage: ${PRICE_PER_API_REQUEST.toFixed(5)} per request
            </p>
            <label className="billing-limits-label">
              Your max limit (requests)
              <input
                type="text"
                inputMode="numeric"
                value={maxApiRequestsStr}
                onChange={(e) => setMaxApiRequestsStr(e.target.value)}
                onBlur={clampApiOnBlur}
                className="billing-limits-input"
                aria-label="Max API requests"
              />
            </label>
          </div>
          <div className="billing-limits-card">
            <h3 className="billing-limits-card-title">Bandwidth</h3>
            <p className="billing-limits-card-plan">
              Plan limit: 1 TB (1,000 GB)
            </p>
            <p className="billing-limits-card-price">
              Overage: ${PRICE_PER_GB.toFixed(2)} per GB
            </p>
            <label className="billing-limits-label">
              Your max limit (GB)
              <input
                type="text"
                inputMode="numeric"
                value={maxBandwidthStr}
                onChange={(e) => setMaxBandwidthStr(e.target.value)}
                onBlur={clampBandwidthOnBlur}
                className="billing-limits-input"
                aria-label="Max bandwidth in GB"
              />
            </label>
          </div>
        </div>
        <div className="billing-limits-unlimited">
          <label className="billing-limits-unlimited-label">
            <input
              type="checkbox"
              checked={allowUnlimitedOverages}
              onChange={(e) => setAllowUnlimitedOverages(e.target.checked)}
              className="billing-limits-unlimited-checkbox"
              aria-describedby="unlimited-overages-warning"
            />
            <span>Allow Unlimited Overages</span>
          </label>
          <p id="unlimited-overages-warning" className="billing-limits-unlimited-warning">
            This could have significant cost impacts and should be selected with caution.
          </p>
        </div>
        <div className="billing-limits-total">
          <span className="billing-limits-total-label">
            Max overage billing (if you reach your limits):
          </span>
          {allowUnlimitedOverages ? (
            <span className="billing-limits-total-value billing-limits-total-value-unlimited" aria-label="Unlimited">
              ∞
            </span>
          ) : (
            <span className="billing-limits-total-value">
              ${maxOverageDollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <div className="billing-limits-actions">
          <button
            type="button"
            onClick={onClose}
            className="billing-limits-btn billing-limits-btn-primary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionCard({
  product,
  prefilledEmail,
  orgUid,
  onInspect,
  layoutVariant,
}: {
  product: SubscriptionProduct;
  prefilledEmail: string | null;
  orgUid: string | null;
  onInspect: () => void;
  layoutVariant?: "narrow" | "wide";
}) {
  const { features, icon, name, description, paymentLinkUrl, priceDisplay, marketingFeatures, imageUrl } =
    product;
  const hasPaymentLink = typeof paymentLinkUrl === "string" && paymentLinkUrl.trim().length > 0;
  const href = hasPaymentLink
    ? withStripeLinkParams(paymentLinkUrl.trim(), prefilledEmail, orgUid)
    : null;
  const useStripeFeatures = marketingFeatures.length > 0;
  const cardClass =
    layoutVariant === "narrow"
      ? "subscription-card subscription-card-narrow"
      : layoutVariant === "wide"
        ? "subscription-card subscription-card-wide"
        : "subscription-card";
  return (
    <article className={cardClass}>
      {imageUrl ? (
        <div className="subscription-card-image-wrap">
          <img src={imageUrl} alt="" className="subscription-card-image" />
        </div>
      ) : null}
      <div className="subscription-card-inner">
        <div className="subscription-card-header">
          {!imageUrl ? (
            <div className="subscription-icon-wrap">
              <TierIcon icon={icon} />
            </div>
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="subscription-card-title">{name}</h3>
              <p className="subscription-card-desc">{description}</p>
              <p className="text-sm font-semibold text-slate-700 mt-1">{priceDisplay}</p>
            </div>
            <InspectButton product={product} onClick={onInspect} />
          </div>
        </div>
        <ul className="subscription-features" aria-label="Features">
          {useStripeFeatures ? (
            marketingFeatures.map((label, i) => (
              <li key={i}>
                <span className="feature-check" aria-hidden>✓</span>
                {label}
              </li>
            ))
          ) : (
            <>
              <li>
                <span className="feature-check" aria-hidden>✓</span>
                Hosted Sites on Launch
              </li>
              <li>
                <span className="feature-check" aria-hidden>✓</span>
                AI-Powered CMS
              </li>
              <li>
                <span className="feature-check" aria-hidden>✓</span>
                Brand Tools
              </li>
              <li>
                {features.personalization ? (
                  <>
                    <span className="feature-check" aria-hidden>✓</span>
                    Personalization
                  </>
                ) : (
                  <span className="feature-na">Personalization — not available on Lightning</span>
                )}
              </li>
              <li>
                <span className="feature-check" aria-hidden>✓</span>
                Automations — {features.automations.toLocaleString()}/mo
              </li>
            </>
          )}
        </ul>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="subscription-cta"
          >
            Subscribe
          </a>
        ) : (
          <span className="subscription-cta subscription-cta-disabled" aria-disabled="true">
            Subscribe
          </span>
        )}
      </div>
    </article>
  );
}

function AddonCard({
  product,
  tooltip,
  onInspect,
}: {
  product: AddonProduct;
  tooltip: string;
  onInspect: () => void;
}) {
  const { name, description, priceDisplay, features, imageUrl } = product;
  return (
    <article className="addon-card">
      {imageUrl ? (
        <div className="addon-card-image-wrap">
          <img src={imageUrl} alt="" className="addon-card-image" />
        </div>
      ) : null}
      <div className="addon-card-body flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="addon-card-title">{name}</h3>
          <p className="addon-card-desc">{description}</p>
          <p className="text-sm font-semibold text-slate-700 mt-1">{priceDisplay}</p>
          {features.length > 0 ? (
            <ul className="mt-2 text-xs text-slate-600 list-disc list-inside space-y-0.5" aria-label="Features">
              {features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <InspectButton product={product} onClick={onInspect} />
      </div>
      <div className="addon-cta-wrap" title={tooltip}>
        <button type="button" className="addon-cta addon-cta-disabled" disabled>
          Upgrade
        </button>
        <span className="addon-tooltip-text">{tooltip}</span>
      </div>
    </article>
  );
}

type StripeProductsPayload = {
  subscriptionProducts: SubscriptionProduct[];
  addonProducts: AddonProduct[];
  customerPortalUrl: string;
  addonTooltip: string;
};

export default function ContentstackSubscriptionPage() {
  const { prefilledEmail, orgUid } = useContentstackUser();
  const effectiveEmail = prefilledEmail?.trim() || FALLBACK_EMAIL;
  const [data, setData] = useState<StripeProductsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectProduct, setInspectProduct] = useState<SubscriptionProduct | AddonProduct | null>(null);
  const [showBillingLimitsModal, setShowBillingLimitsModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stripe-products", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const payload: StripeProductsPayload = await res.json();
        if (!cancelled) setData(payload);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load products");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="subscription-page flex items-center justify-center">
        <p className="text-slate-500 text-sm font-medium">Loading pricing…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="subscription-page flex items-center justify-center">
        <p className="text-red-600 text-sm font-medium">
          {error ?? "Unable to load products. Check STRIPE_API_KEY."}
        </p>
      </div>
    );
  }

  const {
    subscriptionProducts,
    addonProducts,
    customerPortalUrl,
    addonTooltip,
  } = data;
  const portalHref = withStripeLinkParams(customerPortalUrl, effectiveEmail, orgUid);

  return (
    <div className="subscription-page">
      {inspectProduct ? (
        <InspectModal product={inspectProduct} onClose={() => setInspectProduct(null)} />
      ) : null}
      {showBillingLimitsModal ? (
        <BillingLimitsModal onClose={() => setShowBillingLimitsModal(false)} />
      ) : null}

      <main className="subscription-main">
        <section className="subscription-hero" aria-labelledby="hero-heading">
          <h2 id="hero-heading" className="subscription-hero-title">
            Choose the plan that fits your team
          </h2>
          <p className="subscription-hero-subtext">
            Get more out of Contentstack with a subscription that scales with you. Compare options below and manage your plan anytime.
          </p>
          <p className="subscription-hero-note">
            You can change or cancel your plan at any time.
          </p>
        </section>

        <section className="subscription-section" aria-labelledby="section-subscriptions">
          <div className="subscription-section-head">
            <h2 id="section-subscriptions" className="section-title section-title-large">Subscription Options</h2>
            <div className="subscription-section-head-actions">
              {customerPortalUrl ? (
                <a
                  href={portalHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portal-button"
                >
                  Customer Subscription Portal
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setShowBillingLimitsModal(true)}
                className="billing-limits-button"
              >
                Set Billing Limits
              </button>
            </div>
          </div>
          <div
            className={
              subscriptionProducts.length === 2
                ? "subscription-grid subscription-grid-two"
                : "subscription-grid"
            }
          >
            {subscriptionProducts.map((product, index) => (
              <SubscriptionCard
                key={product.id}
                product={product}
                prefilledEmail={effectiveEmail}
                orgUid={orgUid}
                onInspect={() => setInspectProduct(product)}
                layoutVariant={
                  subscriptionProducts.length === 2
                    ? index === 0
                      ? "narrow"
                      : "wide"
                    : undefined
                }
              />
            ))}
          </div>
        </section>

        <div className="sales-cta sales-cta-between">
          <p className="sales-cta-text">Looking for more power? Reach out to our Sales Team here.</p>
          <button type="button" className="sales-cta-button" disabled aria-disabled="true">
            Reach out to our Sales Team
          </button>
        </div>

        <section className="subscription-section" aria-labelledby="section-addons">
          <h2 id="section-addons" className="section-title">Add Ons & Upgrades</h2>
          <div className="addon-grid">
            {addonProducts.map((product) => (
              <AddonCard
                key={product.id}
                product={product}
                tooltip={addonTooltip}
                onInspect={() => setInspectProduct(product)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
