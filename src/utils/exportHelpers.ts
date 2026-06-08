import { jsPDF } from "jspdf";
import { DocumentElement, DocumentLayout } from "../types";

/**
 * Trigger browser file downloads cleanly
 */
function downloadFile(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export OCR layout to clean TXT file sorted by reading order (y then x)
 */
export function exportToTXT(elements: DocumentElement[], filename: string = "document-reconstructed.txt") {
  const textElements = elements
    .filter(el => el.type === "text" || el.type === "heading")
    .sort((a, b) => {
      // Sort vertically first, then horizontally
      if (Math.abs(a.y - b.y) < 15) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

  const txtContent = textElements.map(el => el.content).join("\n\n");
  downloadFile(txtContent, "text/plain;charset=utf-8", filename);
}

/**
 * Export full JSON configuration layout for serialization
 */
export function exportToJSON(layout: DocumentLayout, filename: string = "document-reconstructed.json") {
  const jsonString = JSON.stringify(layout, null, 2);
  downloadFile(jsonString, "application/json;charset=utf-8", filename);
}

/**
 * Export layout to standalone absolute-positioned HTML page with visual sheets representation
 */
export function exportToHTML(
  elements: DocumentElement[], 
  width: number = 800, 
  height: number = 1050, 
  filename: string = "document-reconstructed.html",
  pageCount: number = 1
) {
  // Generate multi-page structured HTML boxes
  const pagesHtml = Array.from({ length: pageCount }).map((_, pageIndex) => {
    const pageElements = elements.filter(el => {
      const idx = Math.floor(el.y / 1050);
      return idx === pageIndex;
    });

    const pageElementsHtml = pageElements.map(el => {
      const localY = el.y % 1050;
      let style = `position: absolute; left: ${el.x}px; top: ${localY}px; width: ${el.width}px; height: ${el.height}px; margin: 0; box-sizing: border-box;`;
      
      if (el.type === "heading" || el.type === "text") {
        const family = el.fontFamily === "Space Grotesk" ? "'Space Grotesk', sans-serif" : 
                       el.fontFamily === "JetBrains Mono" ? "'JetBrains Mono', monospace" : 
                       "'Inter', sans-serif";
        style += ` font-size: ${el.fontSize || 14}px; font-weight: ${el.fontWeight === "bold" ? "bold" : "normal"}; font-style: ${el.fontStyle === "italic" ? "italic" : "normal"}; color: ${el.color || "#090d16"}; font-family: ${family}; text-align: ${el.alignment || "left"}; white-space: pre-wrap;`;
      } else if (el.type === "divider") {
        style += ` border-top: ${el.height > 2 ? el.height : 2}px solid ${el.color || "#e2e8f0"};`;
      } else if (el.type === "image") {
        style += ` border: 1px dashed #cbd5e1; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 11px; font-family: sans-serif; color: #475569; overflow: hidden;`;
      }

      const tag = el.type === "heading" ? "h1" : "div";
      const inner = el.type === "image" ? `<span>🖼️ ${el.content}</span>` : el.content.replace(/\n/g, "<br/>");
      return `    <${tag} style="${style}">${inner}</${tag}>`;
    }).join("\n");

    return `  <div class="page-container">
    <div class="page-header-ribbon">PAGE ${pageIndex + 1}</div>
${pageElementsHtml}
  </div>`;
  }).join("\n");

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reconstructed Document - Chnada OCR</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #f1f5f9;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: 'Inter', sans-serif;
    }
    .document-wrapper {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .page-container {
      position: relative;
      background: #ffffff;
      width: ${width}px;
      height: 1050px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .page-header-ribbon {
      position: absolute;
      top: 10px;
      right: 15px;
      font-family: monospace;
      font-size: 8px;
      font-weight: bold;
      color: #94a3b8;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      z-index: 100;
    }
  </style>
</head>
<body>
  <div class="document-wrapper">
${pagesHtml}
  </div>
</body>
</html>`;

  downloadFile(fullHtml, "text/html;charset=utf-8", filename);
}

/**
 * Export layout structure to Microsoft Word compatible formatted file
 * Employs MHTML/HTML single-file document style that Microsoft Word loads flawlessly
 */
export function exportToWord(elements: DocumentElement[], filename: string = "document-reconstructed.doc") {
  const elementsBody = elements.map(el => {
    if (el.type === "divider") {
      return `<hr style="border: none; border-top: 1px solid ${el.color || '#cbd5e1'}; margin: 16px 0;" />`;
    }
    
    const isHeading = el.type === "heading";
    const tag = isHeading ? "h1" : "p";
    
    // Convert alignment properties to Inline Word-compatible styling values
    let align = "left";
    if (el.alignment === "center") align = "center";
    else if (el.alignment === "right") align = "right";

    // Text formatting
    const isBold = el.fontWeight === "bold";
    const isItalic = el.fontStyle === "italic";
    
    let style = `text-align: ${align}; color: ${el.color || '#090d16'}; font-size: ${el.fontSize || 14}px; font-family: sans-serif;`;
    if (isBold) style += " font-weight: bold;";
    if (isItalic) style += " font-style: italic;";

    return `<${tag} style="${style}">${el.content.replace(/\n/g, "<br/>")}</${tag}>`;
  }).join("\n");

  const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <title>Spun OCR Document</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: "Arial", sans-serif;
      margin: 1in;
    }
    h1 {
      font-size: 18pt;
      margin-bottom: 12pt;
    }
    p {
      font-size: 11pt;
      margin-bottom: 6pt;
    }
  </style>
</head>
<body>
  ${elementsBody}
</body>
</html>`;

  downloadFile(wordHtml, "application/msword", filename);
}

/**
 * Export layout metadata and coordinate rows to CSV suitable as spreadsheet tables
 */
export function exportToCSV(elements: DocumentElement[], filename: string = "document-reconstructed.csv") {
  const headers = ["ID", "Type", "Text Content", "X Coordinate", "Y Coordinate", "Width", "Height", "Font Size", "Alignment"];
  const rows = elements.map(el => {
    const escapedContent = `"${el.content.replace(/"/g, '""')}"`;
    return [
      el.id,
      el.type,
      escapedContent,
      el.x,
      el.y,
      el.width,
      el.height,
      el.fontSize || "",
      el.alignment || ""
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(","))
  ].join("\n");

  downloadFile(csvContent, "text/csv;charset=utf-8", filename);
}

/**
 * Export OCR bounding boxes to a real high-fidelity PDF with shapes and font measurements using jsPDF
 */
export function exportToPDF(
  elements: DocumentElement[], 
  width: number = 800, 
  height: number = 1050, 
  filename: string = "document-reconstructed.pdf",
  pageCount: number = 1
) {
  // A4 paper specs
  const a4Width = 595.28;
  const a4Height = 841.89;
  
  const scaleX = a4Width / width;
  const scaleY = a4Height / 1050; // Each 1050 coordinate height blocks maps onto 1 A4 PDF Page

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4"
  });

  // Sort elements primarily by calculated page block layer first, then by internal local heights
  const sorted = [...elements].sort((a, b) => {
    const pageA = Math.floor(a.y / 1050);
    const pageB = Math.floor(b.y / 1050);
    if (pageA !== pageB) {
      return pageA - pageB;
    }
    return (a.y % 1050) - (b.y % 1050);
  });

  let currentPDFPage = 1;

  sorted.forEach(el => {
    const targetPageIndex = Math.floor(el.y / 1050);
    const pageNumber = targetPageIndex + 1;

    // Create new pages in the PDF document until we match targetPageIndex
    while (currentPDFPage < pageNumber && currentPDFPage < pageCount) {
      doc.addPage();
      currentPDFPage++;
    }

    // Direct active drawer buffer to print on the correct sheet
    doc.setPage(pageNumber);

    // Grid local Y displacement inside its particular sheet
    const localY = el.y % 1050;

    const ptX = el.x * scaleX;
    const ptY = localY * scaleY;
    const ptWidth = el.width * scaleX;
    const ptHeight = el.height * scaleY;

    if (el.type === "heading" || el.type === "text") {
      const isBold = el.fontWeight === "bold";
      const isItalic = el.fontStyle === "italic";
      
      let fontType = "normal";
      if (isBold && isItalic) fontType = "bolditalic";
      else if (isBold) fontType = "bold";
      else if (isItalic) fontType = "italic";

      let fontName = "Helvetica";
      if (el.fontFamily === "Space Grotesk") fontName = "Courier";
      else if (el.fontFamily === "JetBrains Mono") fontName = "Courier";

      doc.setFont(fontName, fontType);

      const ptFontSize = (el.fontSize || 14) * 0.82;
      doc.setFontSize(ptFontSize);

      if (el.color) {
        const cleanedHex = el.color.replace("#", "");
        if (cleanedHex.length === 6) {
          const r = parseInt(cleanedHex.substring(0, 2), 16);
          const g = parseInt(cleanedHex.substring(2, 4), 16);
          const b = parseInt(cleanedHex.substring(4, 6), 16);
          doc.setTextColor(r, g, b);
        }
      } else {
        doc.setTextColor(15, 23, 42); // slate-900
      }

      const lines = doc.splitTextToSize(el.content, ptWidth);
      
      if (el.alignment === "center") {
        doc.text(lines, ptX + ptWidth / 2, ptY + ptFontSize, { align: "center" });
      } else if (el.alignment === "right") {
        doc.text(lines, ptX + ptWidth, ptY + ptFontSize, { align: "right" });
      } else {
        doc.text(lines, ptX, ptY + ptFontSize, { align: "left" });
      }

    } else if (el.type === "divider") {
      const lineThickness = Math.max(1, ptHeight);
      doc.setLineWidth(lineThickness);
      
      if (el.color) {
        const cleanedHex = el.color.replace("#", "");
        if (cleanedHex.length === 6) {
          const r = parseInt(cleanedHex.substring(0, 2), 16);
          const g = parseInt(cleanedHex.substring(2, 4), 16);
          const b = parseInt(cleanedHex.substring(4, 6), 16);
          doc.setDrawColor(r, g, b);
        }
      } else {
        doc.setDrawColor(226, 232, 240); // slate-200
      }
      
      doc.line(ptX, ptY, ptX + ptWidth, ptY);

    } else if (el.type === "image") {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(1);
      doc.rect(ptX, ptY, ptWidth, ptHeight, "D");
      
      doc.setFont("Helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      
      const label = `[Image: ${el.content.substring(0, 15)}...]`;
      doc.text(label, ptX + 5, ptY + ptHeight / 2 + 3);
    }
  });

  doc.save(filename);
}
