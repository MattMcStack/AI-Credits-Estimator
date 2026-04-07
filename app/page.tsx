"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import ScenarioCard from "./components/ScenarioCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type FrequencyMode = "per_month" | "per_week" | "per_day" | "per_hour";
type AppTab = "scenarios" | "usage_modeling";
type CreditTier = "start" | "grow" | "scale" | "custom";

type Product = {
  id: string;
  name: string;
  sub: string;
  credits: number;
  runs: number;
  unitLabel: string;
  action: string;
  summaryUnit?: string;
  hasPrompt?: boolean;
  promptTitle?: string;
  promptText?: string;
  /** "one_time" products (e.g. Assets) show a badge indicating non-recurring cost */
  activityType?: "recurring" | "one_time";
  /** When true, the Monthly Volume cell renders a frequency dropdown */
  isFrequencyProduct?: boolean;
  frequencyMode?: FrequencyMode;
  /** Raw user input before normalizing to monthly runs */
  rawFrequencyInput?: number;
};

type ScenarioProductSnapshot = {
  productId: string;
  runs: number;
  label?: string;
  note?: string;
};

type Scenario = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  creditTier: CreditTier;
  baseAllocation: number;
  upsellCredits: number;
  users: number;
  tier: "power" | "mid" | "byok" | "grow";
  accentColor: "indigo" | "violet" | "emerald" | "amber";
  products: ScenarioProductSnapshot[];
  byokNote?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CREDIT_TIERS: Record<Exclude<CreditTier, "custom">, { label: string; base: number }> = {
  start: { label: "X1 / Start", base: 10_000_000 },
  grow:  { label: "X3 / Grow",  base: 20_000_000 },
  scale: { label: "X5 / Scale", base: 50_000_000 },
};

const FREQUENCY_MULTIPLIERS: Record<FrequencyMode, number> = {
  per_month: 1,
  per_week: 365 / 84,        // ≈ 4.345 weeks/month
  per_day: 365 / 12,         // ≈ 30.417 days/month
  per_hour: (365 / 12) * 24, // ≈ 730.0 hours/month
};

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "assets",
    name: "Assets",
    sub: "Upload Image and Generate Metadata",
    credits: 2580,
    runs: 0,
    unitLabel: "Images",
    action: "Upload and generate metadata for",
    activityType: "one_time",
  },
  {
    id: "automate",
    name: "Automate",
    sub: "One Execution with Multiple Steps",
    credits: 145,
    runs: 0,
    unitLabel: "Executions",
    action: "Run",
    isFrequencyProduct: true,
    frequencyMode: "per_month",
    rawFrequencyInput: 0,
  },
  { id: "brandkit_web", name: "Brand Kit", sub: "Vault from Website (per web page)", credits: 5142, runs: 0, unitLabel: "Web Pages", action: "Vault" },
  { id: "brandkit_pdf", name: "Brand Kit", sub: "Vault from PDF Document (per page)", credits: 390, runs: 0, unitLabel: "PDF Pages", action: "Vault" },
  { id: "studio_comp", name: "Visual Experience", sub: "Figma to Studio Component", credits: 53717, runs: 0, unitLabel: "Studio Components", action: "Generate" },
  { id: "react_comp", name: "Visual Experience", sub: "Figma to React Component", credits: 80433, runs: 0, unitLabel: "React Components", action: "Export" },
  { id: "polaris_art", name: "Polaris", sub: "Create and Article with SEO and Update Workflow", credits: 49500, runs: 0, unitLabel: "Prompts", summaryUnit: "Articles", hasPrompt: true, promptTitle: "Example Prompt", promptText: "Create a new 'page' entry about the Joys of Staying at the Red Panda. Add appropriate metadata and SEO tags and put it in the 'Review' workflow stage.", action: "Generate" },
  { id: "polaris_rel", name: "Polaris", sub: "Release & Deploy (Entry + Deployment)", credits: 75600, runs: 0, unitLabel: "Prompts", summaryUnit: "Releases", hasPrompt: true, promptTitle: "Example Prompt", promptText: "Take the last entry that was created and add it to the latest release. Then, deploy the release.", action: "Manage" },
  { id: "polaris_trans", name: "Polaris", sub: "Translate an Article from English to French", credits: 83000, runs: 0, unitLabel: "Prompts", summaryUnit: "Articles into another language", hasPrompt: true, promptTitle: "Example Prompt", promptText: "Translate this entry into French.", action: "Translate" },
  { id: "agent_story", name: "Custom Agents", sub: "Story Ideas (Research + 5 Ideas)", credits: 330000, runs: 0, unitLabel: "Runs", hasPrompt: true, promptTitle: "Example Use Case", promptText: "Agent that analyzes site analytics, does research and creates 5 story ideas.", action: "special" },
  { id: "agent_seo", name: "Custom Agents", sub: "SEO Meta Agent (Analyze & Tag)", credits: 35000, runs: 0, unitLabel: "Runs", summaryUnit: "Articles", hasPrompt: true, promptTitle: "Example Use Case", promptText: "Agent that analyzes one article and adds SEO metadata.", action: "Automate SEO tagging for" },
  { id: "agent_trans", name: "Custom Agents", sub: "Translate an Entry Upon Workflow Stage", credits: 50000, runs: 0, unitLabel: "Runs", summaryUnit: "Articles", hasPrompt: true, promptTitle: "Example Use Case", promptText: "Agent that translates an entry into 3 languages when it hits 'Translate' workflow stage.", action: "Orchestrate translations for" },
  { id: "concierge", name: "Digital Concierge", sub: "User Q&A (Knowledge Base Search)", credits: 3000, runs: 0, unitLabel: "Prompts", action: "special" },
];

// Scenario credit volumes calibrated so each scenario uses ~91–97% of its pool.
const SCENARIOS: Scenario[] = [
  {
    id: "power_customer",
    name: "Power Customer",
    tagline: "100 users · 500M credits · full platform",
    description: "A large enterprise team using every Contentstack AI feature at high daily volume. Polaris handles content creation, translation, and releases. Custom Agents automate SEO tagging, translation workflows, and story ideation. Brand Kit maintains brand consistency, Digital Concierge handles user Q&A, and Automate orchestrates the workflows that tie it all together.",
    creditTier: "scale",
    baseAllocation: 50_000_000,
    upsellCredits: 450_000_000,
    users: 100,
    tier: "power",
    accentColor: "indigo",
    products: [
      { productId: "assets",       runs: 5000,  note: "Initial image batch" },
      { productId: "automate",     runs: 6000,  note: "~200/day" },
      { productId: "brandkit_web", runs: 500,   note: "Brand vault maintenance" },
      { productId: "brandkit_pdf", runs: 2000,  note: "PDF brand content" },
      { productId: "studio_comp",  runs: 20 },
      { productId: "react_comp",   runs: 10 },
      { productId: "polaris_art",  runs: 1500,  note: "~50/day" },
      { productId: "polaris_rel",  runs: 600,   note: "~20/day" },
      { productId: "polaris_trans", runs: 900,  note: "~30/day" },
      { productId: "agent_story",  runs: 150,   note: "~5/day" },
      { productId: "agent_seo",    runs: 3000,  note: "~100/day" },
      { productId: "agent_trans",  runs: 1500,  note: "~50/day" },
      { productId: "concierge",    runs: 5000,  note: "~167/day" },
    ],
  },
  {
    id: "mid_tier",
    name: "Mid-Tier Customer",
    tagline: "25 users · 25M credits · focused toolset",
    description: "A growing content team focused on content intelligence and brand consistency. They use Polaris for article creation and localization, Custom Agents for SEO automation and translation workflows, and Brand Kit to keep their Knowledge Vault current. No Assets or Visual Experience usage in this profile.",
    creditTier: "grow",
    baseAllocation: 20_000_000,
    upsellCredits: 5_000_000,
    users: 25,
    tier: "mid",
    accentColor: "violet",
    products: [
      { productId: "polaris_art",   runs: 200, note: "~7/day" },
      { productId: "polaris_rel",   runs: 50 },
      { productId: "polaris_trans", runs: 50 },
      { productId: "agent_seo",     runs: 100 },
      { productId: "agent_trans",   runs: 50 },
      { productId: "brandkit_web",  runs: 50,  note: "Ongoing brand updates" },
      { productId: "brandkit_pdf",  runs: 200 },
    ],
  },
  {
    id: "byok",
    name: "BYOK Customer",
    tagline: "10M credits · brings own AI keys",
    description: "This customer uses Bring Your Own Key (BYOK) — they supply their own LLM API keys, so AI-powered features like Polaris, Custom Agents, and Digital Concierge consume zero Contentstack credits. However, three activities still run on Contentstack's managed infrastructure and consume credits regardless of BYOK: Automate Executions, Brand Kit Knowledge Vault ingestion, and Assets metadata processing.",
    creditTier: "start",
    baseAllocation: 10_000_000,
    upsellCredits: 0,
    users: 10,
    tier: "byok",
    accentColor: "emerald",
    byokNote: "Polaris, Custom Agents, and Digital Concierge use your own LLM keys — no Contentstack credits consumed for these features.",
    products: [
      { productId: "automate",     runs: 6000, note: "~200/day", label: "Automate Executions" },
      { productId: "brandkit_web", runs: 200,  note: "KV ingestion via web", label: "Brand Kit — Web Ingestion" },
      { productId: "brandkit_pdf", runs: 2000, note: "KV ingestion via PDF", label: "Brand Kit — PDF Ingestion" },
      { productId: "assets",       runs: 2500, note: "Metadata processing", label: "Assets" },
    ],
  },
  {
    id: "grow_base_only",
    name: "X3/Grow — Base Only",
    tagline: "15 users · 20M base allocation · no upsell",
    description: "An existing X3/Grow customer using only their included 20M base allocation. No additional credits purchased — this shows what's achievable at the Grow tier before any upsell. Load this into the calculator, then add Additional Credits to model the upsell opportunity.",
    creditTier: "grow",
    baseAllocation: 20_000_000,
    upsellCredits: 0,
    users: 15,
    tier: "grow",
    accentColor: "amber",
    products: [
      { productId: "brandkit_web",  runs: 20,  note: "Brand vault maintenance" },
      { productId: "brandkit_pdf",  runs: 100 },
      { productId: "polaris_art",   runs: 120, note: "~4/day" },
      { productId: "polaris_rel",   runs: 40 },
      { productId: "polaris_trans", runs: 25,  note: "Localization" },
      { productId: "agent_seo",     runs: 100, note: "SEO automation" },
      { productId: "agent_trans",   runs: 30 },
      { productId: "concierge",     runs: 940, note: "~31/day" },
    ],
    // Forecasted total: 19,000,840 credits = 95.0% of 20M
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPhrasing(product: Product, value: number, isCapacity: boolean) {
  const unit = product.summaryUnit || product.unitLabel;
  const valStr = value.toLocaleString();
  const prefix = isCapacity ? "up to " : "";
  if (product.id === "agent_story") return `Generate story Ideas ${prefix}${valStr} times using a Custom Agent.`;
  if (product.id === "concierge") return `Ask the Digital Concierge ${prefix}${valStr} Questions and get answers.`;
  if (product.id.includes("agent_")) return `${product.action} ${prefix}${valStr} ${unit} with a Custom Agent.`;
  if (product.id.includes("polaris")) return `${product.action} ${prefix}${valStr} ${unit} with ${product.name}.`;
  return `${product.action} ${prefix}${valStr} ${unit} with ${product.name}.`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AICreditCalculatorPage() {
  const [activeTab, setActiveTab] = useState<AppTab>("scenarios");
  const [selectedTier, setSelectedTier] = useState<CreditTier>("start");
  const [customBaseAllocation, setCustomBaseAllocation] = useState(10_000_000);
  const [upsellCredits, setUpsellCredits] = useState(0);
  const [costPerCredit, setCostPerCredit] = useState(0.0000155);
  const [overageRate, setOverageRate] = useState(0.0000185);
  const [products, setProducts] = useState<Product[]>(() => INITIAL_PRODUCTS.map((p) => ({ ...p })));
  const [isEditingConsumption, setIsEditingConsumption] = useState(false);
  const [promptModal, setPromptModal] = useState<{ open: boolean; title: string; content: string }>({ open: false, title: "", content: "" });
  const [summaryModal, setSummaryModal] = useState(false);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [copyButtonText, setCopyButtonText] = useState("Copy to Clipboard");
  const [numberOfUsers, setNumberOfUsers] = useState(10);
  const [showLegacyUi, setShowLegacyUi] = useState(false);
  const [activeFeatureFilters, setActiveFeatureFilters] = useState<Set<string>>(new Set());
  const [featureFilterOpen, setFeatureFilterOpen] = useState(false);
  const featureFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!featureFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (featureFilterRef.current && !featureFilterRef.current.contains(e.target as Node)) {
        setFeatureFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [featureFilterOpen]);

  // Derived credit pool values — base allocation is included in tier, upsell is billable
  const baseAllocation = selectedTier === "custom" ? customBaseAllocation : CREDIT_TIERS[selectedTier].base;
  const totalCredits = baseAllocation + upsellCredits;

  const volumeCredits = useMemo(() => {
    return products.reduce((sum, p) => sum + p.runs * p.credits, 0);
  }, [products]);

  const overageCredits = Math.max(0, volumeCredits - totalCredits);
  const subscriptionCost = upsellCredits * costPerCredit; // base allocation has no incremental cost
  const overageCost = overageCredits * overageRate;
  const totalCost = subscriptionCost + overageCost;
  const totalUtilPercent = totalCredits > 0 ? (volumeCredits / totalCredits) * 100 : 0;
  const remainingPool = Math.max(0, totalCredits - volumeCredits);

  const uniqueFeatureNames = useMemo(
    () => Array.from(new Set(products.map((p) => p.name))),
    [products]
  );

  const filteredProducts = useMemo(
    () => activeFeatureFilters.size === 0 ? products : products.filter((p) => activeFeatureFilters.has(p.name)),
    [products, activeFeatureFilters]
  );

  const toggleFeatureFilter = useCallback((name: string) => {
    setActiveFeatureFilters((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }, []);

  const creditsPerUser = useMemo(() => {
    if (!Number.isFinite(numberOfUsers) || numberOfUsers <= 0) return null;
    return Math.floor(totalCredits / numberOfUsers);
  }, [totalCredits, numberOfUsers]);

  const updateProductRuns = useCallback((index: number, runs: number) => {
    setProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], runs };
      return next;
    });
  }, []);

  const updateProductCredits = useCallback((index: number, credits: number) => {
    setProducts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], credits };
      return next;
    });
  }, []);

  const updateProductFrequency = useCallback((index: number, mode: FrequencyMode, rawInput: number) => {
    setProducts((prev) => {
      const next = [...prev];
      const runs = Math.round(rawInput * FREQUENCY_MULTIPLIERS[mode]);
      next[index] = { ...next[index], frequencyMode: mode, rawFrequencyInput: rawInput, runs };
      return next;
    });
  }, []);

  const resetAllRuns = useCallback(() => {
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        runs: 0,
        ...(p.isFrequencyProduct ? { rawFrequencyInput: 0 } : {}),
      }))
    );
  }, []);

  const loadScenario = useCallback((scenario: Scenario) => {
    setSelectedTier(scenario.creditTier);
    setUpsellCredits(scenario.upsellCredits);
    setNumberOfUsers(scenario.users);
    setProducts(
      INITIAL_PRODUCTS.map((p) => {
        const snap = scenario.products.find((s) => s.productId === p.id);
        const runs = snap?.runs ?? 0;
        if (p.isFrequencyProduct) {
          return { ...p, runs, rawFrequencyInput: runs, frequencyMode: "per_month" as FrequencyMode };
        }
        return { ...p, runs };
      })
    );
    setActiveTab("usage_modeling");
  }, []);

  const onTierChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const tier = e.target.value as CreditTier;
    if (tier === "custom") {
      // Seed custom value from the currently selected tier so the number doesn't jump
      setCustomBaseAllocation((prev) => prev);
    }
    setSelectedTier(tier);
  }, []);

  const onCustomBaseChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits === "") { setCustomBaseAllocation(0); return; }
    setCustomBaseAllocation(Number.parseInt(digits, 10));
  }, []);

  const onUpsellChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits === "") { setUpsellCredits(0); return; }
    const n = Number.parseInt(digits, 10);
    if (!Number.isNaN(n)) setUpsellCredits(n);
  }, []);

  const onMonthlyVolumeChange = useCallback((index: number, e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits === "") { updateProductRuns(index, 0); return; }
    const n = Number.parseInt(digits, 10);
    if (!Number.isNaN(n)) updateProductRuns(index, n);
  }, [updateProductRuns]);

  const generateSummary = useCallback(() => {
    const poolStr = totalCredits.toLocaleString();
    const forecastStr = volumeCredits.toLocaleString();
    const costStr = totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const utilStr = totalUtilPercent.toFixed(1) + "%";
    const overageCostStr = overageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const overageText = overageCredits > 0
      ? `This modeling includes +${overageCredits.toLocaleString()} credits in overage usage (representing $${overageCostStr} of the total forecast).`
      : "This modeling fits comfortably within your total credit pool.";

    let currentProjections = "";
    let remainingCapacityList = "";
    let hasAnyUsage = false;

    products.forEach((product) => {
      if (product.runs > 0) {
        hasAnyUsage = true;
        currentProjections += `<p class="mb-3">${buildPhrasing(product, product.runs, false)}</p>`;
      }
      if (remainingPool > 0) {
        const maxPossible = Math.floor(remainingPool / product.credits);
        if (maxPossible > 0) remainingCapacityList += `<li>${buildPhrasing(product, maxPossible, true)}</li>`;
      }
    });

    const forecastedUsageSection = hasAnyUsage
      ? `<div class="mb-6"><h4 class="font-bold text-slate-800 mb-4">Forecasted Usage</h4>${currentProjections}</div>`
      : "";
    const remainingSection = remainingPool > 0
      ? `<div><p class="mb-4 text-indigo-700 font-bold">With your remaining balance of ${remainingPool.toLocaleString()} available credits, you could still do any of the following:</p><ul class="list-disc pl-5 space-y-2 text-slate-600">${remainingCapacityList}</ul></div>`
      : volumeCredits > totalCredits
        ? `<div><p class="text-rose-600 font-bold">Current volume projections have exhausted the standard pool. Future runs will be billed at the overage rate.</p></div>`
        : "";

    const track = `
      <p class="text-lg">With <strong>${poolStr} credits</strong> per month and a forecast usage of <strong>${forecastStr} credits</strong>, the total monthly billing forecast is <strong>$${costStr}</strong>.</p>
      <br>
      <p>${overageText} This represents a utilization rate of ${utilStr}.</p>
      <br>
      <div class="mt-2 pt-6 border-t border-slate-100">
        ${forecastedUsageSection}
        <div class="${hasAnyUsage ? "mt-6 pt-4 border-t border-dashed border-slate-200" : ""}">
          ${remainingSection}
        </div>
      </div>
    `;
    setSummaryHtml(track);
    setSummaryModal(true);
  }, [totalCredits, volumeCredits, totalCost, totalUtilPercent, overageCredits, overageCost, remainingPool, products]);

  const copySummary = useCallback(async () => {
    const plainEl = document.createElement("div");
    plainEl.innerHTML = summaryHtml;
    const plainText = plainEl.innerText || plainEl.textContent || "";
    const htmlForClipboard = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${summaryHtml}</body></html>`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([htmlForClipboard], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        }),
      ]);
      setCopyButtonText("Copied!");
      setTimeout(() => setCopyButtonText("Copy to Clipboard"), 2000);
    } catch {
      navigator.clipboard.writeText(plainText).then(() => {
        setCopyButtonText("Copied!");
        setTimeout(() => setCopyButtonText("Copy to Clipboard"), 2000);
      });
    }
  }, [summaryHtml]);

  return (
    <div className="max-w-7xl mx-auto pb-12 p-4 md:p-8">
      {/* Header */}
      <header className="mb-6 border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">AI Credit Estimator</h1>
          <p className="text-slate-500 mt-2">Estimate AI credit usage and billing based on your customer's expected feature usage.</p>
        </div>
        {activeTab === "usage_modeling" && (
          <div className="text-right flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setShowLegacyUi((v) => !v)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-50 rounded-md px-2.5 py-1 shadow-sm transition-colors"
            >
              {showLegacyUi ? "New View" : "Old View"}
            </button>
            {showLegacyUi && <span className="text-xs font-mono text-slate-400">v3.10.0 - Dynamic Max Thresholds</span>}
          </div>
        )}
      </header>

      {/* Tab bar */}
      <div role="tablist" className="flex border-b border-slate-200 mb-8 -mt-2">
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "scenarios"}
          onClick={() => setActiveTab("scenarios")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "scenarios"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Example Scenarios
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={activeTab === "usage_modeling"}
          onClick={() => setActiveTab("usage_modeling")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
            activeTab === "usage_modeling"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Usage Modeling
        </button>
      </div>

      {/* ── Example Scenarios tab ─────────────────────────────────────────── */}
      {activeTab === "scenarios" && (
        <div>
          <div className="mb-6">
            <p className="text-sm text-slate-500">
              Example customer profile scenarios showing how different types of customers might use and consume AI credits. Load any scenario into the estimator as a starting point.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SCENARIOS.map((scenario) => {
              const displayProducts = scenario.products.map((snap) => {
                const product = INITIAL_PRODUCTS.find((p) => p.id === snap.productId);
                return {
                  productId: snap.productId,
                  name: product?.name ?? snap.productId,
                  label: snap.label,
                  note: snap.note,
                  runs: snap.runs,
                  totalCredits: snap.runs * (product?.credits ?? 0),
                };
              });
              const forecastedCredits = displayProducts.reduce((sum, p) => sum + p.totalCredits, 0);
              return (
                <ScenarioCard
                  key={scenario.id}
                  name={scenario.name}
                  tagline={scenario.tagline}
                  description={scenario.description}
                  baseAllocation={scenario.baseAllocation}
                  upsellCredits={scenario.upsellCredits}
                  creditTierLabel={scenario.creditTier === "custom" ? "Custom" : CREDIT_TIERS[scenario.creditTier].label}
                  users={scenario.users}
                  tier={scenario.tier}
                  accentColor={scenario.accentColor}
                  products={displayProducts}
                  forecastedCredits={forecastedCredits}
                  byokNote={scenario.byokNote}
                  onLoad={() => loadScenario(scenario)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Usage Modeling tab ────────────────────────────────────────────── */}
      {activeTab === "usage_modeling" && (
        <>
          {/* Top metrics — legacy vs redesigned */}
          {showLegacyUi ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
              {/* Legacy: Monthly Credit Pool — read-only total (dev view) */}
              <div className="calculator-metric-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monthly Credit Pool</label>
                  <input
                    type="number"
                    value={totalCredits}
                    readOnly
                    className="text-2xl font-bold text-slate-800 w-full focus:outline-none bg-transparent"
                  />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Contracted Capacity</p>
                  <div className="h-4" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 calculator-metric-card">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Projected Consumption</label>
                  <span className="text-2xl font-bold text-slate-800">{volumeCredits.toLocaleString()}</span>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Total Volume Credits</p>
                  <div className={`flex justify-between items-center text-xs font-bold uppercase tracking-tighter transition-colors duration-300 ${overageCredits > 0 ? "text-rose-500" : "text-slate-400"}`}>
                    <span>Additional Consumption:</span>
                    <span>+{overageCredits.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="calculator-metric-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cost per Credit</label>
                  <div className="flex items-center">
                    <span className="text-xl font-semibold text-slate-400 mr-1">$</span>
                    <input type="number" value={costPerCredit} step={0.0000001} onChange={(e) => setCostPerCredit(Number(e.target.value) || 0)} className="text-2xl font-bold text-slate-800 w-full focus:outline-none" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Pool Unit Price</p>
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tighter">
                    <span className="text-slate-400">Consumption Rate:</span>
                    <div className="flex items-center text-slate-800">
                      <span>$</span>
                      <input type="number" value={overageRate} step={0.0000001} onChange={(e) => setOverageRate(Number(e.target.value) || 0)} className="bg-transparent text-right w-20 focus:outline-none font-bold" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-600 p-5 rounded-xl shadow-lg border border-indigo-700 text-white calculator-metric-card">
                <div>
                  <label className="block text-xs font-semibold text-indigo-100 uppercase tracking-wider mb-1">Total Billing Forecast</label>
                  <div className="flex items-center">
                    <span className="text-xl font-semibold text-indigo-200 mr-1">$</span>
                    <span className="text-3xl font-bold">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-xs uppercase font-bold tracking-tighter opacity-70">
                    <span>Base Allocation:</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase font-bold tracking-tighter">
                    <span className="opacity-70">Additional Credits:</span>
                    <span>${subscriptionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between text-xs uppercase font-bold tracking-tighter transition-all duration-300 ${overageCredits > 0 ? "text-amber-300 opacity-100" : "opacity-50"}`}>
                    <span>Est. Consumption Billing:</span>
                    <span>${overageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // New view: pool card full-width on top, then 3-column grid for metrics below
            <div className="mb-10 space-y-6">

              {/* Monthly Credit Pool — full width */}
              <div className="calculator-metric-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Monthly Credit Pool
                </label>
                <div className="flex divide-x divide-slate-100">

                  {/* Base Allocation */}
                  <div className="flex-1 pr-8">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1 flex items-center gap-1">
                      Base Allocation
                      {selectedTier === "custom" && (
                        <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 16 16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064L11.19 6.25z"/></svg>
                      )}
                    </p>
                    {selectedTier === "custom" ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={customBaseAllocation.toLocaleString("en-US")}
                        onChange={onCustomBaseChange}
                        className="text-2xl font-bold text-slate-800 w-full tabular-nums bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none transition-all"
                        placeholder="0"
                        aria-label="Custom base allocation"
                      />
                    ) : (
                      <p className="text-2xl font-bold text-slate-800 tabular-nums">{baseAllocation.toLocaleString()}</p>
                    )}
                    <div className="mt-2">
                      <select
                        id="credit-tier-select"
                        value={selectedTier}
                        onChange={onTierChange}
                        className="border border-slate-200 bg-slate-50 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                      >
                        {(Object.entries(CREDIT_TIERS) as [CreditTier, { label: string; base: number }][]).map(([key, t]) => (
                          <option key={key} value={key}>{t.label}</option>
                        ))}
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {selectedTier === "custom" ? "Custom allocation" : "Included in tier"}
                    </p>
                  </div>

                  {/* Additional Credits (upsell) */}
                  <div className="flex-1 px-8">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1 flex items-center gap-1">
                      Additional Credits
                      <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 16 16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064L11.19 6.25z"/></svg>
                    </p>
                    <input
                      id="upsell-credits-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={upsellCredits.toLocaleString("en-US")}
                      onChange={onUpsellChange}
                      className="text-2xl font-bold text-slate-800 w-full tabular-nums bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none transition-all"
                      placeholder="0"
                    />
                    <div className="h-4 mt-1">
                      {volumeCredits > baseAllocation && (
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Usage requires {(volumeCredits - baseAllocation).toLocaleString()} credits beyond base.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Total Pool */}
                  <div className="flex-1 pl-8">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1">Total Pool</p>
                    <p className="text-2xl font-bold text-slate-800 tabular-nums">{totalCredits.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1">Contracted Capacity</p>
                  </div>

                </div>
              </div>

              {/* Metric cards row — 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Projected Consumption */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 calculator-metric-card">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Projected Consumption</label>
                  <span className="text-2xl font-bold text-slate-800">{volumeCredits.toLocaleString()}</span>
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Total Volume Credits</p>
                  <div className={`flex justify-between items-center text-xs font-bold uppercase tracking-tighter transition-colors duration-300 ${overageCredits > 0 ? "text-rose-500" : "text-slate-400"}`}>
                    <span>Additional Consumption:</span>
                    <span>+{overageCredits.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Hidden pricing inputs — still drive math */}
              <div className="hidden" aria-hidden="true">
                <div className="calculator-metric-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cost per Credit</label>
                    <div className="flex items-center">
                      <span className="text-xl font-semibold text-slate-400 mr-1">$</span>
                      <input type="number" value={costPerCredit} step={0.0000001} onChange={(e) => setCostPerCredit(Number(e.target.value) || 0)} className="text-2xl font-bold text-slate-800 w-full focus:outline-none" />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Pool Unit Price</p>
                    <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tighter">
                      <span className="text-slate-400">Overage Rate:</span>
                      <div className="flex items-center text-slate-800">
                        <span>$</span>
                        <input type="number" value={overageRate} step={0.0000001} onChange={(e) => setOverageRate(Number(e.target.value) || 0)} className="bg-transparent text-right w-20 focus:outline-none font-bold" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Billing Forecast */}
              <div className="bg-indigo-600 p-5 rounded-xl shadow-lg border border-indigo-700 text-white calculator-metric-card">
                <div>
                  <label className="block text-xs font-semibold text-indigo-100 uppercase tracking-wider mb-1">Total Billing Forecast</label>
                  <div className="flex items-center">
                    <span className="text-xl font-semibold text-indigo-200 mr-1">$</span>
                    <span className="text-3xl font-bold">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-xs uppercase font-bold tracking-tighter opacity-70">
                    <span>Base Allocation:</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase font-bold tracking-tighter">
                    <span className="opacity-70">Additional Credits:</span>
                    <span>${subscriptionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between text-xs uppercase font-bold tracking-tighter transition-all duration-300 ${overageCredits > 0 ? "text-amber-300 opacity-100" : "opacity-50"}`}>
                    <span>Est. Consumption Billing:</span>
                    <span>${overageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Number of Users */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 calculator-metric-card">
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Number of Users
                    <svg className="w-2.5 h-2.5 opacity-50" viewBox="0 0 16 16" fill="currentColor"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064L11.19 6.25z"/></svg>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={numberOfUsers}
                    onChange={(e) => setNumberOfUsers(Math.max(0, Number(e.target.value) || 0))}
                    className="text-2xl font-bold text-slate-800 w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none transition-all"
                    aria-label="Number of users"
                  />
                </div>
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-tighter text-slate-400">
                    <span>Credits Per User:</span>
                    <span className="text-slate-800 tabular-nums">
                      {creditsPerUser != null ? creditsPerUser.toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>

              </div>{/* end 3-col metric grid */}
            </div>
          )}

          {/* Product table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              {showLegacyUi ? (
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-slate-800">Usage Modeling by Monthly Volume</h2>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${totalUtilPercent > 100.1 ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200" : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"}`}>
                      Total Pool Used: {totalUtilPercent.toFixed(1)}%
                    </span>
                    <button type="button" onClick={generateSummary} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
                      Summarize
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-slate-800">Usage Modeling by Monthly Volume</h2>
                    <p className="text-sm text-slate-600 mt-1 leading-snug">
                      Enter your customer's expected monthly volume for each feature to calculate projected credit usage and billing.
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-400 italic mt-1.5 leading-tight tracking-tight">
                      Credit consumption estimates are based on typical usage patterns and will vary depending on content length and task complexity.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${totalUtilPercent > 100.1 ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200" : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"}`}>
                      Total Pool Used: {totalUtilPercent.toFixed(1)}%
                    </span>
                    <button type="button" onClick={generateSummary} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
                      Summarize
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-x-auto table-container">
              <table className="w-full text-left border-separate border-spacing-0" style={{ tableLayout: "fixed" }} id="mainTable">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 shadow-sm text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 bg-slate-50 w-[12%] border-b border-slate-200">
                      <div className="relative flex items-center gap-1.5" ref={featureFilterRef}>
                        <span>Feature</span>
                        <button
                          type="button"
                          onClick={() => setFeatureFilterOpen((v) => !v)}
                          title="Filter by feature"
                          className={`p-0.5 rounded transition-colors ${activeFeatureFilters.size > 0 ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"}`}
                        >
                          {/* Funnel/filter icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill={activeFeatureFilters.size > 0 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                          </svg>
                          {activeFeatureFilters.size > 0 && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                              {activeFeatureFilters.size}
                            </span>
                          )}
                        </button>

                        {featureFilterOpen && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[160px]">
                            {activeFeatureFilters.size > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveFeatureFilters(new Set())}
                                className="w-full text-left px-3 py-1.5 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 border-b border-slate-100"
                              >
                                Clear all filters
                              </button>
                            )}
                            {uniqueFeatureNames.map((name) => {
                              const active = activeFeatureFilters.has(name);
                              return (
                                <label
                                  key={name}
                                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggleFeatureFilter(name)}
                                    className="accent-indigo-600 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs font-medium text-slate-700 normal-case tracking-normal">{name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="p-4 bg-slate-50 w-[28%] border-b border-slate-200">Use Case</th>
                    <th className={`p-4 bg-slate-50 w-[18%] border-b border-slate-200 text-center transition-colors ${isEditingConsumption ? "text-indigo-600" : ""}`}>
                      <div className="flex items-center justify-center gap-2">
                        <span>Average Consumption</span>
                        {showLegacyUi && (
                          <button type="button" onClick={() => setIsEditingConsumption((v) => !v)} title="Edit consumption values" className={`p-1 hover:bg-slate-200 rounded-md transition-colors focus:outline-none ${isEditingConsumption ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-indigo-600"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                          </button>
                        )}
                      </div>
                    </th>
                    <th className="p-4 bg-slate-50 w-1/4 text-center border-b border-slate-200">
                      <div className="flex items-center justify-center gap-2">
                        <span>Est. Monthly Volume</span>
                        <button type="button" onClick={resetAllRuns} title="Reset all volumes to 0" className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-indigo-600 focus:outline-none">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                        </button>
                      </div>
                    </th>
                    <th className="p-4 bg-slate-50 w-1/4 text-right border-b border-slate-200">Utilization %</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const index = products.indexOf(p);
                    const featureTotalCredits = p.runs * p.credits;
                    const featureUtilPercent = totalCredits > 0 ? (featureTotalCredits / totalCredits) * 100 : 0;
                    const additionalPossible = p.credits > 0 ? Math.floor(remainingPool / p.credits) : 0;
                    const dynamicMax = p.runs + additionalPossible;
                    const barColor = featureUtilPercent > 100 ? "bg-rose-500" : featureUtilPercent > 50 ? "bg-amber-500" : "bg-indigo-500";
                    return (
                      <tr key={p.id} className="product-row border-b border-slate-50 hover:bg-slate-50/80">
                        {/* Feature */}
                        <td className="p-4 align-top">
                          <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                        </td>

                        {/* Use Case */}
                        <td className="p-4 align-top">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <div className="text-sm text-slate-600 leading-tight break-words">{p.sub}</div>
                              {p.hasPrompt && p.promptTitle && p.promptText && (
                                <button type="button" onClick={() => setPromptModal({ open: true, title: p.promptTitle!, content: p.promptText! })} title="View details" className="shrink-0 text-indigo-400 hover:text-indigo-600 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                </button>
                              )}
                            </div>
                            {p.activityType === "one_time" && (
                              <span
                                className="mt-1.5 self-start bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                title="Typically processed once — not a recurring monthly cost. Volume here represents new images ingested in the period."
                              >
                                One-Time Activity
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Average Consumption */}
                        <td className={`p-4 align-top text-center transition-colors ${isEditingConsumption ? "bg-indigo-50/50" : ""}`}>
                          {!isEditingConsumption ? (
                            <div className="text-sm whitespace-nowrap">
                              <span className="font-bold text-slate-800">{p.credits.toLocaleString()}</span>
                              <span className="ml-1 text-slate-400">Credits</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <input type="number" value={p.credits} onChange={(e) => updateProductCredits(index, Number(e.target.value) || 0)} className="consumption-input bg-white rounded-md px-2 py-1 w-full max-w-[120px] border border-slate-300 text-sm font-mono font-semibold focus:ring-1 focus:ring-indigo-500 outline-none" />
                              <span className="text-xs font-medium text-slate-400">Credits</span>
                            </div>
                          )}
                        </td>

                        {/* Monthly Volume */}
                        <td className="p-4 text-center align-top">
                          {p.isFrequencyProduct ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  aria-label={`Volume for ${p.name}`}
                                  value={(p.rawFrequencyInput ?? 0) || ""}
                                  onChange={(e) => {
                                    const n = Math.max(0, Number(e.target.value) || 0);
                                    updateProductFrequency(index, p.frequencyMode ?? "per_month", n);
                                  }}
                                  className="run-input bg-white rounded-md px-2 py-1.5 w-20 border border-slate-300 text-center font-bold text-slate-800 tabular-nums focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm text-sm"
                                  placeholder="0"
                                />
                                <select
                                  value={p.frequencyMode ?? "per_month"}
                                  onChange={(e) => updateProductFrequency(index, e.target.value as FrequencyMode, p.rawFrequencyInput ?? 0)}
                                  className="text-xs font-semibold text-slate-600 border border-slate-200 bg-white rounded-md px-2 py-1.5 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                                >
                                  <option value="per_month">/ month</option>
                                  <option value="per_week">/ week</option>
                                  <option value="per_day">/ day</option>
                                  <option value="per_hour">/ hour</option>
                                </select>
                              </div>
                              {p.frequencyMode !== "per_month" ? (
                                <span className="text-[10px] text-indigo-500 font-semibold leading-none">
                                  = {p.runs.toLocaleString()} / month
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 leading-none">{p.unitLabel}</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              {showLegacyUi ? (
                                <input
                                  type="number"
                                  min={0}
                                  value={p.runs}
                                  onChange={(e) => updateProductRuns(index, Number(e.target.value) || 0)}
                                  onFocus={(e) => e.target.select()}
                                  className="run-input bg-white rounded-md px-3 py-1.5 w-24 border border-slate-300 text-center font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                                  placeholder="0"
                                />
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  aria-label={`Monthly volume for ${p.name}`}
                                  value={p.runs || ""}
                                  onChange={(e) => updateProductRuns(index, Math.max(0, Number(e.target.value) || 0))}
                                  className="run-input bg-white rounded-md px-3 py-1.5 min-w-[6.5rem] max-w-[10rem] border border-slate-300 text-center font-bold text-slate-800 tabular-nums focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                                  placeholder="0"
                                />
                              )}
                              <span className="text-[10px] text-slate-400 mt-1 block leading-none">{p.unitLabel}</span>
                            </div>
                          )}
                        </td>

                        {/* Utilization % */}
                        <td className="p-4 align-top">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-mono font-bold text-indigo-600">{featureUtilPercent.toFixed(1)}%</span>
                            <div className="w-full max-w-[120px] bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className={`${barColor} h-full transition-all duration-300 ease-out`} style={{ width: `${Math.min(featureUtilPercent, 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block leading-none whitespace-nowrap">
                              Max {p.unitLabel}: <span className="font-semibold text-slate-500">{dynamicMax.toLocaleString()}</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Prompt modal */}
      <div className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center px-4 transition-opacity duration-200 ${promptModal.open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-widest flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <span>{promptModal.title}</span>
            </h3>
            <button type="button" onClick={() => setPromptModal((m) => ({ ...m, open: false }))} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="p-8">
            <p className="text-slate-700 leading-relaxed italic">{promptModal.content}</p>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button type="button" onClick={() => setPromptModal((m) => ({ ...m, open: false }))} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors">Got it</button>
          </div>
        </div>
      </div>

      {/* Summary modal */}
      <div className={`fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center px-4 transition-opacity duration-200 ${summaryModal ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
              Utilization Talk Track
            </h3>
            <button type="button" onClick={() => setSummaryModal(false)} className="text-white/80 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="p-8 max-h-[70vh] overflow-y-auto bg-slate-50">
            <p className="text-sm text-slate-500 mb-6 italic">
              Use the talk track below to help explain what can be done at various credit levels and use cases. Please note that these numbers are examples and that usage will vary based on users&apos; actual inputs and outputs.
            </p>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
          </div>
          <div className="p-4 bg-white border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={copySummary} className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-bold transition-colors">{copyButtonText}</button>
            <button type="button" onClick={() => setSummaryModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-bold transition-colors">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
