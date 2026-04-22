"use client";

interface ScenarioProductDisplay {
  productId: string;
  name: string;
  label?: string;
  note?: string;
  runs: number;
  totalCredits: number;
}

interface ScenarioCardProps {
  name: string;
  description: string;
  baseAllocation: number;
  upsellCredits: number;
  creditTierLabel: string;
  users: number;
  tier: "power" | "mid" | "byok" | "grow";
  accentColor: "indigo" | "violet" | "emerald" | "amber";
  products: ScenarioProductDisplay[];
  forecastedCredits: number;
  byokNote?: string;
  onLoad: () => void;
}

const brandColors: Record<string, { headerBg: string; headerText: string; utilBar: string }> = {
  indigo:  { headerBg: "#EBE5FF", headerText: "#6C40FF", utilBar: "bg-[#6C40FF]" },
  violet:  { headerBg: "#E7F0FF", headerText: "#2563EB", utilBar: "bg-blue-500" },
  emerald: { headerBg: "#EBFBF5", headerText: "#059669", utilBar: "bg-emerald-500" },
  amber:   { headerBg: "#FFF4E4", headerText: "#B45309", utilBar: "bg-amber-400" },
};

export default function ScenarioCard({
  name,
  description,
  baseAllocation,
  upsellCredits,
  creditTierLabel,
  users,
  tier,
  accentColor,
  products,
  forecastedCredits,
  byokNote,
  onLoad,
}: ScenarioCardProps) {
  const colors = brandColors[accentColor];
  const totalPool = baseAllocation + upsellCredits;
  const utilPercent = totalPool > 0 ? (forecastedCredits / totalPool) * 100 : 0;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4" style={{ backgroundColor: colors.headerBg }}>
        <h3 className="text-lg font-bold leading-tight" style={{ color: colors.headerText }}>{name}</h3>
      </div>

      {/* Key stats */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Base Allocation</p>
          <p className="text-base font-bold tabular-nums" style={{ color: "#0D1F3A" }}>{baseAllocation.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{creditTierLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Additional Purchased Credits</p>
          <p className="text-base font-bold tabular-nums" style={{ color: "#0D1F3A" }}>
            {upsellCredits > 0 ? upsellCredits.toLocaleString() : <span className="font-normal italic text-slate-400">None</span>}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Users: {users}</p>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Forecasted Usage</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: "#0D1F3A" }}>
            {forecastedCredits.toLocaleString()} <span className="font-normal text-slate-400">credits</span>
            <span className="ml-1.5 text-slate-400">({utilPercent.toFixed(0)}%)</span>
          </span>
        </div>
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className={`${colors.utilBar} h-full transition-all duration-300`}
            style={{ width: `${Math.min(utilPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-xs text-slate-600 leading-relaxed">{description}</p>
      </div>

      {/* BYOK callout */}
      {byokNote && (
        <div className="mx-5 my-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-[11px] text-amber-800 font-medium leading-snug">
            <span className="font-bold">BYOK: </span>{byokNote}
          </p>
        </div>
      )}

      {/* Product list */}
      <div className="px-5 pb-4 flex-1">
        <p className="py-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
          {tier === "byok" ? "Credit-Consuming Activities" : "Features in Use"}
        </p>
        <ul className="space-y-1.5">
          {products.map((p) => (
            <li key={p.productId} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold" style={{ color: "#0D1F3A" }}>{p.label ?? p.name}</span>
                {p.note && <span className="text-slate-400 ml-1">· {p.note}</span>}
              </div>
              <div className="text-right shrink-0 text-slate-500 tabular-nums">
                {p.runs.toLocaleString()}<span className="text-slate-400"> runs</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Start Modeling button */}
      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={onLoad}
          className="w-full text-white text-sm font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 hover:opacity-90"
          style={{ backgroundColor: "#6C40FF" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
          Start Modeling with this Scenario
        </button>
      </div>

    </div>
  );
}
