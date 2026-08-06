import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  FileSearch,
  FileText,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, api } from "../../api/client";
import { ModuleBanner } from "../../components/ModuleBanner";

type DocumentRecord = {
  name: string;
  size_bytes: number;
  page_count: number;
  characters: number;
  ocr_pages: number;
};

type ExternalAiStatus = {
  available: boolean;
  provider: string;
  model: string;
  privacy_notice: string;
};

type Workspace = {
  workspace_id: number;
  documents: DocumentRecord[];
  total_pages: number;
  total_characters: number;
  warnings: string[];
  suggestions: string[];
  external_ai: ExternalAiStatus;
  storage: {
    raw_documents_stored: boolean;
    extracted_text_stored_locally: boolean;
  };
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  provider?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "The request could not be completed.";
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*.*?\*\*|_.*?_)/g).filter(Boolean).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("_") && part.endsWith("_")) {
          return <em key={index} className="text-slate-500">{part.slice(1, -1)}</em>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function MessageText({ text }: { text: string }) {
  return (
    <div className="break-words text-sm leading-6">
      {text.split("\n").map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />;
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />
              <span><InlineText text={line.slice(2)} /></span>
            </div>
          );
        }
        return <div key={index}><InlineText text={line} /></div>;
      })}
    </div>
  );
}

export function LiteraturePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [tab, setTab] = useState<"chat" | "preview">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const selectedFile = useMemo(
    () => files.find((file) => file.name === selectedName) ?? files[0],
    [files, selectedName],
  );

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (workspace) void api.deleteLiteratureWorkspace(workspace.workspace_id).catch(() => undefined);
    };
  }, [workspace]);

  function acceptFiles(incoming: File[]) {
    setError("");
    const pdfs = incoming.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length !== incoming.length) {
      setError("Only PDF documents can be added to this workspace.");
    }
    const deduplicated = Array.from(
      new Map([...files, ...pdfs].map((file) => [`${file.name}-${file.size}`, file])).values(),
    ).slice(0, 10);
    setFiles(deduplicated);
    setSelectedName((current) => current || deduplicated[0]?.name || "");
    setWorkspace(null);
    setMessages([]);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    acceptFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(Array.from(event.dataTransfer.files));
  }

  function removeFile(name: string) {
    const next = files.filter((file) => file.name !== name);
    setFiles(next);
    setSelectedName(next[0]?.name ?? "");
    setWorkspace(null);
    setMessages([]);
  }

  async function clearWorkspace() {
    if (workspace) {
      await api.deleteLiteratureWorkspace(workspace.workspace_id).catch(() => undefined);
    }
    setFiles([]);
    setWorkspace(null);
    setMessages([]);
    setSelectedName("");
    setQuestion("");
    setError("");
  }

  async function analyze() {
    if (!files.length) return;
    setAnalyzing(true);
    setError("");
    try {
      const result = await api.analyzeLiterature<Workspace>(files);
      setWorkspace(result);
      setMessages([]);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setAnalyzing(false);
    }
  }

  async function ask(value?: string) {
    const activeQuestion = (value ?? question).trim();
    if (!workspace || activeQuestion.length < 3 || asking) return;
    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: activeQuestion }]);
    setAsking(true);
    try {
      const result = await api.askLiterature<{ answer: string; provider: string }>({
        workspace_id: workspace.workspace_id,
        question: activeQuestion,
        mode: "local",
        allow_external_ai: false,
      });
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.answer, provider: result.provider },
      ]);
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1));
      setQuestion(activeQuestion);
      setError(errorMessage(requestError));
    } finally {
      setAsking(false);
    }
  }

  function submitQuestion(event: FormEvent) {
    event.preventDefault();
    void ask();
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <section className="mx-auto max-w-[1500px]">
        <ModuleBanner
          icon={BookOpen}
          eyebrow="Scientific evidence review"
          title="Literature Review"
          description="Extract page-level evidence from uploaded papers, journal articles, and patents, review source documents, and ask focused pharmaceutical R&D questions."
        />

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,0.78fr)_minmax(620px,1.45fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document source</p>
                <h2 className="mt-1 text-lg font-bold text-navy-900">Papers, journals &amp; patents</h2>
              </div>
              <FileSearch className="text-cyan-600" size={23} />
            </div>

            <input
              ref={inputRef}
              className="hidden"
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={onFileInput}
            />
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed px-5 py-8 text-center transition ${
                dragging
                  ? "border-cyan-500 bg-cyan-50"
                  : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/40"
              }`}
            >
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cyan-100 text-cyan-700">
                <UploadCloud size={24} />
              </span>
              <p className="mt-3 text-sm font-semibold text-navy-900">Drop PDFs here or browse</p>
              <p className="mt-1 text-xs text-slate-500">Up to 10 files · 25 MB each · 300 pages total</p>
              <p className="mt-1 text-xs text-slate-500">Scanned pages are recognized locally with OCR.</p>
            </div>

            <div className="mt-4 space-y-2">
              {files.map((file) => (
                <div
                  key={`${file.name}-${file.size}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
                    selectedFile?.name === file.name
                      ? "border-cyan-300 bg-cyan-50/60"
                      : "border-slate-200"
                  }`}
                >
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setSelectedName(file.name)}
                  >
                    <FileText className="shrink-0 text-cyan-700" size={19} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">{file.name}</span>
                      <span className="block text-xs text-slate-500">{formatBytes(file.size)}</span>
                    </span>
                  </button>
                  <button
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(file.name)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>

            {files.length > 0 && (
              <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={() => void analyze()}
                  disabled={analyzing}
                  className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-70"
                >
                  {analyzing ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}
                  {analyzing ? "Extracting locally…" : workspace ? "Reprocess documents" : "Initialize review"}
                </button>
                <button
                  aria-label="Remove all documents"
                  onClick={() => void clearWorkspace()}
                  className="rounded-lg border border-slate-200 px-3 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )}

            {workspace && (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 size={17} />
                  Context ready
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/80 px-2 py-2">
                    <p className="text-lg font-bold text-navy-900">{workspace.documents.length}</p>
                    <p className="text-[11px] text-slate-500">Files</p>
                  </div>
                  <div className="rounded-lg bg-white/80 px-2 py-2">
                    <p className="text-lg font-bold text-navy-900">{workspace.total_pages}</p>
                    <p className="text-[11px] text-slate-500">Pages</p>
                  </div>
                  <div className="rounded-lg bg-white/80 px-2 py-2">
                    <p className="text-lg font-bold text-navy-900">
                      {(workspace.total_characters / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[11px] text-slate-500">Characters</p>
                  </div>
                </div>
                {workspace.documents.some((document) => document.ocr_pages > 0) && (
                  <p className="mt-3 text-xs font-medium text-emerald-700">
                    OCR recognized {workspace.documents.reduce((sum, document) => sum + document.ocr_pages, 0)} scanned {workspace.documents.reduce((sum, document) => sum + document.ocr_pages, 0) === 1 ? "page" : "pages"}.
                  </p>
                )}
                {workspace.warnings.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-amber-200 pt-3 text-xs leading-5 text-amber-800">
                    {workspace.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="min-h-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel">
            <header className="border-b border-slate-200 px-5 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review assistant</p>
                  <h2 className="mt-1 text-lg font-bold text-navy-900">Evidence workspace</h2>
                </div>
                {workspace && (
                  <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {workspace.documents.length} {workspace.documents.length === 1 ? "document" : "documents"} active
                  </span>
                )}
              </div>
              <div className="mt-5 flex gap-5">
                <button
                  onClick={() => setTab("chat")}
                  className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold ${
                    tab === "chat" ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500"
                  }`}
                >
                  <MessageSquareText size={17} />
                  Review chat
                </button>
                <button
                  onClick={() => setTab("preview")}
                  className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold ${
                    tab === "preview" ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500"
                  }`}
                >
                  <FileText size={17} />
                  Document viewer
                </button>
              </div>
            </header>

            {!workspace ? (
              <div className="grid min-h-[540px] place-items-center px-8 text-center">
                <div>
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <Bot size={31} />
                  </span>
                  <h3 className="mt-5 font-bold text-navy-900">No document context active</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Add one or more PDF documents and initialize the review to unlock local,
                    page-cited evidence retrieval.
                  </p>
                </div>
              </div>
            ) : tab === "preview" ? (
              <div className="p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</label>
                  <select
                    value={selectedFile?.name ?? ""}
                    onChange={(event) => setSelectedName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  >
                    {files.map((file) => <option key={file.name} value={file.name}>{file.name}</option>)}
                  </select>
                </div>
                <div className="h-[560px] overflow-hidden rounded-xl border border-slate-300 bg-[#525659]">
                  {previewUrl ? (
                    <iframe title={`Preview of ${selectedFile?.name}`} src={previewUrl} className="h-full w-full" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-slate-300">Preview unavailable</div>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <LockKeyhole size={13} />
                  Previewed directly from your browser; the raw PDF is not saved by the platform.
                </p>
              </div>
            ) : (
              <div className="flex min-h-[600px] flex-col">
                <div className="h-[340px] space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
                  {messages.length === 0 ? (
                    <div className="grid h-full place-items-center text-center">
                      <div>
                        <Bot className="mx-auto text-cyan-600" size={31} />
                        <p className="mt-3 text-sm font-semibold text-navy-900">Context initialized successfully</p>
                        <p className="mt-1 text-xs text-slate-500">Ask a specific question about your documents.</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((message, index) =>
                      message.role === "user" ? (
                        <div key={index} className="flex justify-end">
                          <div className="max-w-[82%] rounded-[18px_18px_4px_18px] bg-slate-700 px-4 py-3 text-slate-50">
                            <MessageText text={message.text} />
                          </div>
                        </div>
                      ) : (
                        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4 text-slate-800">
                          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-700">
                            <Bot size={14} />
                            Evidence response
                          </div>
                          <MessageText text={message.text} />
                        </div>
                      ),
                    )
                  )}
                  {asking && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <LoaderCircle className="animate-spin text-cyan-600" size={17} />
                      Reviewing document evidence…
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 bg-white p-5">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Quick exploration
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {workspace.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        disabled={asking}
                        onClick={() => void ask(suggestion)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800 disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={submitQuestion} className="flex gap-2">
                    <input
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="Cross-reference or ask about the uploaded documents…"
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                    />
                    <button
                      aria-label="Send question"
                      disabled={asking || question.trim().length < 3}
                      className="grid w-12 place-items-center rounded-xl bg-cyan-600 text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
