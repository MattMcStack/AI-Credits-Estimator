"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
// ScenarioCard component retained but detail panel is now inline

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
  /** Fixed credits charged per run/execution (same pill style as one-time badge) */
  fixedCreditCost?: boolean;
  /** When true, the Monthly Volume cell renders a frequency dropdown */
  isFrequencyProduct?: boolean;
  frequencyMode?: FrequencyMode;
  /** Raw user input before normalizing to monthly runs */
  rawFrequencyInput?: number;
  /** User-defined custom row — all fields are editable inline */
  isCustom?: boolean;
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
  cardLine: string;
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

type ExportedConfig = {
  version: 1;
  exportedAt: string;
  selectedTier: CreditTier;
  customBaseAllocation: number;
  upsellCredits: number;
  costPerCredit: number;
  overageRate: number;
  numberOfUsers: number;
  products: {
    id: string;
    runs: number;
    frequencyMode?: FrequencyMode;
    rawFrequencyInput?: number;
  }[];
  customProducts?: {
    id: string;
    name: string;
    sub: string;
    credits: number;
    runs: number;
  }[];
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
  { id: "agent_seo", name: "Agents", sub: "Analyze an entry and update SEO tags", credits: 35000, runs: 0, unitLabel: "Runs", summaryUnit: "Articles", hasPrompt: true, promptTitle: "Example Use Case", promptText: "Agent that analyzes one article and adds SEO metadata.", action: "Automate SEO tagging for" },
  { id: "agent_story", name: "Agents", sub: "Research & generate 5 story ideas", credits: 330000, runs: 0, unitLabel: "Runs", hasPrompt: true, promptTitle: "Example Use Case", promptText: "Agent that analyzes site analytics, does research and creates 5 story ideas.", action: "special" },
  { id: "agent_trans", name: "Agents", sub: "Translate an entry upon workflow stage change", credits: 50000, runs: 0, unitLabel: "Runs", summaryUnit: "Articles", hasPrompt: true, promptTitle: "Example Use Case", promptText: "Agent that translates an entry into 3 languages when it hits 'Translate' workflow stage.", action: "Orchestrate translations for" },
  {
    id: "automate",
    name: "Agents / Automate",
    sub: "One agent or automate execution",
    credits: 150,
    fixedCreditCost: true,
    runs: 0,
    unitLabel: "Executions",
    action: "Run",
    isFrequencyProduct: true,
    frequencyMode: "per_month",
    rawFrequencyInput: 0,
  },
  {
    id: "assets",
    name: "Assets",
    sub: "Upload Image and Generate Metadata",
    credits: 1000,
    runs: 0,
    unitLabel: "Images",
    action: "Upload and generate metadata for",
    activityType: "one_time",
    fixedCreditCost: true,
  },
  { id: "brandkit_pdf", name: "Brand Kit", sub: "Knowledge Vault file ingestion (per page)", credits: 400, runs: 0, unitLabel: "PDF Pages", action: "Vault" },
  { id: "brandkit_web", name: "Brand Kit", sub: "Knowledge Vault ingestion from website url (per web page)", credits: 5200, runs: 0, unitLabel: "Web Pages", action: "Vault" },
  { id: "polaris_rel", name: "Polaris", sub: "Add entry to release and deploy", credits: 75000, runs: 0, unitLabel: "Prompts", summaryUnit: "Releases", hasPrompt: true, promptTitle: "Example Prompt", promptText: "Take the last entry that was created and add it to the latest release. Then, deploy the release.", action: "Manage" },
  { id: "polaris_art", name: "Polaris", sub: "Create an Article with SEO and Change Workflow Status", credits: 50000, runs: 0, unitLabel: "Prompts", summaryUnit: "Articles", hasPrompt: true, promptTitle: "Example Prompt", promptText: "Create a new 'page' entry about the Joys of Staying at the Red Panda. Add appropriate metadata and SEO tags and put it in the 'Review' workflow stage.", action: "Generate" },
  { id: "polaris_trans", name: "Polaris", sub: "Translate an Article from English to French", credits: 85000, runs: 0, unitLabel: "Prompts", summaryUnit: "Articles into another language", hasPrompt: true, promptTitle: "Example Prompt", promptText: "Translate this entry into French.", action: "Translate" },
  { id: "react_comp", name: "Visual Studio", sub: "Convert Figma Design to React Component", credits: 80000, runs: 0, unitLabel: "React Components", action: "Export" },
  { id: "studio_comp", name: "Visual Studio", sub: "Convert Figma Design to Studio Component", credits: 54000, runs: 0, unitLabel: "Studio Components", action: "Generate" },
];

// Scenario credit volumes calibrated so each scenario uses ~91–97% of its pool.
const SCENARIOS: Scenario[] = [
  {
    id: "grow_base_only",
    name: "Net-New Customer",
    cardLine: "Included credits only — no upsell purchased",
    tagline: "15 users · 20M base allocation · no upsell",
    description: "A net-new customer using only their included 20M base allocation — Polaris, Agents, Brand Kit, plus a steady volume of Agent and Automate executions. No additional credits purchased — this shows what's achievable with that starter footprint before any upsell. Load this into the calculator, then add Additional Credits to model the upsell opportunity.",
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
      { productId: "automate",      runs: 12000, note: "~400/day" },
    ],
    // Forecasted total: 18,069,000 credits = 90.3% of 20M
  },
  {
    id: "power_customer",
    name: "Enterprise — Heavy Usage",
    cardLine: "Full platform — sustained, daily usage",
    tagline: "100 users · 500M credits · full platform",
    description: "A large enterprise team using Contentstack AI at high daily volume across Polaris, Agents, Brand Kit, Automate, and Assets. Polaris handles content creation, translation, and releases. Agents automate SEO tagging, translation workflows, and story ideation. Brand Kit maintains brand consistency, and Automate orchestrates the workflows that tie it all together.",
    creditTier: "scale",
    baseAllocation: 50_000_000,
    upsellCredits: 450_000_000,
    users: 100,
    tier: "power",
    accentColor: "indigo",
    products: [
      { productId: "assets",       runs: 13000, note: "Initial image batch" },
      { productId: "automate",     runs: 6300,  note: "~210/day" },
      { productId: "brandkit_web", runs: 500,   note: "Brand vault maintenance" },
      { productId: "brandkit_pdf", runs: 2000,  note: "PDF brand content" },
      { productId: "polaris_art",  runs: 1508,  note: "~50/day" },
      { productId: "polaris_rel",  runs: 605,   note: "~20/day" },
      { productId: "polaris_trans", runs: 906,  note: "~30/day" },
      { productId: "agent_story",  runs: 150,   note: "~5/day" },
      { productId: "agent_seo",    runs: 3010,  note: "~100/day" },
      { productId: "agent_trans",  runs: 1504,  note: "~50/day" },
    ],
  },
  {
    id: "mid_tier",
    name: "Growing Content Team",
    cardLine: "Mid-size team — Editorial workflow + automation",
    tagline: "25 users · 30M credits · focused toolset",
    description: "A growing content team focused on content intelligence and brand consistency. They use Polaris for article creation and localization, Agents for SEO automation and translation workflows, and Brand Kit to keep their Knowledge Vault current. No Assets or Visual Studio usage in this profile.",
    creditTier: "grow",
    baseAllocation: 20_000_000,
    upsellCredits: 10_000_000,
    users: 25,
    tier: "mid",
    accentColor: "violet",
    products: [
      { productId: "polaris_art",   runs: 240, note: "~8/day" },
      { productId: "polaris_rel",   runs: 60 },
      { productId: "polaris_trans", runs: 60 },
      { productId: "agent_seo",     runs: 120 },
      { productId: "agent_trans",   runs: 60 },
      { productId: "brandkit_web",  runs: 60,  note: "Ongoing brand updates" },
      { productId: "brandkit_pdf",  runs: 240 },
    ],
  },
  {
    id: "byok",
    name: "BYOK Customer",
    cardLine: "Own LLM Keys — platform services still bill",
    tagline: "10M credits · brings own AI keys",
    description: "This customer uses Bring Your Own Key (BYOK) — they supply their own LLM API keys, so AI-powered features like Polaris and Agents don't consume Contentstack credits. However, three activities still run on Contentstack's managed infrastructure and consume credits regardless of BYOK: Automate & Agent Executions, Brand Kit Knowledge Vault ingestion, and Assets metadata processing.",
    creditTier: "start",
    baseAllocation: 10_000_000,
    upsellCredits: 0,
    users: 10,
    tier: "byok",
    accentColor: "emerald",
    byokNote: "Polaris and Agents use your own LLM keys — no Contentstack credits consumed for these features.",
    products: [
      { productId: "automate",     runs: 6000, note: "~200/day", label: "Automate Executions" },
      { productId: "brandkit_web", runs: 200,  note: "KV ingestion via web", label: "Brand Kit — Web Ingestion" },
      { productId: "brandkit_pdf", runs: 2000, note: "KV ingestion via PDF", label: "Brand Kit — PDF Ingestion" },
      { productId: "assets",       runs: 6500, note: "Metadata processing", label: "Assets" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPhrasing(product: Product, value: number, isCapacity: boolean) {
  const valStr = value.toLocaleString();
  const p = isCapacity ? "up to " : "";
  switch (product.id) {
    case "assets": return `Upload and generate metadata for ${p}${valStr} images.`;
    case "automate": return `Run ${p}${valStr} agent or Automate executions.`;
    case "brandkit_web": return `Ingest ${p}${valStr} web pages into Knowledge Vault.`;
    case "brandkit_pdf": return `Ingest ${p}${valStr} PDF pages into Knowledge Vault.`;
    case "studio_comp": return `Convert ${p}${valStr} Figma designs to Studio components.`;
    case "react_comp": return `Convert ${p}${valStr} Figma designs to React components.`;
    case "polaris_art": return `Create ${p}${valStr} articles with SEO and change workflow status.`;
    case "polaris_rel": return `Add ${p}${valStr} entries to a release and deploy.`;
    case "polaris_trans": return `Translate ${p}${valStr} articles into another language.`;
    case "agent_story": return `Research and generate story ideas ${p}${valStr} times.`;
    case "agent_seo": return `Analyze ${p}${valStr} entries and update SEO tags.`;
    case "agent_trans": return `Translate ${p}${valStr} entries upon workflow stage change.`;
    default: return `${product.action} ${p}${valStr} ${product.summaryUnit || product.unitLabel}.`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AICreditCalculatorPage() {
  const [activeTab, setActiveTab] = useState<AppTab>("scenarios");
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCENARIOS[0].id);
  const [selectedTier, setSelectedTier] = useState<CreditTier>("start");
  const [customBaseAllocation, setCustomBaseAllocation] = useState(10_000_000);
  const [upsellCredits, setUpsellCredits] = useState(0);
  const [costPerCredit, setCostPerCredit] = useState(0.0000155);
  const [overageRate, setOverageRate] = useState(0.0000185);
  const [products, setProducts] = useState<Product[]>(() => INITIAL_PRODUCTS.map((p) => ({ ...p })));
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [previewPeriod, setPreviewPeriod] = useState<"monthly" | "annual">("monthly");
  const [isEditingConsumption, setIsEditingConsumption] = useState(false);
  const [promptModal, setPromptModal] = useState<{ open: boolean; title: string; content: string }>({ open: false, title: "", content: "" });
  const [summaryModal, setSummaryModal] = useState(false);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [copyButtonText, setCopyButtonText] = useState("Copy to Clipboard");
  const [numberOfUsers, setNumberOfUsers] = useState(0);
  const [showLegacyUi, setShowLegacyUi] = useState(false);
  const [activeFeatureFilters, setActiveFeatureFilters] = useState<Set<string>>(new Set());
  const [featureFilterOpen, setFeatureFilterOpen] = useState(false);
  const [flashForecast, setFlashForecast] = useState(false);
  const featureFilterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  const creditsPerUser = useMemo(() => {
    if (numberOfUsers <= 0) return null;
    return Math.floor(totalCredits / numberOfUsers);
  }, [totalCredits, numberOfUsers]);

  const volumeCredits = useMemo(() => {
    const regular = products.reduce((sum, p) => sum + p.runs * p.credits, 0);
    const custom = customProducts.reduce((sum, p) => sum + p.runs * p.credits, 0);
    return regular + custom;
  }, [products, customProducts]);

  const overageCredits = Math.max(0, volumeCredits - totalCredits);
  const subscriptionCost = upsellCredits * costPerCredit; // base allocation has no incremental cost
  const overageCost = overageCredits * overageRate;
  const totalCost = subscriptionCost + overageCost;
  const totalUtilPercent = totalCredits > 0 ? (volumeCredits / totalCredits) * 100 : 0;
  const remainingPool = Math.max(0, totalCredits - volumeCredits);

  const prevTotalCostRef = useRef(totalCost);
  useEffect(() => {
    if (prevTotalCostRef.current !== totalCost && totalCost > 0) {
      prevTotalCostRef.current = totalCost;
      setFlashForecast(true);
      const timer = setTimeout(() => setFlashForecast(false), 300);
      return () => clearTimeout(timer);
    }
    prevTotalCostRef.current = totalCost;
  }, [totalCost]);


  // Auto-dismiss import success message
  useEffect(() => {
    if (importStatus?.type === "success") {
      const t = setTimeout(() => setImportStatus(null), 3000);
      return () => clearTimeout(t);
    }
  }, [importStatus]);

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

  const addCustomProduct = useCallback(() => {
    setCustomProducts((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: "",
        sub: "",
        credits: 0,
        runs: 0,
        unitLabel: "Operations",
        action: "Perform",
        isCustom: true,
      },
    ]);
  }, []);

  const updateCustomProduct = useCallback((id: string, field: keyof Product, value: string | number) => {
    setCustomProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }, []);

  const removeCustomProduct = useCallback((id: string) => {
    setCustomProducts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const resetAllRuns = useCallback(() => {
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        runs: 0,
        ...(p.isFrequencyProduct ? { rawFrequencyInput: 0 } : {}),
      }))
    );
    setCustomProducts((prev) => prev.map((p) => ({ ...p, runs: 0 })));
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

  const exportConfig = useCallback(() => {
    const data: ExportedConfig = {
      version: 1,
      exportedAt: new Date().toISOString(),
      selectedTier,
      customBaseAllocation,
      upsellCredits,
      costPerCredit,
      overageRate,
      numberOfUsers,
      products: products.map((p) => {
        const entry: ExportedConfig["products"][number] = { id: p.id, runs: p.runs };
        if (p.isFrequencyProduct) {
          entry.frequencyMode = p.frequencyMode;
          entry.rawFrequencyInput = p.rawFrequencyInput;
        }
        return entry;
      }),
      customProducts: customProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sub: p.sub,
        credits: p.credits,
        runs: p.runs,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-model-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedTier, customBaseAllocation, upsellCredits, costPerCredit, overageRate, numberOfUsers, products, customProducts]);

  const importConfig = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { setImportStatus({ type: "error", message: "Invalid JSON file" }); return; }

      if (typeof data.version !== "number" || data.version < 1) { setImportStatus({ type: "error", message: "Unsupported file format" }); return; }
      const validTiers = ["start", "grow", "scale", "custom"];
      if (!validTiers.includes(data.selectedTier as string)) { setImportStatus({ type: "error", message: "Invalid configuration: missing credit tier" }); return; }
      if (!Array.isArray(data.products)) { setImportStatus({ type: "error", message: "Invalid configuration: missing products" }); return; }

      setSelectedTier(data.selectedTier as CreditTier);
      setCustomBaseAllocation(typeof data.customBaseAllocation === "number" ? data.customBaseAllocation : 10_000_000);
      setUpsellCredits(typeof data.upsellCredits === "number" ? data.upsellCredits : 0);
      setCostPerCredit(typeof data.costPerCredit === "number" ? data.costPerCredit : 0.0000155);
      setOverageRate(typeof data.overageRate === "number" ? data.overageRate : 0.0000185);
      setNumberOfUsers(typeof data.numberOfUsers === "number" ? data.numberOfUsers : 0);

      const importedProducts = data.products as ExportedConfig["products"];
      setProducts(
        INITIAL_PRODUCTS.map((p) => {
          const snap = importedProducts.find((s) => s.id === p.id);
          if (!snap) return { ...p, runs: 0 };
          if (p.isFrequencyProduct) {
            return { ...p, runs: snap.runs, frequencyMode: snap.frequencyMode ?? "per_month" as FrequencyMode, rawFrequencyInput: snap.rawFrequencyInput ?? snap.runs };
          }
          return { ...p, runs: snap.runs };
        })
      );

      const importedCustom = Array.isArray(data.customProducts) ? data.customProducts as NonNullable<ExportedConfig["customProducts"]> : [];
      setCustomProducts(
        importedCustom.map((p) => ({
          id: typeof p.id === "string" && p.id ? p.id : `custom_${Date.now()}_${Math.random()}`,
          name: typeof p.name === "string" ? p.name : "",
          sub: typeof p.sub === "string" ? p.sub : "",
          credits: typeof p.credits === "number" ? p.credits : 0,
          runs: typeof p.runs === "number" ? p.runs : 0,
          unitLabel: "Operations",
          action: "Perform",
          isCustom: true,
        }))
      );

      setImportStatus({ type: "success", message: "Configuration imported" });
    } catch { setImportStatus({ type: "error", message: "Failed to read file" }); }
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

  const onNumberOfUsersChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits === "") { setNumberOfUsers(0); return; }
    const n = Number.parseInt(digits, 10);
    if (!Number.isNaN(n)) setNumberOfUsers(n);
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
    const subscriptionCostStr = subscriptionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const baseStr = baseAllocation.toLocaleString();
    const upsellStr = upsellCredits.toLocaleString();

    let remainingCapacityList = "";
    let hasAnyUsage = false;
    const usageItems: string[] = [];

    [...products, ...customProducts].forEach((product) => {
      if (product.runs > 0) {
        hasAnyUsage = true;
        usageItems.push(`<p style="margin-bottom:8px;font-size:13px;color:#334155">${buildPhrasing(product, product.runs, false)}</p>`);
      }
      if (remainingPool > 0 && product.credits > 0) {
        const maxPossible = Math.floor(remainingPool / product.credits);
        if (maxPossible > 0) remainingCapacityList += `<li style="margin-bottom:4px">${buildPhrasing(product, maxPossible, true)}</li>`;
      }
    });

    const creditPoolSection = `
      <div style="margin-bottom:24px">
        <h4 style="font-size:13px;font-weight:700;color:#6C40FF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Credit Pool</h4>
        <div style="display:flex;gap:12px;margin-bottom:16px">
          <div style="flex:1;background:#F8FAFC;border-radius:8px;padding:12px">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#94a3b8;letter-spacing:0.05em">Base Allocation</div>
            <div style="font-size:18px;font-weight:700;color:#0D1F3A;margin-top:2px">${baseStr}</div>
          </div>
          <div style="flex:1;background:#F8FAFC;border-radius:8px;padding:12px">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#94a3b8;letter-spacing:0.05em">Additional Purchased</div>
            <div style="font-size:18px;font-weight:700;color:#0D1F3A;margin-top:2px">${upsellStr}</div>
          </div>
          <div style="flex:1;background:#EBE5FF;border-radius:8px;padding:12px">
            <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#6C40FF;letter-spacing:0.05em">Total Pool</div>
            <div style="font-size:18px;font-weight:700;color:#6C40FF;margin-top:2px">${poolStr}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div style="flex:1;background:#e2e8f0;border-radius:99px;height:6px;overflow:hidden">
            <div style="width:${Math.min(totalUtilPercent, 100)}%;height:100%;background:#6C40FF;border-radius:99px"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:#0D1F3A">${utilStr}</span>
        </div>
        <div style="font-size:11px;color:#64748b">Forecasted usage: <strong style="color:#0D1F3A">${forecastStr}</strong> credits</div>
      </div>
    `;

    const billingSection = `
      <div style="margin-bottom:24px">
        <h4 style="font-size:13px;font-weight:700;color:#6C40FF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Billing Forecast</h4>
        <div style="background:#F8FAFC;border-radius:8px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span style="font-size:12px;color:#64748b">Base Allocation</span>
            <span style="font-size:12px;font-weight:600;color:#0D1F3A">Included</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <span style="font-size:12px;color:#64748b">Additional Credits Cost</span>
            <span style="font-size:12px;font-weight:600;color:#0D1F3A">$${subscriptionCostStr}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:8px;border-top:1px dashed #e2e8f0;margin-bottom:12px">
            <span style="font-size:12px;color:${overageCredits > 0 ? "#ef4444" : "#64748b"}">Consumption Cost</span>
            <span style="font-size:12px;font-weight:600;color:${overageCredits > 0 ? "#ef4444" : "#0D1F3A"}">$${overageCostStr}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:12px;border-top:2px solid #e2e8f0">
            <span style="font-size:14px;font-weight:700;color:#0D1F3A">Total Monthly Estimate</span>
            <span style="font-size:20px;font-weight:800;color:#6C40FF">$${costStr}</span>
          </div>
        </div>
      </div>
    `;

    const usageSection = hasAnyUsage ? `
      <div style="margin-bottom:24px">
        <h4 style="font-size:13px;font-weight:700;color:#6C40FF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Forecasted Usage</h4>
        <p style="font-size:12px;color:#6C40FF;font-weight:600;margin-bottom:8px">With ${forecastStr} credits forecasted, here is the projected usage:</p>
        ${usageItems.join("")}
      </div>
    ` : "";

    const remainingSection = remainingPool > 0 && remainingCapacityList ? `
      <div>
        <h4 style="font-size:13px;font-weight:700;color:#6C40FF;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Remaining Capacity</h4>
        <p style="font-size:12px;color:#6C40FF;font-weight:600;margin-bottom:8px">With ${remainingPool.toLocaleString()} credits remaining, you could still do <strong style="font-weight:800">ONE</strong> of the following:</p>
        <ul style="list-style:disc;padding-left:20px;font-size:13px;color:#334155">${remainingCapacityList}</ul>
      </div>
    ` : overageCredits > 0 ? `
      <div>
        <p style="font-size:13px;color:#ef4444;font-weight:600">Current volume projections have exhausted the standard pool. Future runs will be billed at the consumption rate.</p>
      </div>
    ` : "";

    setSummaryHtml(`${creditPoolSection}${billingSection}${usageSection}${remainingSection}`);
    setSummaryModal(true);
  }, [totalCredits, volumeCredits, totalCost, totalUtilPercent, overageCredits, overageCost, remainingPool, products, customProducts, baseAllocation, upsellCredits, subscriptionCost]);

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
    <div className="max-w-screen-2xl mx-auto pb-12 p-4 md:p-8">
      {/* Header */}
      <header className="mb-6 border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="w-full min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">AI Credit Estimator</h1>
          <p className="mt-2 w-full max-w-full text-xs text-slate-500 md:text-sm lg:max-w-[calc(20rem+1.5rem+56rem)] xl:max-w-[calc(24rem+1.5rem+56rem)]">
            Use this tool to estimate AI credits and billing based on anticipated feature usage. The example scenarios describe different customer types; select one to pre-fill the estimator.
          </p>
        </div>
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
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT: master navigation list */}
            <div className="w-full lg:w-80 xl:w-96 shrink-0 space-y-2">
              {SCENARIOS.map((scenario) => {
                const isSelected = scenario.id === selectedScenarioId;
                const tileBg = { indigo: "#EBE5FF", violet: "#E7F0FF", emerald: "#EBFBF5", amber: "#FFF4E4" }[scenario.accentColor];
                const tileTextColor = { indigo: "#6C40FF", violet: "#2563EB", emerald: "#059669", amber: "#B45309" }[scenario.accentColor];
                const featureBadges = Array.from(
                  new Set(
                    scenario.products.map((snap) => {
                      const product = INITIAL_PRODUCTS.find((p) => p.id === snap.productId);
                      return product?.name ?? snap.productId;
                    })
                  )
                ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => setSelectedScenarioId(scenario.id)}
                    className={`w-full text-left rounded-xl px-4 py-3.5 transition-all ${
                      isSelected ? "border-2 border-[#6C40FF] shadow-md" : "border-2 border-transparent hover:shadow-sm"
                    }`}
                    style={{ backgroundColor: tileBg }}
                  >
                    <p className="text-sm font-bold leading-snug" style={{ color: tileTextColor }}>{scenario.name}</p>
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">{scenario.cardLine}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Features in this scenario">
                      {featureBadges.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/90"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RIGHT: detail panel (capped width on large screens — room for description + summary) */}
            <div className="flex-1 min-w-0 w-full lg:max-w-4xl">
              {(() => {
                const scenario = SCENARIOS.find((s) => s.id === selectedScenarioId)!;
                const displayProducts = scenario.products.map((snap) => {
                  const product = INITIAL_PRODUCTS.find((p) => p.id === snap.productId);
                  return {
                    productId: snap.productId,
                    name: product?.name ?? snap.productId,
                    sub: product?.sub ?? "",
                    runs: snap.runs,
                    totalCredits: snap.runs * (product?.credits ?? 0),
                    unitLabel: product?.unitLabel ?? "operations",
                  };
                });
                const forecastedCredits = displayProducts.reduce((sum, p) => sum + p.totalCredits, 0);

                // Group products by product name
                const grouped: { name: string; items: typeof displayProducts }[] = [];
                const seen = new Map<string, number>();
                displayProducts.forEach((p) => {
                  if (seen.has(p.name)) {
                    grouped[seen.get(p.name)!].items.push(p);
                  } else {
                    seen.set(p.name, grouped.length);
                    grouped.push({ name: p.name, items: [p] });
                  }
                });

                return (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-full">
                    {/* Intro */}
                    <div className="px-6 py-5">
                      <h2 className="text-xl font-bold mb-1.5 leading-tight" style={{ color: "#0D1F3A" }}>{scenario.name}</h2>
                      <p className="text-xs text-slate-500 font-medium mb-3">{scenario.tagline}</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{scenario.description}</p>
                    </div>

                    {/* Hero Numbers — pool (left) + forecast (right); equation under pool total */}
                    <div className="px-6 py-5 border-t border-slate-100 bg-slate-50">
                      <div className="grid grid-cols-2 gap-8">
                        <div className="min-w-0 text-left">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Total Credit Pool</p>
                          <p className="text-2xl font-extrabold tabular-nums" style={{ color: "#0D1F3A" }}>
                            {(scenario.baseAllocation + scenario.upsellCredits).toLocaleString()}
                          </p>
                          <p className="mt-2 text-[10px] leading-snug text-slate-500 tabular-nums">
                            {scenario.upsellCredits > 0
                              ? `${scenario.baseAllocation.toLocaleString()}(base) + ${scenario.upsellCredits.toLocaleString()}(purchased)`
                              : "Base only"}
                          </p>
                        </div>
                        <div className="flex min-w-0 flex-col items-end text-right">
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Forecasted Usage</p>
                          <p className="text-2xl font-extrabold tabular-nums" style={{ color: "#6C40FF" }}>
                            {forecastedCredits.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* BYOK callout */}
                    {scenario.byokNote && (
                      <div className="mx-6 my-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-[11px] text-amber-800 font-medium leading-snug">
                          <span className="font-bold">BYOK: </span>{scenario.byokNote}
                        </p>
                      </div>
                    )}

                    {/* Usage Model Summary */}
                    <div className="border-t border-slate-100">
                      <div className="px-6 pt-4 pb-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usage Model Summary</span>
                      </div>
                      <div className="px-6 pb-5">
                        <table className="w-full max-w-full">
                          <tbody>
                            {grouped.map(({ name, items }, gi) => (
                              <Fragment key={name}>
                                <tr>
                                  <td colSpan={2} className={`text-xs font-bold pb-1 ${gi > 0 ? "pt-3" : ""}`} style={{ color: "#0D1F3A" }}>{name}</td>
                                </tr>
                                {items.map((p) => (
                                  <tr key={p.productId}>
                                    <td className="text-xs text-slate-500 py-0.5 pl-3">{p.sub}</td>
                                    <td className="text-xs font-semibold tabular-nums text-right py-0.5 whitespace-nowrap" style={{ color: "#0D1F3A" }}>{p.runs.toLocaleString()} {p.unitLabel.toLowerCase()}</td>
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="px-6 py-5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => loadScenario(scenario)}
                        className="w-full text-white text-sm font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 hover:opacity-90"
                        style={{ backgroundColor: "#6C40FF" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                        </svg>
                        Model this scenario
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

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
                    <span>Consumption Credits (Not in Pool):</span>
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
                    <span className="text-3xl font-extrabold">{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-xs uppercase font-bold tracking-tighter opacity-70">
                    <span>Base Allocation:</span>
                    <span>Included</span>
                  </div>
                  <div className="flex justify-between text-xs uppercase font-bold tracking-tighter">
                    <span className="opacity-70">Additional Credits Cost:</span>
                    <span>${subscriptionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between text-xs uppercase font-bold tracking-tighter transition-all duration-300 ${overageCredits > 0 ? "text-amber-300 opacity-100" : "opacity-50"}`}>
                    <span>Consumption Cost:</span>
                    <span>${overageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // New view: left column (config + table) + sticky right sidebar (results)
            <div className="flex flex-col lg:flex-row gap-6 items-start mb-10">

            {/* LEFT COLUMN: config cards + table */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* Monthly Credit Pool — full width */}
              <div className="calculator-metric-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Monthly Credit Pool
                </label>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-0">
                  <div className="min-w-0 flex-1">
                {/* 5 columns: Base | + | Additional | = | Total — 2fr content / 1fr operator so + and = sit in gutters, centered */}
                <div
                  className="grid w-full items-start gap-x-3 sm:gap-x-4 md:gap-x-6"
                  style={{
                    gridTemplateColumns:
                      "minmax(17rem, 2.45fr) minmax(0, 1fr) minmax(17rem, 2.45fr) minmax(0, 1fr) minmax(12rem, 2.25fr)",
                  }}
                >
                  {/* Row 1 — labels */}
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1 flex items-center gap-1 justify-self-start text-left">
                    Base Allocation
                    <span className="relative group inline-flex items-center shrink-0">
                      <span className="cursor-default text-[9px] text-slate-400 border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:bg-slate-100 transition-colors">?</span>
                      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded-lg bg-slate-800 text-white text-[10px] leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 font-normal normal-case tracking-normal shadow-lg">
                        The number of credits included in this customer's plan tier.
                      </span>
                    </span>
                  </p>
                  <div className="min-h-[1.25rem]" aria-hidden />
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1 flex w-full min-w-0 items-center justify-start gap-1 justify-self-stretch text-left">
                    Additional Credits
                    <span className="relative group inline-flex items-center shrink-0">
                      <span className="cursor-default text-[9px] text-slate-400 border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:bg-slate-100 transition-colors">?</span>
                      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-52 rounded-lg bg-slate-800 text-white text-[10px] leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 font-normal normal-case tracking-normal shadow-lg">
                        Model an upsell of credits beyond the included base allocation to see the impact on billing.
                      </span>
                    </span>
                  </p>
                  <div className="min-h-[1.25rem]" aria-hidden />
                  <p className="mb-3 flex items-center gap-1 justify-self-end text-right text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                    Total Credit Pool
                    <span className="relative group inline-flex items-center shrink-0">
                      <span className="cursor-default text-[9px] text-slate-400 border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:bg-slate-100 transition-colors">?</span>
                      <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-52 rounded-lg bg-slate-800 text-white text-[10px] leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 font-normal normal-case tracking-normal shadow-lg">
                        The total credits available: base allocation plus any additional credits purchased.
                      </span>
                    </span>
                  </p>

                  {/* Row 2 — values + operators */}
                  <div className="flex min-h-[2.875rem] w-full min-w-[17rem] items-center justify-start">
                    {selectedTier === "custom" ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={customBaseAllocation.toLocaleString("en-US")}
                        onChange={onCustomBaseChange}
                        className="box-border min-w-[17rem] w-full max-w-full text-2xl font-bold tabular-nums text-slate-800 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none transition-all"
                        placeholder="0"
                        aria-label="Custom base allocation"
                      />
                    ) : (
                      <p className="text-2xl font-bold text-slate-800 tabular-nums whitespace-nowrap">{baseAllocation.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex w-full min-w-0 items-center justify-center h-10 text-2xl font-bold text-slate-400 select-none" aria-hidden>
                    +
                  </div>
                  <div className="flex min-h-[2.875rem] w-full min-w-[17rem] items-center justify-start">
                    <input
                      id="upsell-credits-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={upsellCredits.toLocaleString("en-US")}
                      onChange={onUpsellChange}
                      className="box-border min-w-[17rem] w-full max-w-full text-2xl font-bold tabular-nums text-left text-slate-800 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex w-full min-w-0 items-center justify-center h-10 text-2xl font-bold text-slate-400 select-none" aria-hidden>
                    =
                  </div>
                  <div className="flex min-h-[2.875rem] w-full min-w-0 items-center justify-end">
                    <p
                      className="text-2xl font-bold tabular-nums whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 leading-none"
                      style={{ color: "#6C40FF" }}
                    >
                      {totalCredits.toLocaleString()}
                    </p>
                  </div>

                  {/* Row 3 — tier dropdown under Base Allocation */}
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
                  <div /><div /><div /><div />

                </div>
                  </div>

                  <div className="h-px shrink-0 bg-slate-200 sm:hidden" aria-hidden />
                  <div className="hidden sm:block w-px shrink-0 bg-slate-200 self-stretch mx-6 md:mx-8" aria-hidden />

                  <div className="flex flex-col items-center shrink-0 w-full sm:w-44 md:w-48">
                    <p className="mb-1 flex w-full items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                      User Distribution
                      <span className="relative group inline-flex items-center shrink-0">
                        <span className="cursor-default text-[9px] text-slate-400 border border-slate-300 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:bg-slate-100 transition-colors">?</span>
                        <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 w-52 rounded-lg bg-slate-800 text-white text-[10px] leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 font-normal normal-case tracking-normal shadow-lg">
                          Even split of total credit pool across users for planning; does not change billing math.
                        </span>
                      </span>
                    </p>
                    <div className="flex min-h-[2.875rem] w-full items-center justify-center">
                      <input
                        id="user-count-input"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={numberOfUsers.toLocaleString("en-US")}
                        onChange={onNumberOfUsersChange}
                        className="w-full max-w-[7.5rem] text-2xl font-bold text-slate-800 tabular-nums text-left bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-lg px-3 py-1.5 outline-none transition-all"
                        placeholder="0"
                        aria-label="Number of users for credit distribution"
                      />
                    </div>
                    <div
                      className="mt-3 flex w-full flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5"
                      role="status"
                      aria-label={creditsPerUser != null ? `${creditsPerUser.toLocaleString()} credits per user` : "Enter a user count to see credits per user"}
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Credits per user</span>
                      {creditsPerUser != null ? (
                        <span className="text-[10px] font-bold tabular-nums tracking-tighter" style={{ color: "#6C40FF" }}>
                          {creditsPerUser.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold tabular-nums text-slate-300 tracking-tighter">—</span>
                      )}
                    </div>
                    <div className="mt-2 min-h-[1.75rem]" aria-hidden />
                  </div>
                </div>

              </div>{/* end Monthly Credit Pool card */}

            {/* Product table — inside left column */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-white">
              {showLegacyUi ? (
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-slate-800">Credit Usage Modeling</h2>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${totalUtilPercent > 100.1 ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200" : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200"}`}>
                      Total Pool Used: {totalUtilPercent.toFixed(1)}%
                    </span>
                    <button type="button" onClick={generateSummary} className="flex items-center gap-2 px-4 py-1.5 bg-[#6C40FF] hover:bg-[#5B33D6] text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
                      Generate Summary
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold text-slate-800">Credit Usage Modeling</h2>
                    <p className="text-xs text-slate-400 italic mt-1.5 leading-snug">
                      Enter your customer&apos;s expected monthly volume for each feature to calculate projected credit usage and billing. Credit consumption estimates are based on typical usage patterns and will vary depending on content length and task complexity.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
                    <button type="button" onClick={generateSummary} className="flex items-center gap-2 px-4 py-1.5 bg-[#6C40FF] hover:bg-[#5B33D6] text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" /></svg>
                      Generate Summary
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-x-auto table-container">
              <table className="w-full text-left border-separate border-spacing-0" style={{ tableLayout: "fixed" }} id="mainTable">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 shadow-sm text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 bg-slate-50 w-[10%] border-b border-slate-200">
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
                    <th className="p-4 bg-slate-50 w-[33%] border-b border-slate-200">Use Case</th>
                    <th className={`p-4 bg-slate-50 w-[17%] border-b border-slate-200 text-center transition-colors ${isEditingConsumption ? "text-indigo-600" : ""}`}>
                      <div className="flex items-center justify-center gap-2">
                        <span>Average Consumption</span>
                        {showLegacyUi && (
                          <button type="button" onClick={() => setIsEditingConsumption((v) => !v)} title="Edit consumption values" className={`p-1 hover:bg-slate-200 rounded-md transition-colors focus:outline-none ${isEditingConsumption ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-indigo-600"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                          </button>
                        )}
                      </div>
                    </th>
                    <th className="p-4 bg-slate-50 w-[22%] text-center border-b border-slate-200">
                      <div className="flex items-center justify-center gap-2">
                        <span>Est. Monthly Volume</span>
                        <button type="button" onClick={resetAllRuns} title="Reset all volumes to 0" className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-indigo-600 focus:outline-none">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                        </button>
                      </div>
                    </th>
                    <th className="p-4 bg-slate-50 w-[18%] text-right border-b border-slate-200">Utilization %</th>
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
                    const consumptionIsFixed = p.id === "assets" || p.id === "automate";
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
                            {(p.activityType === "one_time" || p.fixedCreditCost) && (
                              <div className="mt-1.5 flex flex-row flex-wrap items-center gap-1.5 self-start">
                                {p.fixedCreditCost && (
                                  <span
                                    className="bg-violet-50 text-violet-700 ring-1 ring-violet-200 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    title="Each operation uses a fixed number of credits as shown in Average Consumption."
                                  >
                                    Fixed Credit Cost
                                  </span>
                                )}
                                {p.activityType === "one_time" && (
                                  <span
                                    className="bg-amber-50 text-amber-700 ring-1 ring-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    title="Typically processed once — not a recurring monthly cost. Volume here represents new images ingested in the period."
                                  >
                                    One-Time Activity
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Average Consumption */}
                        <td className={`p-4 align-top text-center transition-colors ${isEditingConsumption ? "bg-indigo-50/50" : ""}`}>
                          {!isEditingConsumption ? (
                            <div className="text-sm whitespace-nowrap">
                              <span className="font-bold text-slate-800">
                                {!consumptionIsFixed && <span className="text-slate-500">~</span>}
                                {p.credits.toLocaleString()}
                              </span>
                              <span className="ml-1 text-slate-400">Credits</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              {!consumptionIsFixed && <span className="text-sm font-bold text-slate-500" aria-hidden="true">~</span>}
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

                {/* Custom user-defined rows */}
                {customProducts.length > 0 && (
                  <tbody>
                    {customProducts.map((p) => {
                      const featureTotalCredits = p.runs * p.credits;
                      const featureUtilPercent = totalCredits > 0 ? (featureTotalCredits / totalCredits) * 100 : 0;
                      const barColor = featureUtilPercent >= 100 ? "bg-rose-400" : featureUtilPercent >= 80 ? "bg-amber-400" : "bg-indigo-400";
                      return (
                        <tr key={p.id} className="product-row border-b border-slate-50 hover:bg-slate-50/80">
                          {/* Feature */}
                          <td className="p-4 align-top">
                            <input
                              type="text"
                              placeholder="Feature name"
                              value={p.name}
                              onChange={(e) => updateCustomProduct(p.id, "name", e.target.value)}
                              className="w-full text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-md px-2 py-1 outline-none transition-all"
                            />
                          </td>
                          {/* Use Case */}
                          <td className="p-4 align-top">
                            <input
                              type="text"
                              placeholder="Describe the use case"
                              value={p.sub}
                              onChange={(e) => updateCustomProduct(p.id, "sub", e.target.value)}
                              className="w-full text-sm text-slate-600 bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-md px-2 py-1 outline-none transition-all"
                            />
                          </td>
                          {/* Average Consumption */}
                          <td className="p-4 align-top text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm font-bold text-slate-500" aria-hidden="true">~</span>
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={p.credits || ""}
                                onChange={(e) => updateCustomProduct(p.id, "credits", Math.max(0, Number(e.target.value) || 0))}
                                className="consumption-input bg-white rounded-md px-2 py-1 w-full max-w-[100px] border border-slate-300 text-sm font-mono font-semibold text-slate-800 text-center focus:ring-1 focus:ring-indigo-500 focus:border-indigo-400 outline-none"
                              />
                              <span className="text-xs font-medium text-slate-400">Credits</span>
                            </div>
                          </td>
                          {/* Monthly Volume */}
                          <td className="p-4 text-center align-top">
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                placeholder="0"
                                value={p.runs || ""}
                                onChange={(e) => updateCustomProduct(p.id, "runs", Math.max(0, Number(e.target.value) || 0))}
                                className="run-input bg-white rounded-md px-3 py-1.5 min-w-[6.5rem] max-w-[10rem] border border-slate-300 text-center font-bold text-slate-800 tabular-nums focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm"
                              />
                              <span className="text-[10px] text-slate-400 mt-1 block leading-none">operations</span>
                            </div>
                          </td>
                          {/* Utilization % + remove */}
                          <td className="p-4 align-top">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-mono font-bold text-indigo-600">{featureUtilPercent.toFixed(1)}%</span>
                              <div className="w-full max-w-[120px] bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div className={`${barColor} h-full transition-all duration-300 ease-out`} style={{ width: `${Math.min(featureUtilPercent, 100)}%` }} />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCustomProduct(p.id)}
                                title="Remove row"
                                className="mt-2 text-[10px] font-semibold text-rose-400 hover:text-rose-600 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                )}

                {/* Add custom use case */}
                <tfoot>
                  <tr>
                    <td colSpan={5} className="px-4 py-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={addCustomProduct}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition-colors group"
                      >
                        <span className="w-5 h-5 rounded-full border border-dashed border-slate-300 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14"/>
                          </svg>
                        </span>
                        Add custom use case
                      </button>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          </div>{/* end left column */}

          {/* RIGHT SIDEBAR — sticky results */}
          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-6 space-y-4">

            {/* Combined projected usage + cost */}
            {(() => {
              const withinPool = Math.min(volumeCredits, totalCredits);
              const overPool = overageCredits;
              const hasOver = overPool > 0;
              const barFillClass = hasOver ? "bg-amber-300" : "bg-white";
              const utilDisplayPercent = Math.min(totalUtilPercent, 100);
              const multiplier = previewPeriod === "annual" ? 12 : 1;
              const displayVolumeCredits = volumeCredits * multiplier;
              const displayWithinPool = withinPool * multiplier;
              const displayOverPool = overPool * multiplier;
              const displayTotalCost = totalCost * multiplier;
              const displaySubscriptionCost = subscriptionCost * multiplier;
              const displayOverageCost = overageCost * multiplier;
              return (
                <div className="bg-indigo-600 rounded-xl shadow-lg border border-indigo-700 text-white relative overflow-hidden">
                  <div className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300" style={{ backgroundColor: "#EBFBF5", opacity: flashForecast ? 0.25 : 0 }} />
                  <div className="relative px-5 pt-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-[0.15em]">Projected Usage</div>
                      <span className="relative group shrink-0 inline-flex items-center">
                        <span className="cursor-default text-[9px] text-indigo-200 border border-indigo-400 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:bg-indigo-500 transition-colors">?</span>
                        <span className="pointer-events-none absolute top-full right-0 mt-1.5 w-52 rounded-lg bg-slate-800 text-white text-[10px] leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 font-normal normal-case tracking-normal shadow-lg">
                          Total credits from the table. Credit Pool is usage within your allocation; Over pool is beyond it.
                        </span>
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-3xl font-extrabold tabular-nums">{displayVolumeCredits.toLocaleString()}</span>
                    </div>

                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-indigo-100 opacity-80">Credit Pool</span>
                        <span className="font-semibold tabular-nums">{displayWithinPool.toLocaleString()}</span>
                      </div>
                      <div className={`flex justify-between text-xs transition-colors ${hasOver ? "text-amber-300 font-semibold" : "text-indigo-100 opacity-60"}`}>
                        <span>Over pool</span>
                        <span className="tabular-nums">{displayOverPool.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">Pool Utilization</span>
                        <span className={`text-xs font-bold tabular-nums ${hasOver ? "text-amber-300" : "text-white"}`}>{totalUtilPercent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-indigo-900/40 overflow-hidden">
                        <div className={`h-full ${barFillClass} transition-all duration-300 ease-out rounded-full`} style={{ width: `${utilDisplayPercent}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="relative mx-5 border-t-2 border-indigo-300/50" />

                  <div className="relative px-5 pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-[0.15em]">Projected Cost</div>
                      <span className="relative group shrink-0 inline-flex items-center">
                        <span className="cursor-default text-[9px] text-indigo-200 border border-indigo-400 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:bg-indigo-500 transition-colors">?</span>
                        <span className="pointer-events-none absolute top-full right-0 mt-1.5 w-52 rounded-lg bg-slate-800 text-white text-[10px] leading-snug px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 font-normal normal-case tracking-normal shadow-lg">
                          Estimated cost from additional credits purchased and any consumption beyond the credit pool.
                        </span>
                      </span>
                    </div>
                    <div className="mb-3">
                      <span className="text-xl font-semibold text-indigo-200 mr-1">$</span>
                      <span className="text-3xl font-extrabold tabular-nums">{displayTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-indigo-100 opacity-80">Base Allocation</span>
                        <span className="font-semibold">Included</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-indigo-100 opacity-80">Additional Credits</span>
                        <span className="font-semibold tabular-nums">${displaySubscriptionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className={`flex justify-between text-xs transition-colors ${hasOver ? "text-amber-300 font-semibold" : "text-indigo-100 opacity-60"}`}>
                        <span>Consumption</span>
                        <span className="tabular-nums">${displayOverageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative px-5 pb-4 flex justify-center">
                    <div className="flex items-center gap-0.5 bg-indigo-700/50 rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => setPreviewPeriod("monthly")}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                          previewPeriod === "monthly" ? "bg-white text-indigo-700" : "text-indigo-200 hover:text-white"
                        }`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPeriod("annual")}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                          previewPeriod === "annual" ? "bg-white text-indigo-700" : "text-indigo-200 hover:text-white"
                        }`}
                      >
                        Annual
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Import / Export / Reset */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={exportConfig} className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Import
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProducts(INITIAL_PRODUCTS.map((p) => ({ ...p })));
                  setCustomProducts((prev) => prev.map((p) => ({ ...p, runs: 0 })));
                  setUpsellCredits(0);
                  setNumberOfUsers(0);
                  setSelectedTier("custom");
                  setCustomBaseAllocation(0);
                  setImportStatus(null);
                }}
                className="mr-3 flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                Reset
              </button>
            </div>
            {importStatus && (
              <p className={`text-xs font-medium transition-opacity ${importStatus.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
                {importStatus.message}
              </p>
            )}

            {/* Hidden inputs */}
            <div className="hidden" aria-hidden="true">
              <input type="number" value={costPerCredit} step={0.0000001} onChange={(e) => setCostPerCredit(Number(e.target.value) || 0)} />
              <input type="number" value={overageRate} step={0.0000001} onChange={(e) => setOverageRate(Number(e.target.value) || 0)} />
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importConfig(f);
                  e.target.value = "";
                }}
              />
            </div>

          </div>

          </div>
          )}{/* end showLegacyUi ternary */}
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
          <div className="p-6 border-b border-slate-100 flex justify-between items-center text-white" style={{ backgroundColor: "#6C40FF" }}>
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
              AI Credit Summary
            </h3>
            <button type="button" onClick={() => setSummaryModal(false)} className="text-white/80 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
          <div className="p-8 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-slate-400 mb-5 italic">
              Credit consumption estimates are based on typical usage patterns and will vary depending on content length and task complexity.
            </p>
            <div dangerouslySetInnerHTML={{ __html: summaryHtml }} />
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button type="button" onClick={copySummary} className="px-4 py-2 rounded-lg text-sm font-bold transition-colors hover:bg-[#EBE5FF]" style={{ color: "#6C40FF" }}>{copyButtonText}</button>
            <button type="button" onClick={() => setSummaryModal(false)} className="px-6 py-2 text-white rounded-lg text-sm font-bold transition-colors" style={{ backgroundColor: "#6C40FF" }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
