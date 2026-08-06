import { FormEvent, useState } from "react";
import { AlertTriangle, Download, Loader2, Microscope, Play, Sparkles } from "lucide-react";
import { api, ApiError } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";
import { ProfileChart } from "../../components/ProfileChart";

type Result = {
  run_id: number;
  engine_version: string;
  mode?: "standard" | "pbbm";
  bcs: {
    class: string;
    solubility_class: string;
    permeability_class: string;
    solubility_mg_per_ml: number;
    dose_volume_ml: number;
    formulation_note: string;
  };
  metrics: {
    sink_conditions?: boolean;
    final_dissolved_percent?: number;
    saturation_solubility_mg_ml?: number;
    diffusion_coefficient_cm2_s?: number;
    cmax_mg_l?: number;
    tmax_hr?: number;
    auc_mg_h_l?: number;
    final_fa_percent?: number;
  };
  profile: any[];
  warnings: string[];
};

const initial = {
  mode: "standard",
  dose_mg: "100",
  molecular_weight: "250.2",
  log_s: "-3.1",
  hia_percent: "92",
  particle_diameter_um: "25",
  drug_density_g_cm3: "1.2",
  medium_volume_ml: "900",
  boundary_layer_um: "30",
  duration_min: "120",
  output_points: "30",
  // PBBM inputs
  s0_mg_ml: "0.05",
  pka: "4.45",
  ion_type: "acid",
  peff_cm_s: "0.00015",
  cl_l_hr: "6.0",
  vc_l: "12.0",
  duration_hr: "24",
};

function Field({ label, unit, value, onChange, step = "any" }: { label: string; unit?: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1.5 flex overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-50">
        <input required type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 px-3 py-2.5 text-sm" />
        {unit && <span className="grid place-items-center border-l border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

export function DissolutionPage() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (value: string) => setForm((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        dose_mg: Number(form.dose_mg),
        molecular_weight: Number(form.molecular_weight),
        log_s: Number(form.log_s),
        hia_percent: form.hia_percent === "" ? null : Number(form.hia_percent),
        particle_diameter_um: Number(form.particle_diameter_um),
        drug_density_g_cm3: Number(form.drug_density_g_cm3),
        medium_volume_ml: Number(form.medium_volume_ml),
        boundary_layer_um: Number(form.boundary_layer_um),
        duration_min: Number(form.duration_min),
        output_points: Number(form.output_points),
        s0_mg_ml: Number(form.s0_mg_ml),
        pka: form.pka === "" ? null : Number(form.pka),
        peff_cm_s: Number(form.peff_cm_s),
        cl_l_hr: Number(form.cl_l_hr),
        vc_l: Number(form.vc_l),
        duration_hr: Number(form.duration_hr),
      };
      setResult(await api.simulateDissolution<Result>(payload));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Simulation failed unexpectedly.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    const isPbbm = result.mode === "pbbm";
    const headers = isPbbm ? "time_hr,absorbed_percent,cp_mg_l,stomach_dissolved_mg,jejunum_dissolved_mg" : "time_min,dissolved_percent";
    const rows = isPbbm
      ? result.profile.map((p) => `${p.time_hr},${p.absorbed_percent},${p.cp_mg_l},${p.stomach_dissolved_mg},${p.jejunum_dissolved_mg}`)
      : result.profile.map((p) => `${p.time_min},${p.dissolved_percent}`);
    const csv = [headers, ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `dissolution-${result.mode ?? "run"}-${result.run_id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const isPbbm = form.mode === "pbbm";
  const profileChartData = result
    ? result.mode === "pbbm"
      ? result.profile.map((p) => ({ time_min: p.time_hr, dissolved_percent: p.cp_mg_l }))
      : result.profile
    : [];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <ModuleBanner
          icon={Microscope}
          eyebrow="Formulation sciences & Biopharmaceutics"
          title="Dissolution & PBBM Absorption Prediction"
          description="Simulate in vitro dissolution kinetics and in silico Physiologically Based Biopharmaceutics Models (PBBM) across GI compartments."
        />

        {/* Engine Mode Toggle */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-sky-100 bg-white p-4 shadow-panel">
          <div>
            <h2 className="font-bold text-navy-950">Simulation Engine Framework</h2>
            <p className="text-xs text-slate-500">Select standard dissolution vessel vs. multi-compartment PBBM model</p>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setForm((v) => ({ ...v, mode: "standard" }))}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${!isPbbm ? "bg-white text-navy-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Standard Noyes–Whitney
            </button>
            <button
              type="button"
              onClick={() => setForm((v) => ({ ...v, mode: "pbbm" }))}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${isPbbm ? "bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Sparkles size={14} /> PBBM Absorption & PK
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[410px_1fr]">
          <form onSubmit={submit} className="self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <div>
              <h2 className="font-bold text-navy-950">{isPbbm ? "PBBM Parameter Inputs" : "Dissolution Vessel Inputs"}</h2>
              <p className="mt-1 text-xs text-slate-500">{isPbbm ? "Noyes-Whitney + ACAT GI Transit + Systemic PK" : "Single vessel Noyes–Whitney population model"}</p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field label="Dose" unit="mg" value={form.dose_mg} onChange={set("dose_mg")} />
              <Field label="Molecular weight" unit="g/mol" value={form.molecular_weight} onChange={set("molecular_weight")} />
              <Field label="Particle D50" unit="µm" value={form.particle_diameter_um} onChange={set("particle_diameter_um")} />

              {isPbbm ? (
                <>
                  <Field label="Intrinsic S0" unit="mg/mL" value={form.s0_mg_ml} onChange={set("s0_mg_ml")} />
                  <Field label="pKa" value={form.pka} onChange={set("pka")} />
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ionization</span>
                    <select
                      value={form.ion_type}
                      onChange={(e) => setForm((v) => ({ ...v, ion_type: e.target.value }))}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="acid">Weak Acid</option>
                      <option value="base">Weak Base</option>
                      <option value="neutral">Neutral / Non-ionized</option>
                    </select>
                  </label>
                  <Field label="Permeability Peff" unit="cm/s" value={form.peff_cm_s} onChange={set("peff_cm_s")} />
                  <Field label="Clearance CL" unit="L/h" value={form.cl_l_hr} onChange={set("cl_l_hr")} />
                  <Field label="Volume Vc" unit="L" value={form.vc_l} onChange={set("vc_l")} />
                  <Field label="Duration" unit="hours" step="1" value={form.duration_hr} onChange={set("duration_hr")} />
                </>
              ) : (
                <>
                  <Field label="LogS" value={form.log_s} onChange={set("log_s")} />
                  <Field label="HIA" unit="%" value={form.hia_percent} onChange={set("hia_percent")} />
                  <Field label="Drug density" unit="g/cm³" value={form.drug_density_g_cm3} onChange={set("drug_density_g_cm3")} />
                  <Field label="Medium volume" unit="mL" value={form.medium_volume_ml} onChange={set("medium_volume_ml")} />
                  <Field label="Boundary layer" unit="µm" value={form.boundary_layer_um} onChange={set("boundary_layer_um")} />
                  <Field label="Duration" unit="min" step="1" value={form.duration_min} onChange={set("duration_min")} />
                  <Field label="Output points" step="1" value={form.output_points} onChange={set("output_points")} />
                </>
              )}
            </div>

            {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={loading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />} Run {isPbbm ? "PBBM" : "Dissolution"} Simulation
            </button>
          </form>

          <section className="min-w-0 space-y-6">
            {/* Metric Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {result?.mode === "pbbm" ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Plasma Cmax</p>
                    <p className="mt-2 text-xl font-bold text-navy-950">{result.metrics.cmax_mg_l?.toFixed(2)} mg/L</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tmax</p>
                    <p className="mt-2 text-xl font-bold text-navy-950">{result.metrics.tmax_hr?.toFixed(2)} h</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">AUC (0-t)</p>
                    <p className="mt-2 text-xl font-bold text-navy-950">{result.metrics.auc_mg_h_l?.toFixed(1)} mg·h/L</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fraction Absorbed (Fa)</p>
                    <p className="mt-2 text-xl font-bold text-cyan-600">{result.metrics.final_fa_percent?.toFixed(1)}%</p>
                  </div>
                </>
              ) : (
                [
                  ["BCS class", result?.bcs.class ?? "—"],
                  ["Final dissolved", result?.metrics.final_dissolved_percent ? `${result.metrics.final_dissolved_percent}%` : "—"],
                  ["Sink conditions", result ? (result.metrics.sink_conditions ? "Yes" : "No") : "—"],
                  ["Run ID", result ? `#${result.run_id}` : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className="mt-2 text-xl font-bold text-navy-950">{value}</p>
                  </div>
                ))
              )}
            </div>

            {/* Profile Chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-navy-950">
                    {result?.mode === "pbbm" ? "Systemic Plasma Concentration Profile (Cp)" : "Predicted Dissolution Profile"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {result?.mode === "pbbm" ? "Plasma concentration (mg/L or µg/mL) vs. time in hours" : "Percent dissolved over simulated time"}
                  </p>
                </div>
                <button onClick={download} disabled={!result} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <Download size={16} /> Export CSV
                </button>
              </div>
              <div className="mt-4">
                <ProfileChart data={profileChartData} />
              </div>
            </div>

            {/* Limitations & Formulation Notes */}
            {result && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
                  <h3 className="font-bold text-navy-950">Biopharmaceutical Summary</h3>
                  <dl className="mt-4 grid gap-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">BCS Classification</dt><dd className="font-semibold">{result.bcs.class}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Solubility Class</dt><dd className="font-semibold">{result.bcs.solubility_class}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Permeability Class</dt><dd className="font-semibold">{result.bcs.permeability_class}</dd></div>
                  </dl>
                  <p className="mt-4 rounded-lg bg-cyan-50 p-3 text-sm leading-6 text-cyan-900">{result.bcs.formulation_note}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle size={18} /> Model Limitations & Guidance
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
                    {result.warnings.map((w) => (<li key={w}>• {w}</li>))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
