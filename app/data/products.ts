/**
 * Subscription plans and add-ons. Subscription tiers include feature bullets.
 */

/** Display price string e.g. "$10.00/month" */
export type PriceDisplay = string;

/** Stripe product metadata + key fields for inspect modal */
export interface InspectStripeProduct {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, string>;
  /** Marketing feature list (Stripe pricing table) */
  marketing_features: Array<{ name?: string }>;
}

/** Stripe price fields for inspect modal */
export interface InspectStripePrice {
  id: string;
  unit_amount: number | null;
  currency: string;
  recurring?: { interval: string; interval_count: number };
}

export interface SubscriptionProduct {
  id: string;
  name: string;
  description: string;
  category: "subscription";
  paymentLinkUrl: string;
  /** Icon identifier for the tier */
  icon: "lightning" | "space" | "solar";
  /** Feature bullets: Hosted Sites, AI-Powered CMS, Brand Tools, Personalization, Automations */
  features: {
    hostedSites: true;
    aiCms: true;
    brandTools: true;
    personalization: boolean;
    automations: number; // 1000 | 5000 | 50000
  };
  priceDisplay: PriceDisplay;
  /** First Stripe product image URL, for card display */
  imageUrl: string | null;
  /** Stripe product marketing_features (display under description); when empty, UI can show fallback list */
  marketingFeatures: string[];
  /** Used by API for sort order only (low to high price); may be omitted in response if desired */
  unitAmount?: number;
  /** For POC inspect modal */
  inspect?: {
    stripeProduct: InspectStripeProduct;
    stripePrice?: InspectStripePrice | null;
    features: {
      hostedSites: true;
      aiCms: true;
      brandTools: true;
      personalization: boolean;
      automations: number;
    };
  };
}

export interface AddonProduct {
  id: string;
  name: string;
  description: string;
  category: "addon";
  /** Stripe marketing_features when set; else from metadata.features. Display under description. */
  features: string[];
  priceDisplay: PriceDisplay;
  /** First Stripe product image URL, for card display */
  imageUrl: string | null;
  /** For POC inspect modal */
  inspect?: {
    stripeProduct: InspectStripeProduct;
    stripePrice?: InspectStripePrice | null;
    features: string[];
  };
}

export const ADDON_TOOLTIP =
  "You need an active subscription first to purchase an upgrade.";
