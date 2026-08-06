// Export Utility Engine for Microsoft Word (.docx/.doc), PDF, Excel/CSV, and PNG Images

/**
 * Helper to download Blob content as a file
 */
export function downloadFile(content: BlobPart, fileName: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Content / Tables / Images directly to a Microsoft Word Document (.doc / .docx compatible)
 */
export function exportToWord(title: string, htmlBody: string, fileName: string) {
  const wordDocumentHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![style]>
      <style>
        @page { size: A4 portrait; margin: 1.0in 1.0in 1.0in 1.0in; }
        body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.5; }
        h1 { color: #0369a1; font-size: 20pt; border-bottom: 2pt solid #0284c7; padding-bottom: 4pt; margin-top: 10pt; }
        h2 { color: #0f172a; font-size: 14pt; margin-top: 16pt; margin-bottom: 6pt; border-bottom: 1pt solid #e2e8f0; }
        h3 { color: #334155; font-size: 12pt; margin-top: 12pt; }
        p, li { font-size: 10.5pt; color: #334155; }
        table { border-collapse: collapse; width: 100%; margin-top: 10pt; margin-bottom: 15pt; }
        th { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 9.5pt; padding: 6pt 8pt; border: 1pt solid #0f172a; text-align: left; }
        td { border: 1pt solid #cbd5e1; padding: 6pt 8pt; font-size: 9.5pt; font-family: Consolas, 'Courier New', monospace; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .header-box { background-color: #f0f9ff; border: 1pt solid #bae6fd; padding: 12pt; margin-bottom: 16pt; border-radius: 6pt; }
        .header-title { font-weight: bold; color: #0369a1; font-size: 12pt; }
        .meta-text { font-size: 9pt; color: #64748b; margin-top: 4pt; }
        .badge { background-color: #0284c7; color: white; padding: 2pt 6pt; border-radius: 3pt; font-weight: bold; font-size: 8.5pt; }
        img { max-width: 100%; height: auto; border: 1pt solid #cbd5e1; margin-top: 12pt; margin-bottom: 12pt; }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="header-title">ACME R&D Platform — Executive DoE Quality & Statistical Report</div>
        <div class="meta-text">Report Title: <strong>${title}</strong> | Date: ${new Date().toLocaleString()} | Environment: Production R&D Studio</div>
      </div>
      <h1>${title}</h1>
      ${htmlBody}
    </body>
    </html>
  `;

  downloadFile(wordDocumentHtml, `${fileName}.doc`, "application/msword");
}

/**
 * Export Data Table to CSV (opens natively in Microsoft Excel)
 */
export function exportToCSV(headers: string[], rows: (string | number)[][], fileName: string) {
  const csvLines = [
    headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")),
  ];

  downloadFile(csvLines.join("\r\n"), `${fileName}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Export Canvas Component to High-Res PNG Image
 */
export function exportCanvasToPNG(canvas: HTMLCanvasElement | null, fileName: string) {
  if (!canvas) return;
  const dataURL = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Export Content to Printable PDF Document Window
 */
export function exportToPDF(title: string, htmlBody: string) {
  const printWin = window.open("", "_blank");
  if (!printWin) return;

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #0f172a; line-height: 1.5; }
        h1 { color: #0284c7; font-size: 18px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; }
        h2 { font-size: 14px; color: #0f172a; margin-top: 15px; border-bottom: 1px solid #e2e8f0; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 15px; }
        th { background-color: #0f172a; color: white; font-size: 10px; padding: 6px; text-align: left; }
        td { border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; font-family: monospace; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .meta { font-size: 11px; color: #64748b; margin-bottom: 15px; background: #f0f9ff; padding: 10px; border-radius: 6px; border: 1px solid #bae6fd; }
        img { max-width: 100%; height: auto; border: 1px solid #cbd5e1; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">
        <strong>ACME R&D Intelligence Platform</strong> — Exported on ${new Date().toLocaleString()}
      </div>
      ${htmlBody}
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}
