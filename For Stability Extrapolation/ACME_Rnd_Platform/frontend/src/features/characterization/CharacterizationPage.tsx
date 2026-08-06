import {
  Beaker,
  CheckCircle2,
  Download,
  ExternalLink,
  LoaderCircle,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";

type Groups = Record<string, string[]>;
type RecordItem = {
  source: string;
  record_name: string;
  record_id: string;
  formula: string;
  molecular_weight: string;
  smiles: string;
  structure_url: string;
  link: string;
  data: Record<string, unknown>;
};
type Result = {
  category: string;
  property: string;
  value: string;
  status: "found" | "missing" | "web_evidence";
  sources: string[];
  references: string[];
};

const tabs = ["Identity", "Physical Properties", "Chemical Properties", "Solubility Profiling"] as const;
type TabName = (typeof tabs)[number];
const resultTitles: Record<TabName, string> = {
  Identity: "Identity Properties",
  "Physical Properties": "Physical Properties",
  "Chemical Properties": "Chemical Properties",
  "Solubility Profiling": "Solubility Properties",
};

export function CharacterizationPage() {
  const [groups, setGroups] = useState<Groups>({});
  const [activeTab, setActiveTab] = useState<TabName>("Identity");
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState<RecordItem[]>([]);
  const [resultsByTab, setResultsByTab] = useState<Partial<Record<TabName, Result[]>>>({});
  const [searchBusy, setSearchBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .characterizationCatalog<{ property_groups: Groups }>()
      .then((response) => setGroups(response.property_groups))
      .catch(() => setError("Could not load the property catalogue."));
  }, []);

  const results = resultsByTab[activeTab] ?? [];
  const displayName = query.trim()
    ? query.trim().charAt(0).toUpperCase() + query.trim().slice(1)
    : "API";
  const message = (reason: unknown) =>
    reason instanceof ApiError ? reason.message : "Request could not be completed.";

  async function search() {
    if (query.trim().length < 2) return;
    setSearchBusy(true);
    setError("");
    try {
      const response = await api.searchCharacterization<{ records: RecordItem[] }>(query.trim());
      const defaultRecords = response.records.filter(
        (record) => record.source === "PubChem" || record.source === "ChEMBL",
      );
      setRecords(response.records);
      setSelected(defaultRecords);
      setResultsByTab({});
      setActiveTab("Identity");
      if (!response.records.length) {
        setError("No matching PubChem or ChEMBL records were found.");
      } else {
        await extractTab("Identity", defaultRecords, query.trim());
      }
    } catch (reason) {
      setError(message(reason));
    } finally {
      setSearchBusy(false);
    }
  }

  async function extractTab(
    tab: TabName,
    recordsForRun: RecordItem[] = selected,
    apiName: string = query.trim(),
  ) {
    if (!recordsForRun.length) {
      setError("Select at least one source record.");
      return;
    }
    const propertiesForRun = groups[tab] ?? [];
    if (!propertiesForRun.length) return;
    setRunBusy(true);
    setError("");
    try {
      const response = await api.runCharacterization<{ results: Result[] }>({
        api_name: apiName,
        selected_properties: propertiesForRun,
        selected_records: recordsForRun,
      });
      setResultsByTab((current) => ({ ...current, [tab]: response.results }));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setRunBusy(false);
    }
  }

  function toggleRecord(record: RecordItem) {
    const next = selected.some((item) => item.source === record.source && item.record_id === record.record_id)
      ? selected.filter((item) => !(item.source === record.source && item.record_id === record.record_id))
      : [...selected, record];
    setSelected(next);
    setResultsByTab({});
    if (next.length) void extractTab(activeTab, next);
  }

  function selectTab(tab: TabName) {
    setActiveTab(tab);
    if (!resultsByTab[tab] && selected.length) {
      void extractTab(tab);
    }
  }

  function downloadCsv() {
    if (!results.length) return;
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["API", displayName],
      ["Category", resultTitles[activeTab]],
      [],
      ["Property", "Value", "Status", "Source", "References"],
      ...results.map((result) => [
        result.property,
        result.value,
        result.status,
        result.sources.join("; "),
        result.references.join("; "),
      ]),
    ];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${query.trim() || "api"}-${activeTab.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <ModuleBanner
          icon={Beaker}
          eyebrow="Physicochemical Properties"
          title="API Characterization"
          description="Search PubChem and ChEMBL records, then extract identity, physical, chemical, or solubility properties with cited fallback evidence."
        />

        {error && (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void search()}
              placeholder="API / Compound Name — e.g. Mirogabalin, Clarithromycin"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-500"
            />
            <button
              onClick={() => void search()}
              disabled={searchBusy || query.trim().length < 2}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {searchBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />}
              {searchBusy ? "Searching…" : "Search API"}
            </button>
          </div>

          {records.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-navy-900">Select matching source records</h2>
                <span className="text-xs text-slate-500">{selected.length} of {records.length} selected</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {records.map((record) => {
                  const active = selected.some(
                    (item) => item.source === record.source && item.record_id === record.record_id,
                  );
                  return (
                    <button
                      key={`${record.source}-${record.record_id}`}
                      onClick={() => toggleRecord(record)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active ? "border-cyan-400 bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-sky-300"
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-navy-900">{record.source}</span>
                        {active && <CheckCircle2 className="text-cyan-600" size={18} />}
                      </div>
                      <p className="mt-2 truncate text-sm text-slate-700">{record.record_name}</p>
                      <p className="text-xs text-slate-500">
                        {record.record_id} · {record.formula} · MW {record.molecular_weight}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {records.length > 0 && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
            <div className="overflow-x-auto border-b border-slate-200">
              <div
                className="grid min-w-[900px] gap-3 p-3"
                style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => selectTab(tab)}
                    disabled={runBusy}
                    aria-selected={activeTab === tab}
                    style={{
                      color: "#ffffff",
                      background: "#123f76",
                      border: activeTab === tab ? "3px solid #67e8f9" : "1px solid #123f76",
                      boxShadow: "0 2px 5px rgba(11, 35, 68, 0.16)",
                    }}
                    className={`rounded-xl px-5 py-4 text-sm font-semibold shadow-sm transition hover:brightness-110 disabled:opacity-60 ${
                      activeTab === tab
                        ? "ring-2 ring-cyan-300 ring-offset-2"
                        : ""
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
                <div className="flex items-center">
                  <h2 className="text-xl font-bold text-navy-900">
                    {resultTitles[activeTab]} of {displayName}
                  </h2>
                  {runBusy && <LoaderCircle className="ml-3 animate-spin text-[#123f76]" size={19} />}
                </div>
                <button
                  onClick={downloadCsv}
                  disabled={!results.length || runBusy}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Download size={16} /> Download CSV
                </button>
              </div>

              {results.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="p-3">Property</th>
                        <th className="p-3">Value</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result.property} className="border-b border-slate-100 align-top">
                          <td className="p-3 font-semibold text-navy-900">{result.property}</td>
                          <td className="max-w-2xl p-3 leading-5 text-slate-700">
                            {result.property === "Structure" ? (
                              <div className="flex flex-wrap items-center gap-3">
                                {(result.value.match(/https?:\/\/\S+/g) ?? []).map((url) => (
                                  <a key={url} href={url} target="_blank" rel="noreferrer" className="group inline-flex flex-col items-center gap-1">
                                    <img
                                      src={url.replace(/[),.;]+$/, "")}
                                      alt={`${displayName} molecular structure`}
                                      style={{ width: "96px", height: "72px", maxWidth: "96px", maxHeight: "72px" }}
                                      className="rounded-lg border border-slate-200 bg-white object-contain p-1 group-hover:border-cyan-400"
                                      loading="lazy"
                                    />
                                    <span className="text-[11px] text-cyan-700">Open structure</span>
                                  </a>
                                ))}
                              </div>
                            ) : result.value}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                              result.status === "found"
                                ? "bg-emerald-100 text-emerald-800"
                                : result.status === "web_evidence"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-slate-100 text-slate-600"
                            }`}>
                              {result.status === "found" ? "Database" : result.status === "web_evidence" ? "Web evidence" : "Not found"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600">{result.sources.join(", ") || "—"}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              {result.references.length
                                ? result.references.map((reference, index) => (
                                    <a
                                      key={reference}
                                      href={reference}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-cyan-700"
                                    >
                                      <ExternalLink size={13} /> {result.sources[index] || `Source ${index + 1}`}
                                    </a>
                                  ))
                                : "—"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
