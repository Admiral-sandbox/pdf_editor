import React, { useRef, useState, useEffect } from "react";
import { DocumentElement } from "../types";
import { AlertCircle, ScanLine, RotateCw, RotateCcw, Crop, Check, X } from "lucide-react";

interface DocumentViewerProps {
  originalImage: string | null; // URL or base64
  imagePlaceholderType: string;  // Presets like 'official_letter' | 'invoice'
  elements: DocumentElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  isLoading: boolean;
  onUpdateElement?: (id: string, updatedFields: Partial<DocumentElement>) => void;
  onUpdateImage?: (newImageB64: string) => void;
  pageCount?: number;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  originalImage,
  imagePlaceholderType,
  elements,
  selectedElementId,
  onSelectElement,
  isLoading,
  onUpdateElement,
  onUpdateImage,
  pageCount = 1
}) => {
  const documentContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Cropping states
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 15, y: 15, w: 70, h: 70 }); // percentages
  const [activeCropDrag, setActiveCropDrag] = useState<'move' | 'tl' | 'tr' | 'bl' | 'br' | null>(null);
  const [cropDragStart, setCropDragStart] = useState({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  // Grid size constants matching backend and layout
  const gridWidth = 800;
  const gridHeightPerPage = 1050;
  const gridHeight = gridHeightPerPage * pageCount;

  // Handle Drag Start
  const handleDragStart = (e: React.MouseEvent, el: DocumentElement) => {
    if (!onUpdateElement || isCropMode) return;
    e.stopPropagation();
    onSelectElement(el.id);
    
    if (documentContainerRef.current) {
      const rect = documentContainerRef.current.getBoundingClientRect();
      const scaleX = gridWidth / rect.width;
      const scaleY = gridHeight / rect.height;
      
      const mouseXGrid = (e.clientX - rect.left) * scaleX;
      const mouseYGrid = (e.clientY - rect.top) * scaleY;
      
      setDragOffset({
        x: mouseXGrid - el.x,
        y: mouseYGrid - el.y
      });
      setActiveDragId(el.id);
    }
  };

  // Handle Drag Move (Global listeners)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDragId || !documentContainerRef.current || !onUpdateElement) return;
      
      const rect = documentContainerRef.current.getBoundingClientRect();
      const scaleX = gridWidth / rect.width;
      const scaleY = gridHeight / rect.height;
      
      const mouseXGrid = (e.clientX - rect.left) * scaleX;
      const mouseYGrid = (e.clientY - rect.top) * scaleY;
      
      let newX = Math.round(mouseXGrid - dragOffset.x);
      let newY = Math.round(mouseYGrid - dragOffset.y);
      
      // Keep boundaries neat & snapped inside the paper bounding box
      newX = Math.max(0, Math.min(gridWidth - 50, newX));
      newY = Math.max(0, Math.min(gridHeight - 30, newY));
      
      onUpdateElement(activeDragId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setActiveDragId(null);
    };

    if (activeDragId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeDragId, dragOffset, onUpdateElement, gridHeight]);

  // Handle Crop Mouse Drag Events
  const handleCropMouseDown = (e: React.MouseEvent, handle: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    e.stopPropagation();
    e.preventDefault();
    setActiveCropDrag(handle);
    setCropDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: cropBox.x,
      boxY: cropBox.y,
      boxW: cropBox.w,
      boxH: cropBox.h
    });
  };

  // Drag and resize cropBox calculations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeCropDrag) return;

      const deltaX = e.clientX - cropDragStart.mouseX;
      const deltaY = e.clientY - cropDragStart.mouseY;

      // Translate pixels to percentage based on the documentContainerRef
      const imageContainer = documentContainerRef.current?.getBoundingClientRect();
      if (!imageContainer) return;

      const pctDeltaX = (deltaX / imageContainer.width) * 100;
      const pctDeltaY = (deltaY / imageContainer.height) * 100;

      let nextX = cropDragStart.boxX;
      let nextY = cropDragStart.boxY;
      let nextW = cropDragStart.boxW;
      let nextH = cropDragStart.boxH;

      if (activeCropDrag === 'move') {
        nextX = Math.max(0, Math.min(100 - cropDragStart.boxW, cropDragStart.boxX + pctDeltaX));
        nextY = Math.max(0, Math.min(100 - cropDragStart.boxH, cropDragStart.boxY + pctDeltaY));
      } else if (activeCropDrag === 'tl') {
        nextX = Math.max(0, Math.min(cropDragStart.boxX + cropDragStart.boxW - 10, cropDragStart.boxX + pctDeltaX));
        nextW = (cropDragStart.boxX + cropDragStart.boxW) - nextX;
        nextY = Math.max(0, Math.min(cropDragStart.boxY + cropDragStart.boxH - 10, cropDragStart.boxY + pctDeltaY));
        nextH = (cropDragStart.boxY + cropDragStart.boxH) - nextY;
      } else if (activeCropDrag === 'tr') {
        const nextRight = Math.max(cropDragStart.boxX + 10, Math.min(100, cropDragStart.boxX + cropDragStart.boxW + pctDeltaX));
        nextW = nextRight - nextX;
        nextY = Math.max(0, Math.min(cropDragStart.boxY + cropDragStart.boxH - 10, cropDragStart.boxY + pctDeltaY));
        nextH = (cropDragStart.boxY + cropDragStart.boxH) - nextY;
      } else if (activeCropDrag === 'bl') {
        nextX = Math.max(0, Math.min(cropDragStart.boxX + cropDragStart.boxW - 10, cropDragStart.boxX + pctDeltaX));
        nextW = (cropDragStart.boxX + cropDragStart.boxW) - nextX;
        const nextBottom = Math.max(cropDragStart.boxY + 10, Math.min(100, cropDragStart.boxY + cropDragStart.boxH + pctDeltaY));
        nextH = nextBottom - nextY;
      } else if (activeCropDrag === 'br') {
        const nextRight = Math.max(cropDragStart.boxX + 10, Math.min(100, cropDragStart.boxX + cropDragStart.boxW + pctDeltaX));
        const nextBottom = Math.max(cropDragStart.boxY + 10, Math.min(100, cropDragStart.boxY + cropDragStart.boxH + pctDeltaY));
        nextW = nextRight - nextX;
        nextH = nextBottom - nextY;
      }

      setCropBox({
        x: Math.min(90, Math.max(0, Math.round(nextX))),
        y: Math.min(90, Math.max(0, Math.round(nextY))),
        w: Math.min(100, Math.max(10, Math.round(nextW))),
        h: Math.min(100, Math.max(10, Math.round(nextH)))
      });
    };

    const handleMouseUp = () => {
      setActiveCropDrag(null);
    };

    if (activeCropDrag) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [activeCropDrag, cropDragStart]);

  // Physically rotate uploaded base64 image clockwise or counter-clockwise (90 degrees)
  const handleRotateImage = (direction: 'cw' | 'ccw') => {
    if (!originalImage || !onUpdateImage) return;

    const angle = direction === 'cw' ? 90 : -90;
    const img = new Image();
    img.src = originalImage;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Swapped dimension heights and widths
      canvas.width = img.height;
      canvas.height = img.width;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedB64 = canvas.toDataURL("image/png");
      onUpdateImage(rotatedB64);
    };
  };

  // Physically crop uploaded image based on proportion selection
  const handleApplyCrop = () => {
    if (!originalImage || !onUpdateImage) return;

    const img = new Image();
    img.src = originalImage;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const sX = (cropBox.x / 100) * img.width;
      const sY = (cropBox.y / 100) * img.height;
      const sW = (cropBox.w / 100) * img.width;
      const sH = (cropBox.h / 100) * img.height;

      canvas.width = sW;
      canvas.height = sH;

      ctx.drawImage(
        img,
        sX, sY, sW, sH, // original cropped section coordinates
        0, 0, sW, sH   // output size matches selection exactly
      );

      const croppedB64 = canvas.toDataURL("image/png");
      onUpdateImage(croppedB64);
      setIsCropMode(false);
    };
  };

  // Render a high-fidelity visual mock of the scanned paper if no custom upload is provided.
  // This gives an amazing dual-view experience for samples right away!
  const renderScannedPaperMock = () => {
    if (imagePlaceholderType === "official_letter") {
      return (
        <div className="relative w-full h-full bg-[#fafaf9] border border-stone-200 shadow-inner p-8 overflow-hidden rounded select-none font-serif text-[10px] text-stone-800 leading-normal flex flex-col justify-between" style={{ height: '100%' }}>
          <div>
            {/* Subtle crinkle scanner overlays */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-[#1007000d] pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-1 bg-stone-300/30 blur-[1px] pointer-events-none" />
            
            {/* Karnataka Government Seal Mock */}
            <div className="flex flex-col items-center mt-4 opacity-75">
              <div className="w-16 h-16 border-2 border-[#b91c1c] rounded-full flex items-center justify-center font-bold text-[#b91c1c] text-center p-1 text-[8px] tracking-wide bg-[#b91c1c]/5">
                STATE GOVT
                SEAL
              </div>
              <div className="mt-2 text-center text-[#b91c1c] font-bold text-xs uppercase tracking-wider">ಕರ್ನಾಟಕ ಸರ್ಕಾರ</div>
              <div className="text-[9px] text-stone-500 font-bold uppercase tracking-tight">GOVERNMENT OF KARNATAKA</div>
            </div>

            {/* Department Headings */}
            <div className="text-center mt-4 border-b border-stone-300 pb-4">
              <div className="font-bold text-[11px] tracking-wide text-stone-900">DEPARTMENT OF REVENUE & COMPLIANCE</div>
              <div className="text-[8px] text-stone-500 font-sans tracking-wide mt-0.5">Vidhana Soudha, Bengaluru, Karnataka &bull; 560001</div>
            </div>

            {/* Mock Reference block */}
            <div className="flex justify-between mt-6 font-mono text-[8px] text-stone-500 uppercase tracking-wider">
              <div>Ref No: KA-REV-2026/8940</div>
              <div>Date: June 08, 2026</div>
            </div>

            {/* Letter subject line */}
            <div className="mt-6 font-sans font-bold text-[10px] border-l-2 border-stone-800 pl-3 leading-snug">
              Subject: Official Notice Regarding Verification and Modernization of Land Revenue Records for Bengaluru Division
            </div>

            {/* Notice paragraph text body */}
            <div className="mt-5 space-y-3.5 text-[9.5px] leading-relaxed text-stone-700 font-serif pr-2">
              <p>
                In exercise of powers conferred under Section 12-A of the Karnataka Land Revenue Act, the Department hereby issues an expedited advisory requiring the modernization, digital transcription, and indexing of historic paper records into verified electronic schemas.
              </p>
              <p>
                Therefore, all officers are instructed to implement automated spatial coordinate mapping (OCR) engines capable of preserving complex multilingual tabular blocks and seal metadata, ensuring 100% downstream data integrity.
              </p>
            </div>
          </div>

          {/* Signature Block */}
          <div className="mt-8 flex justify-between items-end border-t border-stone-200 pt-4 opacity-80">
            <div>
              <div className="text-[8px] uppercase tracking-widest text-stone-400 font-bold font-sans">Verified By</div>
              <div className="font-mono text-[8px] mt-1 text-indigo-700">SHA256-SIGN-OK//A4B2</div>
            </div>
            <div className="text-right">
              <div className="font-serif italic text-stone-600 font-semibold">S. K. Ramaswamy</div>
              <div className="text-[7.5px] text-stone-500 tracking-tight font-sans mt-0.5">Commissioner of E-Governance & Revenue Records</div>
            </div>
          </div>
        </div>
      );
    } else if (imagePlaceholderType === "invoice") {
      return (
        <div className="relative w-full h-full bg-[#fafcff] border border-blue-100 shadow-inner p-8 overflow-hidden rounded select-none font-sans text-[10px] text-slate-800 leading-normal flex flex-col justify-between" style={{ height: '100%' }}>
          <div>
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20 pointer-events-none" />
            
            {/* Header: Company branding layout */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center font-bold text-white text-xs">APEX</div>
                  <div>
                    <div className="font-bold text-[12px] text-slate-900 tracking-tight">Apex Tech Labs</div>
                    <div className="text-[7.5px] text-slate-400 font-medium">Enterprise Development Solutions</div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded">PAID IN FULL</span>
                <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wider mt-1.5 font-mono">Invoice</h2>
                <div className="text-[7.5px] text-slate-400 font-mono">#INV-2026-4401</div>
              </div>
            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <span className="text-[7.5px] text-indigo-500 font-bold uppercase tracking-wider block">Billed To:</span>
                <div className="font-bold text-slate-900 mt-1">Acme Global Corporation</div>
                <div className="text-slate-500 text-[8.5px] mt-0.5 leading-snug">
                  101 Science Park, Block C-3<br/>
                  Singapore 118256
                </div>
              </div>
              <div className="text-right">
                <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider block">Billing Matrix:</span>
                <div className="text-slate-600 text-[8.5px] mt-1 space-y-0.5">
                  <div><strong>Issued Date:</strong> May 12, 2026</div>
                  <div><strong>Due Date:</strong> Immediate</div>
                  <div><strong>Payment Via:</strong> Wire Transfer</div>
                </div>
              </div>
            </div>

            {/* Tabular Lines List */}
            <div className="mt-6">
              <table className="w-full text-left border-collapse text-[8.5px]">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-slate-400 uppercase tracking-widest text-[7px] font-bold">
                    <th className="py-2">Service Line Items Description</th>
                    <th className="text-right py-2">Hourly Rate</th>
                    <th className="text-right py-2">Hours</th>
                    <th className="text-right py-2">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  <tr>
                    <td className="py-2.5">
                      <strong>Cloud Architecture & Infrastructure Migration</strong>
                      <div className="text-[7px] text-slate-400 mt-0.5">Setup and continuous orchestration of Kubernetes pods</div>
                    </td>
                    <td className="text-right font-mono">$175.00</td>
                    <td className="text-right font-mono">16.5</td>
                    <td className="text-right font-mono font-bold text-slate-800">$2,887.50</td>
                  </tr>
                  <tr>
                    <td className="py-2.5">
                      <strong>Gemini OCR Pipeline Integration & Testing</strong>
                      <div className="text-[7px] text-slate-400 mt-0.5">Deploy automatic schema extraction rules on client receipts</div>
                    </td>
                    <td className="text-right font-mono">$150.00</td>
                    <td className="text-right font-mono">13.0</td>
                    <td className="text-right font-mono font-bold text-slate-800">$1,950.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Calculations summaries */}
            <div className="mt-4 flex justify-end">
              <div className="w-48 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col space-y-1 text-[8.5px] text-slate-500 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal sum:</span>
                  <span className="font-mono">$4,890.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (18%):</span>
                  <span className="font-mono">$880.20</span>
                </div>
                <div className="flex justify-between font-bold text-blue-700 text-[10px] pt-1 border-t border-slate-200 mt-2">
                  <span>Total Due:</span>
                  <span className="font-mono">$5,770.20</span>
                </div>
              </div>
            </div>
            
          </div>
          
          <div className="w-full text-center text-[7px] text-stone-400 font-sans border-t pt-2 border-stone-100 mt-2">
            Apex Tech Labs - Seattle / Singapore / Bangalore
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg h-full">
      {/* Sidebar / View Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-indigo-50 rounded-lg text-indigo-600">
            <ScanLine className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider animate-[pulse_3s_infinite]">Original Scan</span>
        </div>
        <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> OCR COMPLETED
        </div>
      </div>

      {/* Uploaded image tools bar */}
      {originalImage && onUpdateImage && !isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-100/90 border-b border-slate-200 text-xs shadow-inner shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-slate-400 font-sans uppercase tracking-wider">Original Tools:</span>
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/60 shadow-sm">
            <button
              onClick={() => handleRotateImage('ccw')}
              className="px-2 py-1 hover:text-indigo-600 hover:bg-slate-50 rounded text-slate-600 font-semibold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Rotate 90° Counter-Clockwise"
            >
              <RotateCcw className="w-3 h-3 text-indigo-500" />
              Rotate L
            </button>
            <button
              onClick={() => handleRotateImage('cw')}
              className="px-2 py-1 hover:text-indigo-600 hover:bg-slate-50 rounded text-slate-600 font-semibold text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Rotate 90° Clockwise"
            >
              <RotateCw className="w-3 h-3 text-indigo-500" />
              Rotate R
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            
            {isCropMode ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleApplyCrop}
                  className="px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                  title="Apply Crop Selection"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Crop
                </button>
                <button
                  onClick={() => setIsCropMode(false)}
                  className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                  title="Cancel crop selection"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCropMode(true)}
                className="px-2.5 py-1 text-indigo-600 hover:bg-indigo-50/50 rounded font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                title="Crop image area"
              >
                <Crop className="w-3.5 h-3.5 text-indigo-500" />
                Crop Image
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Original Canvas Wrapper */}
      <div className="relative p-4 flex-1 flex flex-col justify-center items-center bg-slate-100/60 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-20 text-slate-500">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold tracking-wider text-slate-700">Processing Chnada OCR Layout Analysis...</p>
            <p className="text-[11px] text-slate-400">Converting pixels to structured bounding blocks...</p>
          </div>
        ) : (
          <div ref={documentContainerRef} className="relative w-full max-w-[800px]" style={{ aspectRatio: `800/${1050 * pageCount}`, transition: 'all 0.2s' }}>
            {/* The Document Surface */}
            <div className="absolute inset-0 bg-[#fdfdf7] rounded border border-slate-200 overflow-hidden shadow-lg select-none">
              {originalImage ? (
                <img
                  src={originalImage}
                  alt="Original Scanned Document"
                  className="w-full h-full object-fill animate-[fadeIn_0.5s_ease-out]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                renderScannedPaperMock()
              )}
            </div>

            {/* Cropping Selection drag overlay */}
            {isCropMode && originalImage && (
              <div className="absolute inset-0 z-30 select-none bg-black/55 cursor-default">
                <div 
                  className="absolute border-2 border-indigo-500 bg-indigo-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] cursor-move"
                  style={{
                    left: `${cropBox.x}%`,
                    top: `${cropBox.y}%`,
                    width: `${cropBox.w}%`,
                    height: `${cropBox.h}%`
                  }}
                  onMouseDown={(e) => handleCropMouseDown(e, 'move')}
                >
                  {/* Handle Label info */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white font-sans font-bold text-[9px] px-2 py-1 rounded shadow tracking-wider whitespace-nowrap pointer-events-none scale-90">
                    DRAG TO MOVE / CORNERS TO RESIZE
                  </div>

                  {/* Top-Left handle */}
                  <div 
                    className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize z-40"
                    onMouseDown={(e) => handleCropMouseDown(e, 'tl')}
                  />
                  {/* Top-Right handle */}
                  <div 
                    className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize z-40"
                    onMouseDown={(e) => handleCropMouseDown(e, 'tr')}
                  />
                  {/* Bottom-Left handle */}
                  <div 
                    className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-white rounded-full cursor-nesw-resize z-40"
                    onMouseDown={(e) => handleCropMouseDown(e, 'bl')}
                  />
                  {/* Bottom-Right handle */}
                  <div 
                    className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-white rounded-full cursor-nwse-resize z-40"
                    onMouseDown={(e) => handleCropMouseDown(e, 'br')}
                  />
                </div>
              </div>
            )}

            {/* Translucent Bounding Overlay Map of OCR Blocks */}
            {!isCropMode && (
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full pointer-events-auto"
                viewBox={`0 0 800 ${1050 * pageCount}`}
                xmlns="http://www.w3.org/2000/svg"
              >
                {elements.map((el) => {
                  const isSelected = selectedElementId === el.id;
                  
                  // Color mapping for bounding box categories
                  let boxStroke = "rgba(79, 70, 229, 0.4)"; // indigo
                  let boxFill = "rgba(79, 70, 229, 0.03)";
                  if (el.type === "heading") {
                    boxStroke = "rgba(239, 68, 68, 0.45)"; // red
                    boxFill = "rgba(239, 68, 68, 0.03)";
                  } else if (el.type === "divider") {
                    boxStroke = "rgba(16, 185, 129, 0.45)"; // emerald
                    boxFill = "rgba(16, 185, 129, 0.03)";
                  } else if (el.type === "image") {
                    boxStroke = "rgba(245, 158, 11, 0.45)"; // amber
                    boxFill = "rgba(245, 158, 11, 0.03)";
                  }

                  if (isSelected) {
                    boxStroke = "rgba(79, 70, 229, 1)"; // solid Indio accent selection line
                    boxFill = "rgba(79, 70, 229, 0.12)";
                  }

                  return (
                    <g key={`overlay-${el.id}`} className="group cursor-pointer">
                      {/* Bounding box rect */}
                      <rect
                        x={el.x}
                        y={el.y}
                        width={el.width}
                        height={el.height}
                        fill={boxFill}
                        stroke={boxStroke}
                        strokeWidth={isSelected ? 2.5 : 1}
                        strokeDasharray={el.type === "image" ? "4 4" : "none"}
                        className={`transition-colors duration-150 group-hover:fill-indigo-500/10 group-hover:stroke-indigo-600/80 ${onUpdateElement ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                        onClick={() => onSelectElement(el.id)}
                        onMouseDown={(e) => handleDragStart(e, el)}
                      />
                      
                      {/* Type overlay label on hover or search */}
                      <rect
                        x={el.x}
                        y={Math.max(0, el.y - 14)}
                        width={48}
                        height={13}
                        fill={isSelected ? "#4f46e5" : "#1e293b"}
                        rx="2"
                        className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      />
                      <text
                        x={el.x + 4}
                        y={Math.max(0, el.y - 4)}
                        fill="#ffffff"
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="monospace"
                        className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      >
                        {el.type.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Info indicator panel */}
      <div className="bg-slate-50 border-t border-slate-200 py-2.5 text-[11px] font-sans font-medium text-slate-500 flex justify-between items-center px-4 shrink-0">
        <span className="flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-500" />
          Click bounding zones to pair and trace
        </span>
        <span className="font-semibold text-slate-600">Total elements: {elements.length}</span>
      </div>
    </div>
  );
};
