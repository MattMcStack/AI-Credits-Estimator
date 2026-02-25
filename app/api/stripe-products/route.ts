/**
 * Fetches products and payment links from Stripe to populate the pricing page.
 *
 * Required env: STRIPE_API_KEY
 * Optional env: STRIPE_PORTAL_URL or CUSTOMER_PORTAL_URL (customer portal button)
 *
 * Stripe product metadata used for subscriptions:
 * - type: "subscription" (products with this + a payment link show under Subscription Options)
 * - icon: "lightning" | "space" | "solar"
 * - personalization: "true" | "1" for yes
 * - automations: "1000" | "5000" | "50000"
 * Addons: metadata.features = comma-separated or JSON array of feature strings
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
import Stripe from "stripe";
import type {
  SubscriptionProduct,
  AddonProduct,
  InspectStripeProduct,
  InspectStripePrice,
} from "@/app/data/products";

const ICONS = ["lightning", "space", "solar"] as const;
type Icon = (typeof ICONS)[number];
const AUTOMATIONS = [1000, 5000, 50000] as const;

function parseMetadata(
  metadata: Stripe.Metadata | null
): {
  isSubscription: boolean;
  icon: Icon;
  personalization: boolean;
  automations: number;
} {
  const type = metadata?.type ?? "";
  const isSubscription = type === "subscription";
  const iconRaw = metadata?.icon ?? "lightning";
  const icon = ICONS.includes(iconRaw as Icon) ? (iconRaw as Icon) : "lightning";
  const personalization =
    metadata?.personalization === "true" || metadata?.personalization === "1";
  const automationsNum = Number(metadata?.automations ?? "1000");
  const automations = (AUTOMATIONS as readonly number[]).includes(automationsNum)
    ? automationsNum
    : 1000;
  return { isSubscription, icon, personalization, automations };
}

function formatPrice(price: Stripe.Price | null): string {
  if (!price || price.unit_amount == null) return "—";
  const amount = (price.unit_amount / 100).toFixed(2);
  const currency = (price.currency ?? "usd").toUpperCase();
  const symbol = currency === "USD" ? "$" : currency + " ";
  if (price.recurring) {
    const interval = price.recurring.interval;
    const count = price.recurring.interval_count ?? 1;
    const intervalLabel =
      count > 1 ? `/${count} ${interval}s` : interval === "month" ? "/month" : `/${interval}`;
    return `${symbol}${amount}${intervalLabel}`;
  }
  return `${symbol}${amount}`;
}

function toInspectProduct(p: Stripe.Product): InspectStripeProduct {
  return {
    id: p.id,
    name: p.name ?? "",
    description: p.description ?? null,
    metadata: (p.metadata as Record<string, string>) ?? {},
    marketing_features: (p.marketing_features ?? []).map((f) => ({ name: f?.name })),
  };
}

function toInspectPrice(price: Stripe.Price | null): InspectStripePrice | null {
  if (!price) return null;
  return {
    id: price.id,
    unit_amount: price.unit_amount,
    currency: price.currency,
    recurring: price.recurring
      ? {
          interval: price.recurring.interval,
          interval_count: price.recurring.interval_count ?? 1,
        }
      : undefined,
  };
}

/** Extract marketing feature names from Stripe product (pricing table feature list). */
function getMarketingFeatures(p: Stripe.Product): string[] {
  const list = p.marketing_features ?? [];
  return list
    .map((f) => (f && typeof f === "object" && "name" in f ? (f as { name?: string }).name : null))
    .filter((n): n is string => typeof n === "string" && n.length > 0);
}

function parseAddonFeatures(metadata: Stripe.Metadata | null): string[] {
  const raw = metadata?.features;
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed) as unknown;
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

const RESTRICTED_KEY_HINT =
  "Use a Stripe secret key (sk_test_... or sk_live_...) from Developers → API keys. Restricted keys (rk_...) need 'Read' access to Products and Payment Links.";

export async function GET() {
  const key = process.env.STRIPE_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "STRIPE_API_KEY is not configured" },
      { status: 503 }
    );
  }
  if (key.startsWith("rk_")) {
    return NextResponse.json(
      { error: "Restricted API keys (rk_...) don't have the permissions needed for this app. " + RESTRICTED_KEY_HINT },
      { status: 400 }
    );
  }

  const stripe = new Stripe(key);

  try {
    const [productsRes, paymentLinksRes] = await Promise.all([
      stripe.products.list({
        active: true,
        limit: 100,
        expand: ["data.default_price"],
      }),
      stripe.paymentLinks.list({ active: true, limit: 100 }),
    ]);

    const productById = new Map(
      productsRes.data.map((p) => [p.id, p])
    );

    const paymentLinkUrlByProductId = new Map<string, string>();

    for (const pl of paymentLinksRes.data) {
      if (!pl.url) continue;
      const lineItems = await stripe.paymentLinks.listLineItems(pl.id, {
        limit: 100,
        expand: ["data.price.product"],
      });
      for (const item of lineItems.data) {
        const productId =
          typeof item.price?.product === "string"
            ? item.price.product
            : (item.price?.product as Stripe.Product)?.id;
        if (productId) {
          paymentLinkUrlByProductId.set(productId, pl.url!);
        }
      }
    }

    const subscriptionProducts: SubscriptionProduct[] = [];
    const addonProducts: AddonProduct[] = [];

    for (const p of productsRes.data) {
      const defaultPrice =
        typeof p.default_price === "object" && p.default_price != null
          ? p.default_price
          : null;
      const priceDisplay = formatPrice(defaultPrice);
      const meta = parseMetadata(p.metadata);
      const name = p.name ?? p.id;
      const description =
        typeof p.description === "string" && p.description.length > 0
          ? p.description
          : "";

      const marketingFeatures = getMarketingFeatures(p);
      const imageUrl =
        Array.isArray(p.images) && p.images.length > 0 && typeof p.images[0] === "string"
          ? p.images[0]
          : null;

      if (meta.isSubscription) {
        const paymentLinkUrl = paymentLinkUrlByProductId.get(p.id) ?? null;
        const features = {
          hostedSites: true as const,
          aiCms: true as const,
          brandTools: true as const,
          personalization: meta.personalization,
          automations: meta.automations,
        };
        const unitAmount = defaultPrice?.unit_amount ?? 0;
        subscriptionProducts.push({
          id: p.id,
          name,
          description,
          category: "subscription",
          paymentLinkUrl: paymentLinkUrl ?? "",
          icon: meta.icon,
          features,
          priceDisplay,
          imageUrl,
          marketingFeatures,
          unitAmount,
          inspect: {
            stripeProduct: toInspectProduct(p),
            stripePrice: toInspectPrice(defaultPrice),
            features,
          },
        });
      } else {
        const features =
          marketingFeatures.length > 0 ? marketingFeatures : parseAddonFeatures(p.metadata);
        addonProducts.push({
          id: p.id,
          name,
          description,
          category: "addon",
          features,
          priceDisplay,
          imageUrl,
          inspect: {
            stripeProduct: toInspectProduct(p),
            stripePrice: toInspectPrice(defaultPrice),
            features,
          },
        });
      }
    }

    subscriptionProducts.sort((a, b) => (a.unitAmount ?? 0) - (b.unitAmount ?? 0));

    const portalUrl =
      process.env.STRIPE_PORTAL_URL ||
      process.env.CUSTOMER_PORTAL_URL ||
      "";

    return NextResponse.json({
      subscriptionProducts,
      addonProducts,
      customerPortalUrl: portalUrl,
      addonTooltip:
        "You need an active subscription first to purchase an upgrade.",
    });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : "Stripe request failed";
    const isStripe = err && typeof err === "object" && "type" in err;
    const isPermissionError =
      typeof rawMessage === "string" &&
      (rawMessage.includes("permission") || rawMessage.includes("rak_"));
    const message =
      isPermissionError || (isStripe && rawMessage.includes("key"))
        ? rawMessage + " " + RESTRICTED_KEY_HINT
        : rawMessage;
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
