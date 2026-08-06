import { useState, useRef, useEffect } from "react";
import { Download, FileText, FileSpreadsheet, Image as ImageIcon, Printer } from "lucide-react";
import { exportToWord, exportToPDF, exportToCSV, exportCanvasToPNG } from "../engine/exportEngine";

interface ExportButtonProps {
  title: string;
  fileName?: string;
  tableData?: {
    headers: string[];
    rows: (string | number)[][];
  };
  getCanvas?: () => HTMLCanvasElement | null;
  getHtmlContent?: () => string;
  className?: string;
}

export function ExportButton({
  title,
  fileName = "DOE_Report",
  tableData,
  getCanvas,
  getHtmlContent,
  className = "",
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to build HTML fragment for Word / PDF export
  function buildExportHtml(): string {
    if (getHtmlContent) {
      return getHtmlContent();
    }

    let html = "";

    // Embed Canvas image if available
    if (getCanvas) {
      const canvas = getCanvas();
      if (canvas) {
        const imgData = canvas.toDataURL("image/png");
        html += `<div><img src="${imgData}" alt="${title}" /></div>`;
      }
    }

    // Embed Table if available
    if (tableData) {
      html += `
        <table>
          <thead>
            <tr>
              ${tableData.headers.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${tableData.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      `;
    }

    return html || `<p>${title}</p>`;
  }

  const handleExportWord = () => {
    setIsOpen(false);
    const html = buildExportHtml();
    exportToWord(title, html, fileName);
  };

  const handleExportPDF = () => {
    setIsOpen(false);
    const html = buildExportHtml();
    exportToPDF(title, html);
  };

  const handleExportCSV = () => {
    setIsOpen(false);
    if (!tableData) return;
    exportToCSV(tableData.headers, tableData.rows, fileName);
  };

  const handleExportPNG = () => {
    setIsOpen(false);
    if (!getCanvas) return;
    exportCanvasToPNG(getCanvas(), fileName);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-900 transition cursor-pointer ${className}`}
      >
        <Download size={14} className="text-cyan-700 shrink-0" />
        <span>Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl z-50 animate-fadeIn text-xs">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Export {title}
          </div>

          {/* Export to Word */}
          <button
            type="button"
            onClick={handleExportWord}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-950 transition"
          >
            <FileText size={16} className="text-blue-700 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold">Export to Word (.doc)</span>
              <span className="text-[10px] text-slate-400">Microsoft Word Document</span>
            </div>
          </button>

          {/* Export to PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-950 transition"
          >
            <Printer size={16} className="text-rose-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-bold">Export to PDF (.pdf)</span>
              <span className="text-[10px] text-slate-400">Printable PDF Document</span>
            </div>
          </button>

          {/* Export to Excel / CSV */}
          {tableData && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 transition"
            >
              <FileSpreadsheet size={16} className="text-emerald-700 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold">Export to Excel (.csv)</span>
                <span className="text-[10px] text-slate-400">Spreadsheet Data Table</span>
              </div>
            </button>
          )}

          {/* Export Image PNG */}
          {getCanvas && (
            <button
              type="button"
              onClick={handleExportPNG}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-950 transition"
            >
              <ImageIcon size={16} className="text-purple-700 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold">Export Image (.png)</span>
                <span className="text-[10px] text-slate-400">High-Res Surface PNG</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
