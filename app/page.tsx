"use client";

import { useCallback, useMemo, useState } from "react";

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
};

const INITIAL_PRODUCTS: Product[] = [
  { id: "assets", name: "Assets", sub: "Upload Image and Generate Metadata", credits: 2580, runs: 0, unitLabel: "Images", action: "Upload and generate metadata for" },
  { id: "automate", name: "Automate", sub: "One Execution with Multiple Steps", credits: 145, runs: 0, unitLabel: "Executions", action: "Run" },
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

export default function AICreditCalculatorPage() {
  const [totalCredits, setTotalCredits] = useState(1000000);
  const [costPerCredit, setCostPerCredit] = useState(0.0000155);
  const [overageRate, setOverageRate] = useState(0.0000185);
  const [products, setProducts] = useState<Product[]>(() => INITIAL_PRODUCTS.map((p) => ({ ...p })));
  const [isEditingConsumption, setIsEditingConsumption] = useState(false);
  const [promptModal, setPromptModal] = useState<{ open: boolean; title: string; content: string }>({ open: false, title: "", content: "" });
  const [summaryModal, setSummaryModal] = useState(false);
  const [summaryHtml, setSummaryHtml] = useState("");
  const [copyButtonText, setCopyButtonText] = useState("Copy to Clipboard");

  const volumeCredits = useMemo(() => {
    return products.reduce((sum, p) => sum + p.runs * p.credits, 0);
  }, [products]);

  const overageCredits = Math.max(0, volumeCredits - totalCredits);
  const subscriptionCost = totalCredits * costPerCredit;
  const overageCost = overageCredits * overageRate;
  const totalCost = subscriptionCost + overageCost;
  const totalUtilPercent = totalCredits > 0 ? (volumeCredits / totalCredits) * 100 : 0;
  const remainingPool = Math.max(0, totalCredits - volumeCredits);

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

  const resetAllRuns = useCallback(() => {
    setProducts((prev) => prev.map((p) => ({ ...p, runs: 0 })));
  }, []);

  const generateSummary = useCallback(() => {
    const poolStr = totalCredits.toLocaleString();
    const forecastStr = volumeCredits.toLocaleString();
    const costStr = totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const utilStr = totalUtilPercent.toFixed(1) + "%";
    const overageCostStr = overageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const overageText = overageCredits > 0
      ? `This modeling includes +${overageCredits.toLocaleString()} credits in overage usage (representing $${overageCostStr} of the total forecast).`
      : "This modeling fits comfortably within your standard credit pool.";

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

    const forecastedUsageSection = hasAnyUsage ? `<div class="mb-6"><h4 class="font-bold text-slate-800 mb-4">Forecasted Usage</h4>${currentProjections}</div>` : "";
    const remainingSection = remainingPool > 0
      ? `<div><p class="mb-4 text-indigo-700 font-bold">With your remaining balance of ${remainingPool.toLocaleString()} available credits, you could still do any of the following:</p><ul class="list-disc pl-5 space-y-2 text-slate-600">${remainingCapacityList}</ul></div>`
      : volumeCredits > totalCredits ? `<div><p class="text-rose-600 font-bold">Current volume projections have exhausted the standard pool. Future runs will be billed at the overage rate.</p></div>` : "";

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

  const copySummary = useCallback(() => {
    const el = document.createElement("div");
    el.innerHTML = summaryHtml;
    const text = el.innerText || el.textContent || "";
    navigator.clipboard.writeText(text).then(() => {
      setCopyButtonText("Copied!");
      setTimeout(() => setCopyButtonText("Copy to Clipboard"), 2000);
    });
  }, [summaryHtml]);

  return (
    <div className="max-w-7xl mx-auto pb-12 p-4 md:p-8">
      {/* Header */}
      <header className="mb-8 border-b border-slate-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">AI Credit Sales Calculator</h1>
          <p className="text-slate-500 mt-2">Modeling consumption and overage forecasting based on volume of runs.</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono text-slate-400">v3.10.0 - Dynamic Max Thresholds</span>
        </div>
      </header>

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="calculator-metric-card bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monthly Credit Pool</label>
            <input type="number" value={totalCredits} step={100000} onChange={(e) => setTotalCredits(Number(e.target.value) || 0)} className="text-2xl font-bold text-slate-800 w-full focus:outline-none" />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Contracted Capacity</p>
            <div className="h-4" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 calculator-metric-card">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Forecasted Consumption</label>
            <span className="text-2xl font-bold text-slate-800">{volumeCredits.toLocaleString()}</span>
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-tighter">Total Volume Credits</p>
            <div className={`flex justify-between items-center text-xs font-bold uppercase tracking-tighter transition-colors duration-300 ${overageCredits > 0 ? "text-rose-500" : "text-slate-400"}`}>
              <span>Overage Credits:</span>
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
              <span className="text-slate-400">Overage Rate:</span>
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
            <div className="flex justify-between text-xs uppercase font-bold tracking-tighter">
              <span className="opacity-70">Subscription:</span>
              <span>${subscriptionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className={`flex justify-between text-xs uppercase font-bold tracking-tighter transition-all duration-300 ${overageCredits > 0 ? "text-amber-300 opacity-100" : "opacity-50"}`}>
              <span>Est. Overage Billing:</span>
              <span>${overageCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
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
        <div className="overflow-x-auto table-container">
          <table className="w-full text-left border-separate border-spacing-0" style={{ tableLayout: "fixed" }} id="mainTable">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200 shadow-sm text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4 bg-slate-50 w-1/4 border-b border-slate-200">Feature & Use Case Details</th>
                <th className={`p-4 bg-slate-50 w-1/4 border-b border-slate-200 text-center transition-colors ${isEditingConsumption ? "text-indigo-600" : ""}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span>Average Consumption</span>
                    <button type="button" onClick={() => setIsEditingConsumption((v) => !v)} title="Edit consumption values" className={`p-1 hover:bg-slate-200 rounded-md transition-colors focus:outline-none ${isEditingConsumption ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:text-indigo-600"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                    </button>
                  </div>
                </th>
                <th className="p-4 bg-slate-50 w-1/4 text-center border-b border-slate-200">
                  <div className="flex items-center justify-center gap-2">
                    <span>Monthly Volume</span>
                    <button type="button" onClick={resetAllRuns} title="Reset all volumes to 0" className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-indigo-600 focus:outline-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                    </button>
                  </div>
                </th>
                <th className="p-4 bg-slate-50 w-1/4 text-right border-b border-slate-200">Utilization %</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, index) => {
                const featureTotalCredits = p.runs * p.credits;
                const featureUtilPercent = totalCredits > 0 ? (featureTotalCredits / totalCredits) * 100 : 0;
                const additionalPossible = p.credits > 0 ? Math.floor(remainingPool / p.credits) : 0;
                const dynamicMax = p.runs + additionalPossible;
                const barColor = featureUtilPercent > 100 ? "bg-rose-500" : featureUtilPercent > 50 ? "bg-amber-500" : "bg-indigo-500";
                return (
                  <tr key={p.id} className="product-row border-b border-slate-50 hover:bg-slate-50/80">
                    <td className="p-4 align-top">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <div className="font-bold text-slate-800 text-sm break-words">{p.name}</div>
                          {p.hasPrompt && p.promptTitle && p.promptText && (
                            <button type="button" onClick={() => setPromptModal({ open: true, title: p.promptTitle!, content: p.promptText! })} title="View details" className="text-indigo-400 hover:text-indigo-600 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 leading-tight mt-0.5 break-words">{p.sub}</div>
                      </div>
                    </td>
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
                    <td className="p-4 text-center align-top">
                      <div className="flex flex-col items-center">
                        <input type="number" min={0} value={p.runs} onChange={(e) => updateProductRuns(index, Number(e.target.value) || 0)} className="run-input bg-white rounded-md px-3 py-1.5 w-24 border border-slate-300 text-center font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm" placeholder="0" />
                        <span className="text-[10px] text-slate-400 mt-1 block leading-none">{p.unitLabel}</span>
                      </div>
                    </td>
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
