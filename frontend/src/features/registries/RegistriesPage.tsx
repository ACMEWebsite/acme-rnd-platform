import { AlertTriangle, BookOpen, ExternalLink, FileText, LoaderCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";

type AnyRow = Record<string, string | number | null | undefined>;
type RegistryTab = "us" | "mhra" | "iid";
type MhraDocumentType = "PAR" | "SPC" | "PIL";

const MHRA_DOCUMENT_TYPE_LABELS: Record<MhraDocumentType, string> = {
  PAR: "Public Assessment Report",
  SPC: "Summary of Product Characteristics",
  PIL: "Patient Information Leaflet",
};

function mhraDocumentTypeLabel(value: string) {
  return MHRA_DOCUMENT_TYPE_LABELS[value.toUpperCase() as MhraDocumentType] ?? value;
}

type RldRow = {
  active_ingredient: string;
  proprietary_name: string;
  application_number: string;
  dosage_form: string;
  route: string;
  strength: string;
  te_code: string;
  rld: string;
  rs: string;
  applicant_holder: string;
  approval_date: string;
};

type DailyMedLabel = {
  title: string;
  setid: string;
  label_url: string;
  pdf_url: string;
};

type MhraRow = {
  document: string;
  product: string;
  description: string;
  context: string;
  pdf_url: string;
};

type MhraResponse = {
  results: MhraRow[];
  count: number;
  returned_count: number;
  truncated: boolean;
};

const messageFrom = (error: unknown) =>
  error instanceof ApiError ? error.message : "The registry request could not be completed.";

function Table({ rows }: { rows: AnyRow[] }) {
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">No records found.</p>;
  }
  const columns = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap p-2 capitalize">
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100 align-top">
              {columns.map((column) => (
                <td key={column} className="max-w-72 p-2 text-slate-700">
                  {row[column] === null || row[column] === undefined || row[column] === ""
                    ? "—"
                    : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RldTable({ rows, referenceUrl }: { rows: RldRow[]; referenceUrl: string }) {
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">No RLD records found.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead style={{ backgroundColor: "#164b7e", color: "#ffffff" }}>
          <tr>
            {[
              "Active ingredient",
              "Proprietary name",
              "Appl. no.",
              "Dosage form",
              "Route",
              "Strength",
              "TE code",
              "RLD",
              "RS",
              "Applicant holder",
              "Reference",
            ].map((heading) => (
              <th key={heading} className="whitespace-nowrap p-3">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.application_number}-${row.strength}-${index}`} className="border-b border-slate-200 align-top">
              <td className="p-3">{row.active_ingredient}</td>
              <td className="p-3 font-semibold">{row.proprietary_name}</td>
              <td className="p-3">{row.application_number}</td>
              <td className="p-3">{row.dosage_form}</td>
              <td className="p-3">{row.route}</td>
              <td className="p-3">{row.strength}</td>
              <td className="p-3">{row.te_code || "—"}</td>
              <td className="p-3">{row.rld}</td>
              <td className="p-3">{row.rs}</td>
              <td className="p-3">{row.applicant_holder}</td>
              <td className="p-3">
                <a href={referenceUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700">
                  Open
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MhraTable({
  rows,
  selectedIndex,
  onSelect,
}: {
  rows: MhraRow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">No MHRA documents found.</p>;
  }
  return (
    <div
      className="h-[520px] overflow-x-auto overflow-y-scroll rounded-xl border border-slate-200"
      style={{ scrollbarGutter: "stable" }}
    >
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-xs text-slate-500">
          <tr>
            <th className="p-3">Document</th>
            <th className="p-3">Product</th>
            <th className="min-w-72 p-3">Description</th>
            <th className="min-w-80 p-3">Context</th>
            <th className="whitespace-nowrap p-3">Open PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.pdf_url}-${index}`}
              onClick={() => onSelect(index)}
              className={`cursor-pointer border-b border-slate-100 align-top text-slate-700 ${
                selectedIndex === index ? "bg-cyan-50" : "hover:bg-slate-50"
              }`}
            >
              <td className="min-w-48 p-3 font-semibold text-navy-900">{row.document ? mhraDocumentTypeLabel(row.document) : "—"}</td>
              <td className="p-3 font-medium">{row.product || "—"}</td>
              <td className="p-3">{row.description || "—"}</td>
              <td className="max-w-xl p-3 text-slate-600">{row.context || "—"}</td>
              <td className="p-3">
                {row.pdf_url ? (
                  <a
                    href={row.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-cyan-700"
                  >
                    <FileText size={15} /> Open PDF
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentPreview({
  title,
  documentUrl,
  loading,
  error,
  className = "mt-7",
}: {
  title: string;
  documentUrl: string;
  loading: boolean;
  error: string;
  className?: string;
}) {
  return (
    <section className={`${className} overflow-hidden rounded-xl border border-slate-200 bg-white`}>
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
        <FileText className="text-cyan-700" size={20} />
        <h3 className="font-bold text-navy-900">{title}</h3>
      </div>
      <div className="grid min-h-[680px] place-items-center bg-slate-100">
        {loading ? (
          <div className="text-center text-slate-500">
            <LoaderCircle className="mx-auto animate-spin text-cyan-600" />
            <p className="mt-3 text-sm">Loading document preview…</p>
          </div>
        ) : error ? (
          <div className="max-w-md p-6 text-center text-red-700">
            <AlertTriangle className="mx-auto" />
            <p className="mt-3 text-sm">{error}</p>
          </div>
        ) : documentUrl ? (
          <iframe title={title} src={documentUrl} className="h-[680px] w-full" />
        ) : (
          <div className="p-6 text-center text-slate-400">
            <FileText className="mx-auto" size={38} />
            <p className="mt-3 text-sm">No document is available to preview.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function RegistriesPage() {
  const [tab, setTab] = useState<RegistryTab>("us");
  const [query, setQuery] = useState("");
  const [rldRows, setRldRows] = useState<RldRow[]>([]);
  const [selectedRldIndex, setSelectedRldIndex] = useState(0);
  const [iidRows, setIidRows] = useState<AnyRow[]>([]);
  const [labels, setLabels] = useState<DailyMedLabel[]>([]);
  const [selectedLabelSetId, setSelectedLabelSetId] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [mhraType, setMhraType] = useState<MhraDocumentType>("PAR");
  const [mhra, setMhra] = useState<MhraResponse | null>(null);
  const [selectedMhraIndex, setSelectedMhraIndex] = useState(0);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");

  const tabs: [RegistryTab, string][] = [
    ["us", "US RLD Information"],
    ["mhra", "UK MHRA documents"],
    ["iid", "FDA inactive ingredients"],
  ];

  const selectedRld = rldRows[selectedRldIndex];
  const selectedLabel = labels.find((label) => label.setid === selectedLabelSetId);
  const selectedMhra = mhra?.results[selectedMhraIndex];
  const previewPdfUrl = tab === "us" ? selectedLabel?.pdf_url : tab === "mhra" ? selectedMhra?.pdf_url : undefined;

  useEffect(() => {
    setDocumentUrl("");
    setDocumentError("");
    if (!previewPdfUrl) {
      setDocumentLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl = "";
    setDocumentLoading(true);
    api.fetchRegistryDocument(previewPdfUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setDocumentUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setDocumentError("The registry document could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setDocumentLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewPdfUrl]);

  function clearResults() {
    setRldRows([]);
    setSelectedRldIndex(0);
    setIidRows([]);
    setLabels([]);
    setSelectedLabelSetId("");
    setReferenceUrl("");
    setMhra(null);
    setSelectedMhraIndex(0);
    setSearched(false);
    setError("");
  }

  function changeTab(next: RegistryTab) {
    setTab(next);
    clearResults();
  }

  function chooseMhraType(type: MhraDocumentType) {
    setMhraType(type);
    setMhra(null);
    setSelectedMhraIndex(0);
    setSearched(false);
    setError("");
  }

  function chooseRld(index: number) {
    setSelectedRldIndex(index);
    setLabels([]);
    setSelectedLabelSetId("");
  }

  async function search() {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError("");
    clearResults();
    try {
      if (tab === "us") {
        const result = await api.orangeBook<{ records: RldRow[]; reference_url: string }>(query);
        setRldRows(result.records);
        setReferenceUrl(result.reference_url);
        setSelectedRldIndex(0);
      } else if (tab === "iid") {
        const result = await api.inactiveIngredients<{ records: AnyRow[] }>(query);
        setIidRows(result.records);
      } else {
        const result = await api.mhra<MhraResponse>(query, [mhraType]);
        setMhra(result);
        setSelectedMhraIndex(0);
      }
      setSearched(true);
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function searchDailyMedForRld() {
    if (!selectedRld?.proprietary_name) return;
    setBusy(true);
    setError("");
    setLabels([]);
    setSelectedLabelSetId("");
    try {
      const result = await api.dailyMed<{ labels: DailyMedLabel[] }>(selectedRld.proprietary_name);
      setLabels(result.labels);
      setSelectedLabelSetId(result.labels[0]?.setid ?? "");
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1700px]">
        <ModuleBanner
          icon={BookOpen}
          eyebrow="Regulatory intelligence"
          title="Drug Reference & Approval Registries"
          description="Search US RLD and FDA Orange Book records, review official DailyMed labels and UK MHRA documents, and explore FDA inactive ingredient data."
        />

        {error && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-panel">
          <div className="flex flex-wrap gap-7 border-b border-slate-200 px-5 pt-5">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => changeTab(id)}
                className={`border-b-2 pb-3 text-sm font-semibold ${
                  tab === id ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void search()}
                placeholder={tab === "iid" ? "e.g. Magnesium Stearate" : tab === "mhra" ? "e.g. Famotidine" : "e.g. Clopidogrel"}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-500"
              />
              <button
                onClick={() => void search()}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />}
                {tab === "us" ? "Search RLD" : "Search"}
              </button>
            </div>

            {tab === "mhra" && (
              <fieldset className="mt-5">
                <legend className="mb-3 text-sm font-bold text-navy-900">Document type</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(["PAR", "SPC", "PIL"] as MhraDocumentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => chooseMhraType(type)}
                      className={`flex min-h-14 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-semibold ${
                        mhraType === type ? "border-cyan-500 bg-cyan-50 text-navy-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {MHRA_DOCUMENT_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {tab === "mhra" && busy && (
              <div className="mt-5 rounded-xl bg-blue-50 px-4 py-4 text-sm text-blue-800">
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-blue-100">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-600" />
                </div>
                Searching MHRA products and documents…
              </div>
            )}

            {tab === "us" && searched && (
              <div className="mt-7 space-y-7">
                <section>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-navy-900">Orange Book RLD results</h2>
                    {referenceUrl && (
                      <a href={referenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700">
                        <ExternalLink size={16} /> FDA Orange Book search
                      </a>
                    )}
                  </div>
                  <RldTable rows={rldRows} referenceUrl={referenceUrl} />
                </section>

                {selectedRld && (
                  <section className="space-y-4 border-t border-slate-200 pt-6">
                    <label className="block text-sm font-semibold text-slate-700">
                      Select RLD / reference product record
                      <select
                        value={selectedRldIndex}
                        onChange={(event) => chooseRld(Number(event.target.value))}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-700"
                      >
                        {rldRows.map((row, index) => (
                          <option key={`${row.application_number}-${row.strength}-${index}`} value={index}>
                            {row.proprietary_name} | {row.active_ingredient} | {row.strength} | {row.applicant_holder}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      RLD / RS name
                      <input
                        value={selectedRld.proprietary_name}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 font-normal text-slate-700"
                      />
                    </label>

                    <button
                      onClick={() => void searchDailyMedForRld()}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Search size={17} />}
                      Search DailyMed label
                    </button>

                    {labels.length > 0 && (
                      <label className="block text-sm font-semibold text-slate-700">
                        Select DailyMed label
                        <select
                          value={selectedLabelSetId}
                          onChange={(event) => setSelectedLabelSetId(event.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-700"
                        >
                          {labels.map((label) => (
                            <option key={label.setid} value={label.setid}>
                              {label.title} | SETID: {label.setid}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {selectedLabel && (
                      <DocumentPreview
                        title={`DailyMed label preview — ${selectedRld.proprietary_name}`}
                        documentUrl={documentUrl}
                        loading={documentLoading}
                        error={documentError}
                      />
                    )}
                  </section>
                )}
              </div>
            )}

            {tab === "iid" && searched && (
              <div className="mt-5">
                <div className="mb-4 flex gap-3 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1">Local FDA IID snapshot</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{iidRows.length} records</span>
                </div>
                <Table rows={iidRows} />
              </div>
            )}

            {tab === "mhra" && searched && mhra && (
              <div className="mt-6">
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">{mhra.count} documents found</span>
                  {mhra.truncated && <span>{mhra.returned_count} results shown</span>}
                </div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Select a document to preview
                </div>
                <MhraTable rows={mhra.results} selectedIndex={selectedMhraIndex} onSelect={setSelectedMhraIndex} />
                {selectedMhra && (
                  <DocumentPreview
                    title={`MHRA document preview — ${selectedMhra.description}`}
                    documentUrl={documentUrl}
                    loading={documentLoading}
                    error={documentError}
                  />
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
