import React, { useState, useCallback, useEffect } from "react";
import { SAMPLE_DOCUMENTS } from "./data/samples";
import { DocumentElement } from "./types";
import { DocumentViewer } from "./components/DocumentViewer";
import { EditableCanvas } from "./components/EditableCanvas";
import {
  exportToPDF,
  exportToWord,
  exportToTXT,
  exportToHTML,
  exportToJSON,
  exportToCSV
} from "./utils/exportHelpers";
import {
  UploadCloud,
  RefreshCw,
  Sparkles,
  Download,
  FileDigit,
  Trash2,
  Sliders,
  Maximize2,
  AlertCircle
} from "lucide-react";

export default function App() {
  // Preset or Custom Document State
  const [selectedSampleIndex, setSelectedSampleIndex] = useState<number>(1);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  
  // OCR processing states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [languageHint] = useState<string>("English Only");

  // Document Elements state
  const [elements, setElements] = useState<DocumentElement[]>(
    SAMPLE_DOCUMENTS[1].layout.elements
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Document height page scaling state (liberty to extend layout to another page)
  const [pageCount, setPageCount] = useState<number>(1);

  // Split Workspace width state (adjustable panels from 25% to 75%)
  const [splitRatio, setSplitRatio] = useState<number>(50);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isWideScreen, setIsWideScreen] = useState<boolean>(true);

  // Viewport resize tracking to activate flex spacing on wide screens
  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1285); // 1280px is xl
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Split Ratio dragging mouse event listener loop
  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const percent = (e.clientX / window.innerWidth) * 100;
      setSplitRatio(Math.max(25, Math.min(75, percent)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [isResizing]);

  // Load a preset template
  const handleLoadPreset = (index: number) => {
    setSelectedSampleIndex(index);
    setIsCustomMode(false);
    setCustomImage(null);
    setElements(SAMPLE_DOCUMENTS[index].layout.elements);
    setSelectedElementId(null);
    setErrorMessage(null);
    setPageCount(1); // Reset page counts for raw preset loaded
  };

  // Convert uploaded image file to absolute base64 string
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setCustomImage(b64);
      setIsCustomMode(true);
      setErrorMessage(null);
      
      // Auto-set the workspace height / pageCount based on the uploaded image's aspect ratio
      const img = new Image();
      img.src = b64;
      img.onload = () => {
        const ar = img.height / img.width; // standard A4 aspect ratio is ~1.31
        const autoPageCount = Math.max(1, Math.min(3, Math.round(ar / 1.3)));
        setPageCount(autoPageCount);
      };

      // Trigger instant processing
      triggerOCR(b64);
    };
    reader.readAsDataURL(file);
  };

  // Trigger Gemini-powered OCR structure API
  const triggerOCR = async (imageB64: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedElementId(null);
    
    try {
      const response = await fetch("/api/process-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageB64,
          languageHint: languageHint
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error code ${response.status}`);
      }

      const data = await response.json();
      
      if (data.elements && Array.isArray(data.elements)) {
        setElements(data.elements);
        // Automatically adjust page layout tallerness if returned document has high height!
        if (data.height) {
          const calculatedPageCount = Math.max(1, Math.min(3, Math.round(data.height / 1050)));
          setPageCount(calculatedPageCount);
        }
      } else {
        throw new Error("Invalid document representation returned from OCR engine.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || "Failed to process the document coordinates. Please verify your connection to the backend."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Callback to update text styles or positioning values
  const handleUpdateElement = useCallback((id: string, updatedFields: Partial<DocumentElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...updatedFields } : el))
    );
  }, []);

  // Delete an elements block
  const handleDeleteElement = useCallback((id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
    setSelectedElementId(null);
  }, []);

  // Add custom element
  const handleAddElement = useCallback((type: 'text' | 'heading' | 'divider' | 'image') => {
    const newId = `custom_block_${Date.now()}`;
    const newEl: DocumentElement = {
      id: newId,
      type,
      content: type === 'heading' ? "Custom Heading Label" :
               type === 'image' ? "Brand Logo Placeholder" :
               type === 'divider' ? "" : "Enter your digital paragraph notes here.",
      x: 180,
      y: 120, // upper bounding box zone
      width: 440,
      height: type === 'divider' ? 4 : 80,
      fontSize: type === 'heading' ? 22 : 13,
      fontWeight: type === 'heading' ? 'bold' : 'normal',
      fontStyle: 'normal',
      color: '#0f172a',
      fontFamily: 'Inter',
      alignment: 'left'
    };

    setElements((prev) => [...prev, newEl]);
    setSelectedElementId(newId);
  }, []);

  // Reset workspace
  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to clear all layout blocks?")) {
      setElements([]);
      setSelectedElementId(null);
    }
  };

  // Re-run OCR analysis on current custom image
  const handleRerunOCR = () => {
    if (customImage) {
      triggerOCR(customImage);
    }
  };

  // Exports Dispatcher
  const handleExport = (format: 'pdf' | 'doc' | 'txt' | 'html' | 'json' | 'csv') => {
    const filename = `chnada-ocr-document.${format === 'doc' ? 'doc' : format}`;
    switch (format) {
      case 'pdf':
        exportToPDF(elements, 800, 1050 * pageCount, filename, pageCount);
        break;
      case 'doc':
        exportToWord(elements, filename);
        break;
      case 'txt':
        exportToTXT(elements, filename);
        break;
      case 'html':
        exportToHTML(elements, 800, 1050 * pageCount, filename, pageCount);
        break;
      case 'json':
        exportToJSON({ width: 800, height: 1050 * pageCount, elements }, filename);
        break;
      case 'csv':
        exportToCSV(elements, filename);
        break;
    }
  };

  return (
    <div className="bg-[#f1f5f9] min-h-screen text-slate-900 flex flex-col font-sans select-none antialiased">
      
      {/* 🚀 Top Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm shrink-0">
        
        {/* Title branding block */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
            <FileDigit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">
              Chnada OCR
            </h1>
            <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
              Advanced Document Reconstruction
            </p>
          </div>
        </div>

        {/* Global actions bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Main Preset selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">Library Presets:</span>
            <div className="flex bg-slate-100 p-1.5 rounded-full border border-slate-200/50 shadow-inner">
              {SAMPLE_DOCUMENTS.filter(doc => doc.language !== "Kannada & English").map((doc) => {
                const idx = SAMPLE_DOCUMENTS.indexOf(doc);
                return (
                  <button
                    key={doc.name}
                    onClick={() => handleLoadPreset(idx)}
                    className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
                      !isCustomMode && selectedSampleIndex === idx
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200/50"
                        : "text-slate-500 hover:text-slate-700 font-medium"
                    }`}
                  >
                    {doc.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clean separation */}
          <div className="h-5 w-px bg-slate-200 hidden md:block" />

          {/* Custom OCR Uploader button config */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg text-indigo-700 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              ENGLISH ONLY
            </div>

            <label className="bg-indigo-600 hover:bg-indigo-700 text-[#ffffff] font-semibold hover:shadow-indigo-100 hover:shadow-lg hover:scale-[1.01] text-xs px-4 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer transition-all border border-indigo-700/20 shadow-sm">
              <UploadCloud className="w-4 h-4" />
              Upload Image Document
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>

        </div>
      </header>

      {/* ⚠️ Dynamic Notifications Alerts */}
      {errorMessage && (
        <div className="mx-6 mt-4 p-3.5 bg-red-500/10 border border-red-500/20 text-red-700 rounded-lg text-xs flex items-start gap-2.5 font-mono">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold">OCR Pipeline Error:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* 🧭 Main Interactive Sub-Header & Export Options */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs shadow-sm shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-500 font-sans">
          <span className="flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            {isCustomMode ? (
              <span className="text-indigo-600 font-bold">Custom Document Loaded!</span>
            ) : (
              <span>Template: <strong className="text-slate-800">{SAMPLE_DOCUMENTS[selectedSampleIndex].description}</strong></span>
            )}
          </span>
          <div className="flex items-center gap-1.5 bg-indigo-55/10 border border-indigo-100 px-2 py-0.5 rounded text-[11px] font-semibold text-indigo-700 font-sans">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            Panels Drag-Resizable Ratio: {Math.round(splitRatio)}% : {100 - Math.round(splitRatio)}%
          </div>
        </div>

        {/* 📚 Download buttons container */}
        <div className="flex flex-wrap items-center gap-2 font-sans">
          <div className="flex items-center gap-1.5 mr-2">
            <button
              onClick={() => setSplitRatio(50)}
              className="px-2 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded text-[11px] font-semibold flex items-center gap-1 transition-all"
              title="Reset workspace panels to perfect 50:50 equal proportions"
            >
              <Maximize2 className="w-3 h-3 text-slate-450" />
              Reset Widths (50:50)
            </button>
          </div>

          {isCustomMode && (
            <button
              onClick={handleRerunOCR}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-50 text-xs font-semibold shadow-sm"
              title="Rerun layout parsing algorithm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Re-scan Layout
            </button>
          )}

          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50/5 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
            title="Clear current elements layout"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1 font-semibold">
            <Download className="w-3.5 h-3.5 text-indigo-500" /> Export format:
          </span>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => handleExport('pdf')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-md text-[11px] transition-colors shadow-sm cursor-pointer"
              title="Download high fidelity PDF"
            >
              PDF
            </button>
            <button
              onClick={() => handleExport('doc')}
              className="bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 px-3 py-1.5 rounded-md text-[11px] transition-colors hover:bg-slate-50 font-semibold shadow-sm cursor-pointer"
              title="Download Word Document structure"
            >
              Word
            </button>
            <button
              onClick={() => handleExport('html')}
              className="bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 px-3 py-1.5 rounded-md text-[11px] transition-colors hover:bg-slate-50 font-semibold shadow-sm cursor-pointer"
              title="Download responsive absolute HTML layout"
            >
              HTML
            </button>
            <button
              onClick={() => handleExport('txt')}
              className="bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 px-3 py-1.5 rounded-md text-[11px] transition-colors hover:bg-slate-50 font-semibold shadow-sm cursor-pointer"
              title="Download standard text sequence"
            >
              TXT
            </button>
            <button
              onClick={() => handleExport('json')}
              className="bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 px-3 py-1.5 rounded-md text-[11px] transition-colors hover:bg-slate-50 font-semibold shadow-sm cursor-pointer"
              title="Download layout metadata JSON"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 px-3 py-1.5 rounded-md text-[11px] transition-colors hover:bg-slate-50 font-semibold shadow-sm cursor-pointer"
              title="Download elements table spreadsheet"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* 💻 Dual side workspace layout */}
      <main className="flex-1 p-6 flex flex-col xl:flex-row gap-5 min-h-0 overflow-hidden">
        
        {/* Left Side: Original Scanning Document */}
        <div 
          className="h-full min-h-[350px] xl:min-h-0 flex flex-col overflow-hidden"
          style={{ 
            width: isWideScreen ? 'auto' : '100%', 
            flex: isWideScreen ? `0 0 ${splitRatio}%` : '1 1 auto' 
          }}
        >
          <DocumentViewer
            originalImage={customImage}
            imagePlaceholderType={isCustomMode ? "custom" : SAMPLE_DOCUMENTS[selectedSampleIndex].imagePlaceholder}
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => setSelectedElementId(id)}
            isLoading={isLoading}
            onUpdateElement={handleUpdateElement}
            onUpdateImage={(newB64) => setCustomImage(newB64)}
            pageCount={pageCount}
          />
        </div>

        {/* Interactive Resize Splitter bar (Visible on wide panels screen sizes) */}
        <div 
          className="hidden xl:flex flex-col items-center justify-center w-2 hover:w-3 cursor-col-resize self-stretch transition-all bg-slate-200 hover:bg-indigo-400 group select-none active:bg-indigo-600 rounded-full shrink-0"
          onMouseDown={handleSplitterMouseDown}
          title="Drag left or right to change panels widths interactively"
        >
          <div className="flex flex-col gap-1 text-slate-400 group-hover:text-white font-bold text-[8px] leading-tight select-none pointer-events-none">
            <span>&bull;</span>
            <span>&bull;</span>
            <span>&bull;</span>
          </div>
        </div>

        {/* Right Side: Reconstructed Editable Layout Workspace */}
        <div 
          className="h-full min-h-[400px] xl:min-h-0 flex flex-col overflow-hidden flex-grow"
          style={{ 
            width: isWideScreen ? 'auto' : '100%', 
            flex: isWideScreen ? `0 0 ${100 - splitRatio}%` : '1 1 auto' 
          }}
        >
          <EditableCanvas
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => setSelectedElementId(id)}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onAddElement={handleAddElement}
            originalImage={customImage}
            isLoading={isLoading}
            pageCount={pageCount}
            onUpdatePageCount={setPageCount}
          />
        </div>

      </main>

      {/* 🗺️ Professional Informative Bottom Status bar */}
      <footer className="bg-slate-800 border-t border-slate-700 px-6 py-3 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-300 font-sans font-semibold tracking-wide shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>System Active &bull; Chnada OCR running on Gemini Node</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 font-medium">
          <span>Responsive scaling active &bull; Page Grid height: {1050 * pageCount}px</span>
          <span>A4 Aspect Ratio: 1 : {1.3125 * pageCount}</span>
        </div>
      </footer>

    </div>
  );
}
