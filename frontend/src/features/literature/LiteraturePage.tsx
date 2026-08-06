import {
  AlertTriangle,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSearch,
  FileText,
  GripHorizontal,
  HelpCircle,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  MessageSquareText,
  Minimize2,
  ScanText,
  Send,
  Sliders,
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

const QUICK_EXPLORATION_QUESTIONS = [
  "📝 Give me a short summary of what this document is all about",
  "🎯 What are the main key findings and conclusions of this document?",
  "❓ What is the background problem or main objective being addressed?",
  "💡 What are the most important key takeaways from this paper?",
  "💬 Explain the main results in simple, easy-to-understand terms",
  "🔬 Which methods and experimental techniques were used?",
];

export function LiteraturePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedName, setSelectedName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [tab, setTab] = useState<"chat" | "preview">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useState<string>(() => sessionStorage.getItem("acme_gemini_key") ?? "");
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [showStepGuide, setShowStepGuide] = useState(true);
  const [hideUploadSidebar, setHideUploadSidebar] = useState(false);
  const [customHeight, setCustomHeight] = useState<number>(760);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  function exportToWord() {
    if (messages.length === 0) {
      setError("No review evidence or chat history to export yet. Ask a question first!");
      return;
    }

    const docTitle = selectedFile?.name || "ACME Literature Review Report";
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    let contentHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${docTitle}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.6; margin: 30px; }
          .header-box { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          h1 { color: #0f172a; font-size: 20pt; margin: 0 0 6px 0; }
          .subtitle { color: #0284c7; font-size: 11pt; font-weight: bold; margin: 0; }
          .meta-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 25px; background-color: #f8fafc; border: 1px solid #e2e8f0; }
          .meta-table td { padding: 8px 12px; font-size: 9.5pt; border: 1px solid #e2e8f0; }
          .meta-label { font-weight: bold; color: #475569; width: 140px; }
          .section-title { font-size: 13pt; font-weight: bold; color: #0f172a; margin-top: 25px; margin-bottom: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
          .chat-item { margin-bottom: 20px; }
          .question-box { background-color: #f1f5f9; border-left: 4px solid #0284c7; padding: 10px 14px; font-weight: bold; color: #0f172a; margin-bottom: 8px; border-radius: 4px; }
          .answer-box { background-color: #ffffff; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 4px; color: #334155; line-height: 1.6; }
          .footer { margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-size: 9pt; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1>Literature Review Report</h1>
          <p class="subtitle">Document Evidence Analysis</p>
        </div>

        <table class="meta-table">
          <tr><td class="meta-label">Date Generated:</td><td>${dateStr}</td></tr>
          <tr><td class="meta-label">Active Document:</td><td>${docTitle}</td></tr>
          <tr><td class="meta-label">Loaded Documents:</td><td>${files.map((f) => f.name).join(", ") || "None"}</td></tr>
          <tr><td class="meta-label">Total Pages:</td><td>${workspace?.total_pages || "N/A"}</td></tr>
        </table>

        <div class="section-title">Q&amp;A Evidence Review History</div>
    `;

    messages.forEach((msg, idx) => {
      if (msg.role === "user") {
        contentHtml += `
          <div class="chat-item">
            <div class="question-box">Question ${Math.floor(idx / 2) + 1}: ${msg.text}</div>
        `;
      } else {
        const formattedAnswer = msg.text
          .replace(/\n\n/g, "<br/><br/>")
          .replace(/\n/g, "<br/>")
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        contentHtml += `
            <div class="answer-box">
              <strong>Evidence Answer:</strong><br/><br/>
              ${formattedAnswer}
            </div>
          </div>
        `;
      }
    });

    contentHtml += `
        <div class="footer">
          Report generated by ACME R&amp;D Platform Literature Module · ${dateStr}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([contentHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanFilename = (selectedFile?.name.replace(/\.[^/.]+$/, "") || "Literature_Review") + "_Report.doc";
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const startResizing = (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    const startY = mouseDownEvent.clientY;
    const startHeight = customHeight;

    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const deltaY = mouseMoveEvent.clientY - startY;
      const newHeight = Math.max(450, Math.min(startHeight + deltaY, 1600));
      setCustomHeight(newHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const selectedFile = useMemo(
    () => files.find((file) => file.name === selectedName) ?? files[0],
    [files, selectedName],
  );

  useEffect(() => {
    if (apiKey) {
      sessionStorage.setItem("acme_gemini_key", apiKey);
    } else {
      sessionStorage.removeItem("acme_gemini_key");
    }
  }, [apiKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

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
      const result = await api.analyzeLiterature<Workspace>(files, apiKey);
      setWorkspace(result);
      setMessages([]);
      setHideUploadSidebar(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setAnalyzing(false);
    }
  }

  async function ask(value?: string) {
    const activeQuestion = (value ?? question).trim();
    if (activeQuestion.length < 3 || asking || analyzing) return;

    let activeWs = workspace;

    if (!activeWs) {
      if (!files.length) {
        setError("Please upload at least one PDF document first.");
        return;
      }
      setAnalyzing(true);
      setError("");
      try {
        activeWs = await api.analyzeLiterature<Workspace>(files, apiKey);
        setWorkspace(activeWs);
        setHideUploadSidebar(true);
      } catch (requestError) {
        setError(errorMessage(requestError));
        setAnalyzing(false);
        return;
      } finally {
        setAnalyzing(false);
      }
    }

    setQuestion("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: activeQuestion }]);
    setAsking(true);
    try {
      const result = await api.askLiterature<{ answer: string; provider: string }>(
        {
          workspace_id: activeWs.workspace_id,
          question: activeQuestion,
          mode: "gemini",
          allow_external_ai: true,
        },
        apiKey,
      );
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

        {/* Workspace Layout Controls Toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHideUploadSidebar(!hideUploadSidebar)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-navy-900 transition"
              title={hideUploadSidebar ? "Show Document Source Sidebar" : "Hide Sidebar for Full-Width Reading"}
            >
              {hideUploadSidebar ? (
                <>
                  <Eye size={14} className="text-cyan-600" />
                  Show Upload Sidebar
                </>
              ) : (
                <>
                  <EyeOff size={14} className="text-slate-500" />
                  Hide Upload Sidebar (Full-Width Mode)
                </>
              )}
            </button>
            {hideUploadSidebar && files.length > 0 && (
              <span className="text-xs font-medium text-slate-500">
                📄 {files.length} active PDF document{files.length === 1 ? "" : "s"} loaded
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
            <GripHorizontal size={14} className="text-cyan-600" />
            Drag handle at bottom of workspace to adjust height with mouse ({customHeight}px)
          </div>
        </div>

        <div
          className={`mt-4 grid gap-6 transition-all duration-300 ${
            hideUploadSidebar
              ? "grid-cols-1"
              : "xl:grid-cols-[minmax(320px,0.75fr)_minmax(640px,1.48fr)]"
          }`}
        >
          {!hideUploadSidebar && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document source</p>
                  <h2 className="mt-1 text-lg font-bold text-navy-900">Papers, journals &amp; patents</h2>
                </div>
                <button
                  onClick={() => setHideUploadSidebar(true)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Hide Sidebar"
                >
                  <ChevronLeft size={20} />
                </button>
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
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <ScanText size={13} className="text-emerald-600" />
                  Supports Scanned PDFs &amp; Images with Tesseract OCR
                </div>
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
                    {analyzing ? "Extracting with OCR…" : workspace ? "Reprocess documents" : "Initialize review"}
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
                    Context ready &amp; OCR processed
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
          )}

          <section
            style={{ height: `${customHeight}px` }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-panel flex flex-col transition-none relative"
          >
            <header className="border-b border-slate-200 px-5 pt-5 shrink-0 bg-white z-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-xs">
                    <Brain size={22} />
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-navy-950 uppercase tracking-tight">AI REVIEW ASSISTANT</h2>
                    <p className="text-xs text-slate-500 font-medium">Get comprehensive insights and analysis</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 border border-cyan-200">
                    <Sparkles size={14} className="text-cyan-600" />
                    Gemini AI Engine
                  </span>

                  <button
                    onClick={() => setShowKeySetup(!showKeySetup)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
                    title="Configure custom Gemini API Key"
                  >
                    <LockKeyhole size={13} className={apiKey ? "text-emerald-600" : "text-amber-500"} />
                    {apiKey ? "Gemini Key Active ✓" : "Setup Gemini Key"}
                  </button>

                  <button
                    onClick={exportToWord}
                    disabled={messages.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
                    title="Export conversation and evidence analysis to Microsoft Word (.docx)"
                  >
                    <Download size={13} className="text-blue-600" />
                    Export to Word (.docx)
                  </button>

                  {workspace && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      {workspace.documents.length} active
                    </span>
                  )}
                </div>
              </div>

              {showKeySetup && (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-white shadow-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-bold text-sm text-cyan-300">
                      <Sparkles size={16} className="text-cyan-400" />
                      Setup Google Gemini API Key
                    </h3>
                    <button onClick={() => setShowKeySetup(false)} className="text-slate-400 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 leading-5">
                    This module sends the selected document and question to the configured Gemini model through the portal backend.
                    You can create an API key at{" "}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:underline"
                    >
                      Google AI Studio <ExternalLink size={12} />
                    </a>
                    . The key is kept in memory for this tab only and is cleared when you reload or close the page.
                  </p>

                  <div className="pt-1">
                    <button
                      onClick={() => setShowStepGuide(!showStepGuide)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                    >
                      <HelpCircle size={14} />
                      Need help getting your API key? Click here
                    </button>

                    {showStepGuide && (
                      <div className="mt-3 rounded-lg border border-slate-700 bg-slate-800/90 p-3.5 text-xs space-y-2.5 text-slate-200">
                        <div className="flex items-center gap-2 font-bold text-cyan-300">
                          <Sparkles size={14} />
                          How to get your API Key (Free & Instant)
                        </div>
                        <ol className="space-y-1.5 list-decimal pl-4 leading-5 text-slate-300">
                          <li>
                            Click on the{" "}
                            <a
                              href="https://aistudio.google.com/app/apikey"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-emerald-400 underline"
                            >
                              Google AI Studio
                            </a>{" "}
                            link (opens in a new tab).
                          </li>
                          <li>Log in with any standard Google account (e.g. your personal Gmail address).</li>
                          <li>Click the blue <strong>"Create API Key"</strong> button on the dashboard.</li>
                          <li>Select <strong>"Create API key in new project"</strong> (or select default project).</li>
                          <li>Click the <strong>Copy key</strong> icon from the popup window and paste it into the box below.</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your Gemini API key (AIzaSy...)"
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                    {apiKey && (
                      <button
                        onClick={() => setApiKey("")}
                        className="rounded-lg border border-rose-900/40 bg-rose-950/50 px-3 text-xs font-medium text-rose-300 hover:bg-rose-900"
                      >
                        Clear Key
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex gap-5">
                <button
                  onClick={() => setTab("chat")}
                  className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    tab === "chat" ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <MessageSquareText size={17} />
                  Review chat
                </button>
                <button
                  onClick={() => setTab("preview")}
                  className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    tab === "preview" ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileText size={17} />
                  Document viewer
                </button>
              </div>
            </header>

            {!workspace ? (
              <div className="flex-1 min-h-0 flex flex-col justify-between p-6 text-center">
                <div className="flex-1 min-h-0 grid place-items-center">
                  <div>
                    <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                      <Bot size={31} />
                    </span>
                    <h3 className="mt-4 font-bold text-navy-900 text-base">
                      {files.length > 0 ? "📄 Documents Ready for AI Review" : "No Document Context Active"}
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">
                      {files.length > 0
                        ? "Click 'Initialize review' or click any Quick Exploration question below to instantly analyze your PDF."
                        : "Upload one or more PDF documents on the left to unlock AI evidence retrieval."}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-white pt-4 text-left shrink-0">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-600" />
                    Quick exploration questions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_EXPLORATION_QUESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        disabled={analyzing || asking}
                        onClick={() => void ask(suggestion)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 transition-colors disabled:opacity-50 text-left"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : tab === "preview" ? (
              <div className="p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="mb-3 flex flex-wrap items-center gap-3 shrink-0">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document</label>
                  <select
                    value={selectedFile?.name ?? ""}
                    onChange={(event) => setSelectedName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
                  >
                    {files.map((file) => <option key={file.name} value={file.name}>{file.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-300 bg-[#525659]">
                  {previewUrl ? (
                    <iframe title={`Preview of ${selectedFile?.name}`} src={previewUrl} className="h-full w-full border-0" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-slate-300">Preview unavailable</div>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-slate-500 shrink-0">
                  <LockKeyhole size={13} />
                  Previewed directly from your browser; the raw PDF is not saved by the platform.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
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
                  <div ref={chatEndRef} />
                </div>

                <div className="border-t border-slate-200 bg-white p-4 shrink-0">
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-600" />
                    Quick exploration questions
                  </p>
                  <div className="mb-3.5 flex flex-wrap gap-2">
                    {QUICK_EXPLORATION_QUESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        disabled={asking}
                        onClick={() => void ask(suggestion)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-900 transition-colors disabled:opacity-50 text-left"
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
                      className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
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

            {/* Mouse Drag Height Resize Handle Bar */}
            <div
              onMouseDown={startResizing}
              className={`group flex h-5 w-full shrink-0 cursor-ns-resize items-center justify-center border-t border-slate-200 bg-slate-100/90 select-none transition-colors hover:bg-cyan-100 ${
                isResizing ? "bg-cyan-200 border-cyan-400" : ""
              }`}
              title="Click and drag up or down with your mouse to adjust workspace height"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 group-hover:text-cyan-800">
                <GripHorizontal size={14} className="text-cyan-600" />
                <span className="text-[10px] text-slate-400 group-hover:text-cyan-700">Drag to adjust height with mouse ({customHeight}px)</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
