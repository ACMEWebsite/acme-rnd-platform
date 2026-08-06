import {
  BarChart3,
  ClipboardList,
  Download,
  FlaskConical,
  LineChart,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ApiError, api } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";

type Factor = { name: string; low: number; high: number };
type Trial = Record<string, number | string | boolean>;
type Goal = { response: string; direction: string; target: number; weight: number };
type Observation = { month: number; formulation: string; batch: string; repeat: number; response: number | "" };
type CurvePoint = { month: number; predicted: number; lower_bound: number; upper_bound: number };
type StabilityResult = {
  response_name: string;
  model_type: string;
  formulations: string[];
  r_squared: number;
  adjusted_r_squared: number;
  confidence_level: number;
  upper_limit: number | null;
  lower_limit: number | null;
  overall_shelf_life: number | null;
  limiting_formulation: string | null;
  shelf_lives: { formulation: string; shelf_life: number | null; limiting_bound: string; specification_limit: number | null; status: string }[];
  pooling_tests: { test: string; p_value: number | null; significance_level: number; decision: string }[];
  model_parameters: { parameter: string; estimate: number }[];
  observations: { month: number; formulation: string; response: number }[];
  curves: Record<string, CurvePoint[]>;
  prediction: { month: number; formulation: string; predicted: number; lower_bound: number; upper_bound: number; within_specification: boolean } | null;
};

const errorText = (error: unknown) => error instanceof ApiError ? error.message : "The request could not be completed.";
const fieldClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-navy-950 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function StabilityPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-[1500px]">
          <ModuleBanner
            icon={LineChart}
            eyebrow="Stability Science"
            title="Stability Data Extrapolation"
            description="Compare formulation stability trends, estimate shelf life from statistical confidence bounds, and extrapolate future quality responses."
          />
        </div>
      </div>
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <StabilityPrediction />
      </main>
    </div>
  );
}

export function DoePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-[1500px]">
          <ModuleBanner
            icon={BarChart3}
            eyebrow="Design of Experiments"
            title="DOE Optimization"
            description="Create structured factorial designs, capture experimental responses, define development goals, and rank optimized formulation conditions."
          />
        </div>
      </div>
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        <DoeOptimization />
      </main>
    </div>
  );
}

function StabilityPrediction() {
  const [view, setView] = useState<"setup" | "worksheet">("setup");
  const [productName, setProductName] = useState("");
  const [storageCondition, setStorageCondition] = useState("25°C / 60% RH");
  const [testingTimes, setTestingTimes] = useState([0, 3, 6]);
  const [batchNames, setBatchNames] = useState(["Batch 1", "Batch 2", "Batch 3"]);
  const [samplesPerTime, setSamplesPerTime] = useState(1);
  const [responseName, setResponseName] = useState("Unknown Impurity (%)");
  const [specificationType, setSpecificationType] = useState<"upper" | "lower" | "both">("upper");
  const [upperLimit, setUpperLimit] = useState(0.2);
  const [lowerLimit, setLowerLimit] = useState(90);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [poolingAlpha, setPoolingAlpha] = useState(0.25);
  const [maximumMonth, setMaximumMonth] = useState(60);
  const [predictionMonth, setPredictionMonth] = useState(24);
  const [predictionFormulation, setPredictionFormulation] = useState("");
  const [worksheet, setWorksheet] = useState<Observation[]>([]);
  const [result, setResult] = useState<StabilityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);

  const completeObservations = useMemo(
    () => worksheet.filter((row): row is Observation & { response: number } => typeof row.response === "number" && Number.isFinite(row.response)),
    [worksheet],
  );
  const formulations = useMemo(() => Array.from(new Set(worksheet.map(row => row.formulation).filter(Boolean))), [worksheet]);
  const worksheetTimes = useMemo(() => Array.from(new Set(worksheet.map(row => row.month))), [worksheet]);

  function resizeTestingTimes(count: number) {
    const size = Math.max(2, Math.min(30, count || 2));
    setTestingTimes(current => Array.from({ length: size }, (_, index) => current[index] ?? (index === 0 ? 0 : index * 3)));
  }

  function resizeBatches(count: number) {
    const size = Math.max(1, Math.min(50, count || 1));
    setBatchNames(current => Array.from({ length: size }, (_, index) => current[index] ?? `Batch ${index + 1}`));
  }

  function createWorksheet() {
    setError("");
    const months = Array.from(new Set(testingTimes.filter(value => Number.isFinite(value) && value >= 0))).sort((a, b) => a - b);
    if (months.length < 2) { setError("Enter at least two different non-negative testing months."); return; }
    const batches = batchNames.map(value => value.trim()).filter(Boolean);
    if (!batches.length) { setError("Enter at least one batch name."); return; }
    const rows: Observation[] = [];
    for (const month of months) {
      for (const batch of batches) {
        for (let repeat = 1; repeat <= samplesPerTime; repeat += 1) {
          rows.push({ month, formulation: batch, batch, repeat, response: "" });
        }
      }
    }
    setWorksheet(rows);
    setResult(null);
    setPredictionFormulation(batches[0]);
    setMaximumMonth(Math.max(24, ...months) * 2);
    setView("worksheet");
  }

  function updateObservation(index: number, key: keyof Observation, value: string) {
    setWorksheet(current => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (key === "month") return { ...row, month: Number(value) };
      if (key === "response") return { ...row, response: value === "" ? "" : Number(value) };
      if (key === "repeat") return { ...row, repeat: Math.max(1, Number(value)) };
      if (key === "formulation") return { ...row, formulation: value, batch: value };
      return { ...row, [key]: value };
    }));
    setResult(null);
  }

  function addObservation() {
    const batch = formulations[0] ?? "Batch 1";
    setWorksheet(current => [...current, { month: 0, formulation: batch, batch, repeat: 1, response: "" }]);
  }

  function analysisPayload(includePrediction = false) {
    return {
      observations: completeObservations.map(row => ({ month: row.month, formulation: row.formulation, batch: row.batch, response: row.response })),
      response_name: responseName,
      upper_limit: specificationType === "lower" ? null : upperLimit,
      lower_limit: specificationType === "upper" ? null : lowerLimit,
      confidence_level: confidenceLevel,
      pooling_alpha: poolingAlpha,
      maximum_prediction_month: maximumMonth,
      ...(includePrediction ? { prediction_month: predictionMonth, prediction_formulation: predictionFormulation || formulations[0] } : {}),
    };
  }

  async function analyze(includePrediction = false) {
    if (completeObservations.length < 3) { setError("Enter at least three response results before running the analysis."); return; }
    setBusy(true); setError("");
    try {
      const analysis = await api.analyzeStability<StabilityResult>(analysisPayload(includePrediction));
      setResult(analysis);
      if (!predictionFormulation && analysis.formulations.length) setPredictionFormulation(analysis.formulations[0]);
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setBusy(false); }
  }

  function downloadWorksheet() {
    const header = ["Month", "Batch", "Sample", responseName];
    const rows = worksheet.map(row => [row.month, row.formulation, row.repeat, row.response]);
    downloadCsv("stability-worksheet.csv", [header, ...rows]);
  }

  function downloadAnalysis() {
    if (!result) return;
    downloadCsv("stability-analysis.csv", [
      ["Batch", "Estimated Shelf Life (months)", "Limiting Bound", "Specification Limit", "Status"],
      ...result.shelf_lives.map(row => [row.formulation, row.shelf_life ?? "Not reached", row.limiting_bound, row.specification_limit ?? "", row.status]),
    ]);
  }

  async function loadCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setError("The CSV file does not contain stability observations."); return; }
    const headers = lines[0].split(",").map(value => value.trim().toLowerCase());
    const monthIndex = headers.findIndex(value => value === "month");
    const formulationIndex = headers.findIndex(value => value.includes("formulation"));
    const batchIndex = headers.findIndex(value => value === "batch");
    const repeatIndex = headers.findIndex(value => value === "sample" || value.includes("repeat"));
    const groupIndex = formulationIndex >= 0 ? formulationIndex : batchIndex;
    const responseIndex = headers.findIndex((_, index) => ![monthIndex, formulationIndex, batchIndex, repeatIndex].includes(index));
    if (monthIndex < 0 || groupIndex < 0 || responseIndex < 0) { setError("CSV columns must include Month, Batch, and a response column."); return; }
    const parsed = lines.slice(1).map(line => line.split(",")).map((values, index) => ({
      month: Number(values[monthIndex]),
      formulation: values[groupIndex]?.trim() || "Batch 1",
      batch: values[groupIndex]?.trim() || `Batch ${index + 1}`,
      repeat: repeatIndex >= 0 ? Math.max(1, Number(values[repeatIndex]) || 1) : 1,
      response: values[responseIndex]?.trim() === "" ? "" as const : Number(values[responseIndex]),
    })).filter(row => Number.isFinite(row.month));
    setResponseName(lines[0].split(",")[responseIndex]?.trim() || "Response");
    setWorksheet(parsed);
    setResult(null);
    setPredictionFormulation(parsed[0]?.formulation ?? "Batch 1");
    setError("");
    setView("worksheet");
  }

  return (
    <>
      {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {view === "setup" && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <div><h2 className="text-xl font-bold text-navy-950">Create Stability Study Worksheet</h2><p className="mt-1 text-sm text-slate-500">Define the testing schedule, batches, repeat samples, response, and acceptance criteria.</p></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Product name"><input value={productName} onChange={event => setProductName(event.target.value)} placeholder="e.g. Carvedilol tablets" className={fieldClass}/></Field>
          <Field label="Storage condition"><select value={storageCondition} onChange={event => setStorageCondition(event.target.value)} className={fieldClass}>{["25°C / 60% RH","30°C / 65% RH","30°C / 75% RH","40°C / 75% RH","Refrigerated (2–8°C)","Frozen (-20°C)","Custom"].map(value => <option key={value}>{value}</option>)}</select></Field>
          <Field label="Response name"><input value={responseName} onChange={event => setResponseName(event.target.value)} className={fieldClass}/></Field>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="font-bold text-navy-950">Testing Times</h3><label className="flex items-center gap-2 text-sm text-slate-600">Number of test times<input type="number" min={2} max={30} value={testingTimes.length} onChange={event => resizeTestingTimes(Number(event.target.value))} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5"/></label></div>
            <p className="mt-1 text-xs text-slate-500">Numeric time points at varying monthly intervals.</p>
            <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="sticky top-0 bg-navy-900 text-white"><tr><th className="px-3 py-2 text-left">Time</th><th className="px-3 py-2 text-left">Month</th></tr></thead><tbody>{testingTimes.map((month, index) => <tr key={index} className="border-b border-slate-100"><td className="px-3 py-2 font-semibold text-slate-500">{index + 1}</td><td className="p-1.5"><input type="number" min={0} step="any" value={month} onChange={event => setTestingTimes(current => current.map((value, itemIndex) => itemIndex === index ? Number(event.target.value) : value))} className="w-full rounded-md border border-slate-200 px-2 py-1.5"/></td></tr>)}</tbody></table></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4"><h3 className="font-bold text-navy-950">Batches</h3><label className="flex items-center gap-2 text-sm text-slate-600">Number of batches<input type="number" min={1} max={50} value={batchNames.length} onChange={event => resizeBatches(Number(event.target.value))} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5"/></label></div>
            <p className="mt-1 text-xs text-slate-500">Enter a clear identifier for every stability batch.</p>
            <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="sticky top-0 bg-navy-900 text-white"><tr><th className="px-3 py-2 text-left">Batch</th><th className="px-3 py-2 text-left">Batch Name</th></tr></thead><tbody>{batchNames.map((name, index) => <tr key={index} className="border-b border-slate-100"><td className="px-3 py-2 font-semibold text-slate-500">{index + 1}</td><td className="p-1.5"><input value={name} onChange={event => setBatchNames(current => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className="w-full rounded-md border border-slate-200 px-2 py-1.5"/></td></tr>)}</tbody></table></div>
          </div>
        </div>
        <div className="mt-5 max-w-xl"><Field label="Samples from each batch at each testing time"><input type="number" min={1} max={20} value={samplesPerTime} onChange={event => setSamplesPerTime(Math.max(1, Number(event.target.value)))} className={fieldClass}/></Field></div>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-navy-950">Specification</p>
          <div className="mt-3 flex flex-wrap gap-2">{([['upper','Upper specification limit'],['lower','Lower specification limit'],['both','Both limits']] as const).map(([id,label]) => <button key={id} onClick={() => setSpecificationType(id)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${specificationType === id ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {specificationType !== "upper" && <Field label="Lower limit"><input type="number" step="any" value={lowerLimit} onChange={event => setLowerLimit(Number(event.target.value))} className={fieldClass}/></Field>}
            {specificationType !== "lower" && <Field label="Upper limit"><input type="number" step="any" value={upperLimit} onChange={event => setUpperLimit(Number(event.target.value))} className={fieldClass}/></Field>}
          </div>
        </div>
        <button onClick={createWorksheet} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white hover:bg-navy-800"><ClipboardList size={18}/>Create Stability Worksheet</button>
      </section>}

      {view === "worksheet" && <><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-bold text-navy-950">Stability Worksheet</h2><p className="mt-1 text-sm text-slate-500">{productName || "Stability product"} · {storageCondition}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setView("setup")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Worksheet Setup</button><input ref={uploadRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => event.target.files?.[0] && void loadCsv(event.target.files[0])}/><button onClick={() => uploadRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Upload size={16}/>Load CSV</button><button onClick={downloadWorksheet} disabled={!worksheet.length} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={16}/>Download CSV</button></div></div>
        <div className="mt-5 grid gap-3 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm sm:grid-cols-4"><div><span className="block text-xs uppercase tracking-wide text-slate-500">Testing Times</span><strong className="text-navy-950">{worksheetTimes.length}</strong></div><div><span className="block text-xs uppercase tracking-wide text-slate-500">Batches</span><strong className="text-navy-950">{formulations.length}</strong></div><div><span className="block text-xs uppercase tracking-wide text-slate-500">Samples per Time</span><strong className="text-navy-950">{samplesPerTime}</strong></div><div><span className="block text-xs uppercase tracking-wide text-slate-500">Total Runs</span><strong className="text-navy-950">{worksheet.length}</strong></div></div>
        {!worksheet.length ? <EmptyState text="Create a worksheet or load a CSV file."/> : <><div className="mt-5 max-h-[560px] overflow-auto rounded-xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="sticky top-0 z-10 bg-navy-900 text-white"><tr><th className="p-3">Run Order</th><th className="p-3">Month</th><th className="p-3">Batch</th><th className="p-3">Sample</th><th className="min-w-48 p-3">{responseName}</th><th className="p-3"/></tr></thead><tbody>{worksheet.map((row,index) => <tr key={`${index}-${row.batch}-${row.repeat}`} className="border-b border-slate-100"><td className="p-3 font-semibold text-slate-400">{index + 1}</td><td className="p-2"><input type="number" min={0} step="any" value={row.month} onChange={event => updateObservation(index,"month",event.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-2"/></td><td className="p-2"><input value={row.batch} onChange={event => updateObservation(index,"batch",event.target.value)} className="w-40 rounded-lg border border-slate-200 px-2 py-2"/></td><td className="p-2"><input type="number" min={1} value={row.repeat} onChange={event => updateObservation(index,"repeat",event.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-2"/></td><td className="p-2"><input type="number" step="any" value={row.response} onChange={event => updateObservation(index,"response",event.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2"/></td><td className="p-2"><button onClick={() => setWorksheet(current => current.filter((_,rowIndex) => rowIndex !== index))} className="text-rose-500"><Trash2 size={16}/></button></td></tr>)}</tbody></table></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button onClick={addObservation} className="flex items-center gap-1 text-sm font-semibold text-cyan-700"><Plus size={16}/>Add observation</button><p className="text-sm text-slate-500">{completeObservations.length} of {worksheet.length} responses entered</p></div></>}
      </section>

      <section className="mt-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6"><div><h2 className="text-xl font-bold text-navy-950">Statistical Analysis</h2><p className="mt-1 text-sm text-slate-500">Compare batch slopes and intercepts, then estimate shelf life from the applicable confidence bound.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Field label="Confidence level"><select value={confidenceLevel} onChange={event => setConfidenceLevel(Number(event.target.value))} className={fieldClass}><option value={0.9}>90%</option><option value={0.95}>95%</option><option value={0.99}>99%</option></select></Field><Field label="Pooling significance level"><input type="number" min={0.01} max={0.5} step={0.01} value={poolingAlpha} onChange={event => setPoolingAlpha(Number(event.target.value))} className={fieldClass}/></Field><Field label="Maximum shelf-life search month"><input type="number" min={1} max={600} value={maximumMonth} onChange={event => setMaximumMonth(Number(event.target.value))} className={fieldClass}/></Field></div><button onClick={() => void analyze(false)} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18}/> : <LineChart size={18}/>}Run Stability Analysis</button></div>
        {result && <AnalysisResults result={result} onDownload={downloadAnalysis}/>} 
      </section>

      {result && <section className="mt-6 space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6"><div><h2 className="text-xl font-bold text-navy-950">Future Data Extrapolation</h2><p className="mt-1 text-sm text-slate-500">Extrapolate the response and confidence bounds for a selected batch at a future month.</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Extrapolation month"><input type="number" min={0} max={600} step="any" value={predictionMonth} onChange={event => setPredictionMonth(Number(event.target.value))} className={fieldClass}/></Field><Field label="Batch"><select value={predictionFormulation} onChange={event => setPredictionFormulation(event.target.value)} className={fieldClass}>{result.formulations.map(value => <option key={value}>{value}</option>)}</select></Field></div><button onClick={() => void analyze(true)} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18}/> : <Sparkles size={18}/>}Extrapolate Stability Response</button></div>
        {result.prediction && <div className={`rounded-2xl border bg-white p-5 shadow-panel sm:p-6 ${result.prediction.within_specification ? "border-emerald-200" : "border-rose-200"}`}><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="text-lg font-bold text-navy-950">{responseName} at month {result.prediction.month}</h3><span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${result.prediction.within_specification ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{result.prediction.within_specification ? "Within specification" : "Outside specification"}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Extrapolated Response" value={formatNumber(result.prediction.predicted)}/><Metric label="Lower Confidence Bound" value={formatNumber(result.prediction.lower_bound)}/><Metric label="Upper Confidence Bound" value={formatNumber(result.prediction.upper_bound)}/></div></div>}
      </section>}
      </>}
    </>
  );
}

function AnalysisResults({ result, onDownload }: { result: StabilityResult; onDownload: () => void }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-bold text-navy-950">Analysis Summary</h3><p className="mt-1 text-sm text-slate-500">{batchLanguage(result.model_type)}</p></div><button onClick={onDownload} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Download size={16}/>Download CSV</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Selected Model" value={batchLanguage(result.model_type)}/><Metric label="R²" value={result.r_squared.toFixed(4)}/><Metric label="Adjusted R²" value={result.adjusted_r_squared.toFixed(4)}/><Metric label="Estimated Shelf Life" value={result.overall_shelf_life === null ? "Not reached" : `${result.overall_shelf_life.toFixed(2)} months`}/></div><div className="mt-6"><h4 className="font-bold text-navy-950">Shelf-Life Plot</h4><StabilityChart result={result}/></div><div className="mt-6 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Batch</th><th className="p-3">Shelf Life</th><th className="p-3">Limiting Bound</th><th className="p-3">Status</th></tr></thead><tbody>{result.shelf_lives.map(row => <tr key={row.formulation} className="border-b border-slate-100"><td className="p-3 font-bold text-navy-950">{row.formulation}</td><td className="p-3">{row.shelf_life === null ? "Not reached" : `${row.shelf_life.toFixed(2)} months`}</td><td className="p-3">{row.limiting_bound}</td><td className="p-3 text-slate-600">{row.status}</td></tr>)}</tbody></table></div><details className="mt-5 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold text-navy-950">Batch pooling tests</summary><div className="mt-3 space-y-2">{result.pooling_tests.map(test => <div key={test.test} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-semibold">{test.test}</span><span className="ml-3 text-slate-500">p = {test.p_value === null ? "Not applicable" : test.p_value.toFixed(5)}</span><p className="mt-1 text-slate-600">{batchLanguage(test.decision)}</p></div>)}</div></details></div>;
}

function batchLanguage(value: string) {
  return value
    .replace(/formulation types/gi, "batches")
    .replace(/formulation type/gi, "batch")
    .replace(/formulations/gi, "batches")
    .replace(/formulation/gi, "batch");
}

function StabilityChart({ result }: { result: StabilityResult }) {
  const width = 1000, height = 360, left = 64, right = 24, top = 24, bottom = 48;
  const colors = ["#0e7490", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb"];
  const curvePoints = Object.values(result.curves).flat();
  const xValues = [...curvePoints.map(point => point.month), ...result.observations.map(point => point.month)];
  const yValues = [...curvePoints.flatMap(point => [point.predicted, point.lower_bound, point.upper_bound]), ...result.observations.map(point => point.response), ...(result.upper_limit === null ? [] : [result.upper_limit]), ...(result.lower_limit === null ? [] : [result.lower_limit])];
  if (!xValues.length || !yValues.length) return null;
  const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
  const rawYMin = Math.min(...yValues), rawYMax = Math.max(...yValues), yPad = Math.max((rawYMax - rawYMin) * 0.08, 0.01);
  const yMin = rawYMin - yPad, yMax = rawYMax + yPad;
  const x = (value: number) => left + ((value - xMin) / Math.max(xMax - xMin, 1)) * (width - left - right);
  const y = (value: number) => top + (1 - (value - yMin) / Math.max(yMax - yMin, 1)) * (height - top - bottom);
  const linePoints = (points: CurvePoint[], key: "predicted" | "lower_bound" | "upper_bound") => points.map(point => `${x(point.month)},${y(point[key])}`).join(" ");
  return <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px]" role="img" aria-label="Stability response and confidence-bound plot"><line x1={left} y1={height-bottom} x2={width-right} y2={height-bottom} stroke="#94a3b8"/><line x1={left} y1={top} x2={left} y2={height-bottom} stroke="#94a3b8"/>{Array.from({length:6},(_,index) => {const value=xMin+(xMax-xMin)*index/5;return <g key={`x-${index}`}><line x1={x(value)} y1={height-bottom} x2={x(value)} y2={height-bottom+5} stroke="#94a3b8"/><text x={x(value)} y={height-18} textAnchor="middle" fontSize="11" fill="#64748b">{value.toFixed(0)}</text></g>})}{Array.from({length:5},(_,index) => {const value=yMin+(yMax-yMin)*index/4;return <g key={`y-${index}`}><line x1={left-5} y1={y(value)} x2={width-right} y2={y(value)} stroke="#e2e8f0"/><text x={left-9} y={y(value)+4} textAnchor="end" fontSize="11" fill="#64748b">{formatNumber(value)}</text></g>})}{result.upper_limit !== null && <line x1={left} y1={y(result.upper_limit)} x2={width-right} y2={y(result.upper_limit)} stroke="#dc2626" strokeDasharray="7 5"/>}{result.lower_limit !== null && <line x1={left} y1={y(result.lower_limit)} x2={width-right} y2={y(result.lower_limit)} stroke="#dc2626" strokeDasharray="7 5"/>}{result.formulations.map((formulation,index) => {const points=result.curves[formulation]??[],color=colors[index%colors.length];return <g key={formulation}><polyline points={linePoints(points,"lower_bound")} fill="none" stroke={color} strokeOpacity=".45" strokeDasharray="5 5"/><polyline points={linePoints(points,"upper_bound")} fill="none" stroke={color} strokeOpacity=".45" strokeDasharray="5 5"/><polyline points={linePoints(points,"predicted")} fill="none" stroke={color} strokeWidth="2.5"/>{result.observations.filter(point => point.formulation===formulation).map((point,pointIndex)=><circle key={pointIndex} cx={x(point.month)} cy={y(point.response)} r="4" fill={color} stroke="white" strokeWidth="1.5"/>)}</g>})}<text x={(left+width-right)/2} y={height-2} textAnchor="middle" fontSize="12" fill="#475569">Month</text></svg><div className="mt-2 flex flex-wrap gap-4 px-3 pb-2">{result.formulations.map((formulation,index)=><span key={formulation} className="flex items-center gap-2 text-xs font-semibold text-slate-600"><span className="h-2.5 w-5 rounded" style={{backgroundColor:colors[index%colors.length]}}/>{formulation}</span>)}</div></div>;
}

function DoeOptimization() {
  const [factors,setFactors]=useState<Factor[]>([{name:"Binder concentration (%)",low:2,high:8},{name:"Disintegrant concentration (%)",low:1,high:5}]);
  const [design,setDesign]=useState<Trial[]>([]);
  const responses=["Dissolution at 30 min (%)","Tablet hardness (kp)"];
  const [goals,setGoals]=useState<Goal[]>([{response:responses[0],direction:"maximize",target:85,weight:1},{response:responses[1],direction:"maximize",target:6,weight:.5}]);
  const [ranked,setRanked]=useState<Trial[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function generate(){setBusy(true);setError("");try{const response=await api.generateDoe<{design:Trial[]}>({factors});setDesign(response.design);setRanked([])}catch(requestError){setError(errorText(requestError))}finally{setBusy(false)}}
  function setCell(index:number,key:string,value:string){setDesign(rows=>rows.map((row,rowIndex)=>rowIndex===index?{...row,[key]:value===""?"":Number(value)}:row))}
  async function rank(){setBusy(true);setError("");try{const response=await api.rankDoe<{ranked_trials:Trial[]}>({trials:design,goals});setRanked(response.ranked_trials)}catch(requestError){setError(errorText(requestError))}finally{setBusy(false)}}
  return <>{error&&<div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}<div className="grid gap-6 xl:grid-cols-[.85fr_1.4fr]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel"><h2 className="font-bold text-navy-900">Factors and levels</h2><div className="mt-4 space-y-3">{factors.map((factor,index)=><div key={index} className="grid grid-cols-[1fr_72px_72px_auto] gap-2"><input value={factor.name} onChange={event=>setFactors(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,name:event.target.value}:item))} className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-xs"/><input type="number" value={factor.low} onChange={event=>setFactors(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,low:Number(event.target.value)}:item))} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/><input type="number" value={factor.high} onChange={event=>setFactors(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,high:Number(event.target.value)}:item))} className="rounded-lg border border-slate-300 px-2 py-2 text-xs"/><button onClick={()=>setFactors(current=>current.filter((_,itemIndex)=>itemIndex!==index))} className="text-rose-600"><Trash2 size={17}/></button></div>)}</div><button onClick={()=>setFactors(current=>[...current,{name:"New factor",low:0,high:1}])} className="mt-3 flex items-center gap-1 text-xs font-semibold text-cyan-700"><Plus size={15}/>Add factor</button><button onClick={()=>void generate()} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy?<LoaderCircle className="animate-spin" size={17}/>:<FlaskConical size={17}/>}Generate factorial design</button></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel"><h2 className="font-bold text-navy-900">Trial matrix and responses</h2>{!design.length?<EmptyState text="Define 2–5 factors and generate a design."/>:<><div className="mt-4 overflow-x-auto"><table className="min-w-full text-xs"><thead className="border-b border-slate-200 text-slate-500"><tr>{Object.keys(design[0]).map(key=><th key={key} className="whitespace-nowrap p-2 text-left">{key}</th>)}{responses.map(response=><th key={response} className="p-2 text-left">{response}</th>)}</tr></thead><tbody>{design.map((trial,index)=><tr key={index} className="border-b border-slate-100">{Object.entries(trial).map(([key,value])=><td key={key} className="p-2 text-slate-700">{String(value)}</td>)}{responses.map(response=><td key={response} className="p-1"><input type="number" value={String(trial[response]??"")} onChange={event=>setCell(index,response,event.target.value)} className="w-24 rounded border border-slate-300 px-2 py-1"/></td>)}</tr>)}</tbody></table></div><div className="mt-6"><h3 className="text-sm font-bold text-navy-900">Optimization goals</h3>{goals.map((goal,index)=><div key={index} className="mt-2 grid grid-cols-[1fr_110px_70px] gap-2"><select value={goal.response} onChange={event=>setGoals(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,response:event.target.value}:item))} className="rounded border border-slate-300 px-2 py-2 text-xs">{responses.map(response=><option key={response}>{response}</option>)}</select><select value={goal.direction} onChange={event=>setGoals(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,direction:event.target.value}:item))} className="rounded border border-slate-300 px-2 py-2 text-xs"><option value="maximize">Maximize</option><option value="minimize">Minimize</option><option value="target">Target</option></select><input type="number" value={goal.weight} onChange={event=>setGoals(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,weight:Number(event.target.value)}:item))} className="rounded border border-slate-300 px-2 py-2 text-xs"/></div>)}<button onClick={()=>void rank()} disabled={busy} className="mt-4 rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white">Rank formulation trials</button></div></>}</section></div>{ranked.length>0&&<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel"><h2 className="font-bold text-navy-900">Ranked trial results</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-xs"><thead className="border-b border-slate-200 text-slate-500"><tr>{Object.keys(ranked[0]).map(key=><th key={key} className="p-2 text-left">{key}</th>)}</tr></thead><tbody>{ranked.map((row,index)=><tr key={index} className={index===0?"border-b border-emerald-100 bg-emerald-50":"border-b border-slate-100"}>{Object.values(row).map((value,valueIndex)=><td key={valueIndex} className="p-2 text-slate-700">{String(value)}</td>)}</tr>)}</tbody></table></div></section>}</>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className={labelClass}>{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-lg font-bold text-navy-950">{value}</p></div>; }
function EmptyState({ text }: { text: string }) { return <div className="mt-4 grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{text}</div>; }
function formatNumber(value: number) { return Math.abs(value) >= 100 ? value.toFixed(2) : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""); }
function downloadCsv(fileName: string, rows: (string | number | boolean)[][]) { const escape=(value:string|number|boolean)=>`"${String(value).replace(/"/g,'""')}"`; const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(escape).join(",")).join("\n")],{type:"text/csv"})); const link=document.createElement("a");link.href=url;link.download=fileName;link.click();URL.revokeObjectURL(url); }
