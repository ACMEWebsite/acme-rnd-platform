import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Download,
  FileText,
  FlaskConical,
  Gauge,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { api, ApiError } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";


type Prediction = {
  category: string;
  property: string;
  value: string;
  source: string;
  interpretation: string;
  color: string;
};

type PkResult = {
  run_id: number;
  engine_version: string;
  compound_name: string;
  smiles: string;
  pubchem_record: {record_id?: string; link?: string} | null;
  predictions: Prediction[];
  warnings: string[];
};

type PsgRecord = {
  id: number | null;
  active_ingredient: string;
  psg_number: string;
  guidance_type: string;
  posted_date: string | null;
  pdf_url: string;
};

type PsgResponse = {
  query: string;
  count: number;
  source: "synced" | "live";
  results: PsgRecord[];
  dataset_size: number;
  last_synced_at: string | null;
  warning: string;
};

const categoryOrder = [
  "Absorption",
  "Distribution",
  "Metabolism",
  "Excretion",
  "Toxicity",
  "Molecule Properties",
];

const categoryColors: Record<string, string> = {
  Absorption: "#0066ff",
  Distribution: "#0284c7",
  Metabolism: "#16a34a",
  Excretion: "#ea580c",
  Toxicity: "#dc2626",
  "Molecule Properties": "#7c3aed",
};


function InterpretationDialog({prediction, onClose}: {
  prediction: Prediction;
  onClose: () => void;
}) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="interpretation-title" onMouseDown={event => event.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1 rounded-full" style={{backgroundColor: prediction.color}}/>
          <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">{prediction.category}</p><h3 id="interpretation-title" className="font-bold text-navy-950">{prediction.property}</h3></div>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={19}/></button>
      </div>
      <div className="p-6">
        <p className="leading-7 text-slate-600">{prediction.interpretation}</p>
        <div className="mt-5 rounded-lg bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current prediction</p><p className="mt-1 font-bold text-navy-950">{prediction.value}</p><p className="mt-1 text-xs text-slate-500">{prediction.source}</p></div>
      </div>
    </section>
  </div>;
}


function PredictionTab() {
  const [compoundInput, setCompoundInput] = useState("");
  const [includePubChem, setIncludePubChem] = useState(true);
  const [result, setResult] = useState<PkResult | null>(null);
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!compoundInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResult(await api.predictPharmacokinetics<PkResult>({
        compound_input: compoundInput.trim(),
        include_pubchem_enrichment: includePubChem,
      }));
    } catch (reason) {
      setResult(null);
      setError(reason instanceof ApiError ? reason.message : "Prediction failed unexpectedly.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!result) return;
    const quote = (value: string | number) => `"${String(value).replace(/"/g, "\"\"")}"`;
    const rows = [
      ["Molecule Name", result.compound_name || "Direct SMILES input"],
      ["SMILES", result.smiles],
      ["Run ID", result.run_id],
      [],
      ["Category", "Property", "Value", "Source"],
      ...result.predictions.map(item => [item.category, item.property, item.value, item.source]),
    ];
    const csv = rows.map(row => row.map(value => quote(value ?? "")).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], {type: "text/csv;charset=utf-8"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pharmacokinetics-run-${result.run_id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const grouped = useMemo(() => {
    if (!result) return [];
    return categoryOrder.map(category => ({
      category,
      items: result.predictions.filter(item => item.category === category),
    })).filter(group => group.items.length);
  }, [result]);

  return <div className="space-y-6">
    <section>
      <h3 className="text-lg font-bold text-navy-950">Enter API Name or SMILES String</h3>
      <form onSubmit={submit} className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 lg:flex-row">
          <input value={compoundInput} onChange={event => setCompoundInput(event.target.value)} placeholder="e.g., Carvedilol or COC1=CC=CC=C1OCCNCC(COC2=CC=CC3=C2C4=CC=CC=C4N3)O" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"/>
          <button disabled={loading || !compoundInput.trim()} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? <Loader2 size={18} className="animate-spin"/> : <FlaskConical size={18}/>}
            Generate PK & Toxicity Profile
          </button>
        </div>
      </form>
    </section>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Analysis results</p>{result && <p className="mt-1 text-sm text-slate-500"><strong className="text-navy-950">{result.compound_name || "Direct SMILES input"}</strong> · Run #{result.run_id}</p>}</div>
        <button onClick={downloadCsv} disabled={!result} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={16}/> Download CSV</button>
      </div>

      {loading && <div className="mt-4 space-y-2">{Array.from({length: 8}).map((_, index) => <div key={index} className="grid animate-pulse gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[130px_1fr_2fr_130px]"><span className="h-6 rounded bg-slate-200"/><span className="h-5 rounded bg-slate-100"/><span className="h-5 rounded bg-slate-100"/><span className="h-8 rounded bg-slate-100"/></div>)}</div>}

      {!loading && !result && !error && <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-24 text-center"><FlaskConical className="mx-auto text-slate-300" size={36}/><p className="mt-4 font-semibold text-slate-600">Awaiting Molecular Structure Vector Verification</p><p className="mt-1 text-sm text-slate-400">Run a prediction above to compile the ADMET property matrix.</p></div>}

      {!loading && result && <div className="mt-4 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resolved SMILES</p><code className="mt-2 block overflow-x-auto text-sm text-navy-950">{result.smiles}</code></div>
        {grouped.map(group => <div key={group.category}>
          <div className="mb-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: categoryColors[group.category]}}/><h4 className="font-bold text-navy-950">{group.category}</h4><span className="text-xs text-slate-400">{group.items.length} properties</span></div>
          <div className="space-y-2">{group.items.map(item => <div key={item.property} className="grid items-center gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm sm:grid-cols-[130px_1.35fr_2.2fr_130px]">
            <span className="w-fit rounded px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white" style={{backgroundColor: item.color}}>{item.category}</span>
            <span className="text-sm font-semibold text-slate-700">{item.property}</span>
            <span className="text-sm font-bold text-navy-950">{item.value}</span>
            <button onClick={() => setSelected(item)} className="rounded-md border px-3 py-2 text-xs font-semibold transition hover:text-white" style={{borderColor: item.color, color: item.color}} onMouseEnter={event => {event.currentTarget.style.backgroundColor = item.color; event.currentTarget.style.color = "white";}} onMouseLeave={event => {event.currentTarget.style.backgroundColor = "white"; event.currentTarget.style.color = item.color;}}>Interpretation</button>
          </div>)}</div>
        </div>)}
      </div>}
    </section>
    {selected && <InterpretationDialog prediction={selected} onClose={() => setSelected(null)}/>}
  </div>;
}


function PsgTab() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<PsgResponse | null>(null);
  const [selected, setSelected] = useState<PsgRecord | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [error, setError] = useState("");
  const [documentError, setDocumentError] = useState("");

  useEffect(() => {
    let currentUrl = "";
    if (!selected?.pdf_url) {
      setDocumentUrl("");
      return;
    }
    setDocumentLoading(true);
    setDocumentError("");
    api.fetchPsgDocument(selected.id, selected.pdf_url).then(blob => {
      currentUrl = URL.createObjectURL(blob);
      setDocumentUrl(currentUrl);
    }).catch(reason => {
      setDocumentError(reason instanceof Error ? reason.message : "Document preview failed.");
    }).finally(() => setDocumentLoading(false));
    return () => { if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [selected]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      const result = await api.searchPsg<PsgResponse>(query.trim());
      setResponse(result);
      setSelected(result.results[0] ?? null);
    } catch (reason) {
      setResponse(null);
      setError(reason instanceof ApiError ? reason.message : "PSG search failed.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="space-y-6">
    <form onSubmit={search} className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g., Carvedilol" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"/>
        <button disabled={loading || query.trim().length < 3} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18}/> : <Search size={18}/>} Search</button>
      </div>
    </form>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {response?.warning && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{response.warning}</p>}
    {response && <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">{response.count} guidance{response.count === 1 ? "" : "s"}</span></div>}
    {response && response.results.length === 0 && <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center"><Info className="mx-auto text-slate-300"/><p className="mt-3 font-semibold text-slate-600">No Product-Specific Guidance found</p><p className="mt-1 text-sm text-slate-400">Try the RLD salt form or another spelling.</p></div>}
    {response && response.results.length > 0 && <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
      <section className="space-y-2">{response.results.map(item => <button key={`${item.id}-${item.psg_number}-${item.posted_date}`} onClick={() => setSelected(item)} className={`w-full rounded-xl border p-4 text-left transition ${selected === item ? "border-blue-500 bg-blue-50 shadow-md" : "border-slate-200 bg-white hover:border-blue-300"}`}>
        <div className="flex items-start justify-between gap-3"><span className="font-bold text-navy-950">{item.active_ingredient}</span><BookOpenCheck size={18} className="shrink-0 text-blue-600"/></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span className="rounded bg-slate-100 px-2 py-1">PSG {item.psg_number || "—"}</span><span className="rounded bg-slate-100 px-2 py-1">{item.guidance_type || "Guidance"}</span><span className="rounded bg-slate-100 px-2 py-1">{item.posted_date || "Date unavailable"}</span></div>
      </button>)}</section>
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">
        <div className="border-b border-slate-200 px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Document preview</p><h3 className="mt-1 font-bold text-navy-950">{selected?.active_ingredient}</h3></div>
        <div className="grid min-h-[680px] place-items-center bg-slate-100">{documentLoading ? <div className="text-center text-slate-500"><Loader2 className="mx-auto animate-spin text-blue-600"/><p className="mt-3 text-sm">Loading guidance document…</p></div> : documentError ? <div className="max-w-md p-6 text-center text-red-700"><AlertTriangle className="mx-auto"/><p className="mt-3">{documentError}</p></div> : documentUrl ? <iframe title={`PSG ${selected?.psg_number}`} src={documentUrl} className="h-[680px] w-full"/> : <div className="p-6 text-center text-slate-400"><FileText className="mx-auto" size={38}/><p className="mt-3 text-sm">Select a guidance to preview its document.</p></div>}</div>
      </section>
    </div>}
  </div>;
}


export function PharmacokineticsPage() {
  const [tab, setTab] = useState<"prediction" | "psg">("prediction");
  return <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-[1500px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8"><ModuleBanner icon={Gauge} eyebrow="Biopharmaceutics & safety" title="Pharmacokinetics" description="Predict pharmacokinetic and toxicity properties, and search FDA Product-Specific Guidances by active ingredient to identify the recommended bioequivalence approach, dissolution methodology, and study design."/></div>
    <div className="mt-6 border-b border-slate-200 bg-white px-5 sm:px-8"><div className="mx-auto flex max-w-[1500px] gap-7"><button onClick={() => setTab("prediction")} className={`border-b-2 px-1 py-4 text-sm font-semibold ${tab === "prediction" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>PK & Toxicity Prediction</button><button onClick={() => setTab("psg")} className={`border-b-2 px-1 py-4 text-sm font-semibold ${tab === "psg" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>Product-Specific Guidances</button></div></div>
    <main className="mx-auto max-w-[1500px] p-5 sm:p-8">{tab === "prediction" ? <PredictionTab/> : <PsgTab/>}</main>
  </div>;
}
