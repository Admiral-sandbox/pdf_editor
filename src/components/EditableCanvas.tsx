import React, { useRef, useState, useEffect } from "react";
import { DocumentElement } from "../types";
import { Move, Settings, Type as TypeIcon, HelpCircle, LayoutGrid, Plus, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Trash2 } from "lucide-react";

interface EditableCanvasProps {
  elements: DocumentElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, updatedFields: Partial<DocumentElement>) => void;
  onDeleteElement: (id: string) => void;
  onAddElement: (type: 'text' | 'heading' | 'divider' | 'image') => void;
  originalImage?: string | null;
  isLoading?: boolean;
  pageCount?: number;
  onUpdatePageCount?: (count: number) => void;
}

export const EditableCanvas: React.FC<EditableCanvasProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onAddElement,
  originalImage = null,
  isLoading = false,
  pageCount = 1,
  onUpdatePageCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<'flow' | 'absolute'>('absolute');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  // Dynamic scaling observer to maintain perfect proportions at any zoom or screen size
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.getBoundingClientRect().width;
        setScale(width / gridWidth);
      }
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [layoutMode, pageCount]);

  // Grid width is 800px, height is 1050px per page
  const gridWidth = 800;
  const gridHeightPerPage = 1050;
  const gridHeight = gridHeightPerPage * pageCount;

  // Handle Drag Start
  const handleDragStart = (e: React.MouseEvent, el: DocumentElement) => {
    e.stopPropagation();
    onSelectElement(el.id);
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = gridWidth / rect.width;
      const scaleY = gridHeight / rect.height;
      
      // Calculate mouse position in grid coordinates
      const mouseXGrid = (e.clientX - rect.left) * scaleX;
      const mouseYGrid = (e.clientY - rect.top) * scaleY;
      
      setDragOffset({
        x: mouseXGrid - el.x,
        y: mouseYGrid - el.y
      });
      setActiveDragId(el.id);
    }
  };

  // Handle Drag Move (Global mouse listners)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDragId || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = gridWidth / rect.width;
      const scaleY = gridHeight / rect.height;
      
      // Compute raw position in grid coordinates
      const mouseXGrid = (e.clientX - rect.left) * scaleX;
      const mouseYGrid = (e.clientY - rect.top) * scaleY;
      
      let newX = Math.round(mouseXGrid - dragOffset.x);
      let newY = Math.round(mouseYGrid - dragOffset.y);
      
      // Snapping to bounds (0, screen limits)
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

  const selectedEl = elements.find(el => el.id === selectedElementId);

  // Logical reading order sorting for Flow Layout mode: sorts primarily by top-to-bottom (Y), then horizontal (X)
  const sortedElements = [...elements].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 15) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* Dynamic Grid Reconstructed Workspace Pane */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg">
        {/* Workspace Toolbar Header */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="p-1 bg-indigo-50 rounded-lg text-indigo-600">
              <LayoutGrid className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Digital Edit</span>
            
            {/* Layout Mode Selector Switch */}
            <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/35">
              <button
                onClick={() => {
                  setLayoutMode('flow');
                  onSelectElement(null);
                }}
                className={`text-[10px] px-3 py-1 rounded-md transition-all font-bold uppercase tracking-wider cursor-pointer ${
                  layoutMode === 'flow'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Structured word processor flowing layout (Guaranteed no overlaps)"
              >
                Reflow
              </button>
              <button
                onClick={() => {
                  setLayoutMode('absolute');
                  onSelectElement(null);
                }}
                className={`text-[10px] px-3 py-1 rounded-md transition-all font-bold uppercase tracking-wider cursor-pointer ${
                  layoutMode === 'absolute'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Exact spatial pixel coordinate canvas layout (Drag & Drop)"
              >
                Canvas
              </button>
            </div>

            {/* Quick multi-page sizing controls (Absolute Mode Only) */}
            {layoutMode === 'absolute' && onUpdatePageCount && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                <span className="text-[10px] font-bold text-slate-400 font-sans uppercase tracking-wider">Pages:</span>
                <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/35">
                  {[1, 2, 3].map((p) => (
                    <button
                      key={`page-btn-${p}`}
                      onClick={() => {
                        onUpdatePageCount(p);
                        onSelectElement(null);
                      }}
                      className={`text-[9px] px-2 py-0.5 rounded-md transition-all font-bold cursor-pointer ${
                        pageCount === p
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title={`Extend document tallness to ${p} pages`}
                    >
                      {p} {p === 1 ? 'Page' : 'Pages'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Add quick objects tools */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-full border border-slate-200/50 shadow-inner">
            <button
              onClick={() => onAddElement('heading')}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1 bg-white hover:bg-slate-50 rounded-full flex items-center gap-1 transition-all shadow-sm border border-slate-200/50 hover:scale-105 cursor-pointer"
              title="Add a heading node"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" /> Heading
            </button>
            <button
              onClick={() => onAddElement('text')}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1 bg-white hover:bg-slate-50 rounded-full flex items-center gap-1 transition-all shadow-sm border border-slate-200/50 hover:scale-105 cursor-pointer"
              title="Add text paragraph"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" /> Text
            </button>
            <button
              onClick={() => onAddElement('divider')}
              className="text-xs font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1 bg-white hover:bg-slate-50 rounded-full flex items-center gap-1 transition-all shadow-sm border border-slate-200/50 hover:scale-105 cursor-pointer"
              title="Add separator divider"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" /> Line
            </button>
          </div>
        </div>

        {/* The Reconstructed Canvas Workspace */}
        <div className="relative p-6 flex-1 flex flex-col justify-start items-center bg-slate-100/60 overflow-y-auto min-h-0">
          {isLoading ? (
            /* BEAUTIFUL SKELETON LOADER SCREEN FOR RECONSTRUCTION ENGINE */
            <div 
              className="relative bg-white shadow-2xl rounded-xl text-slate-400 border border-slate-200 p-8 md:p-12 text-left w-full select-none overflow-hidden"
              style={{ maxWidth: '800px', minHeight: '945px', transition: 'all 0.2s' }}
            >
              {/* Laser line scanning sweep animation */}
              <div className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-600 to-transparent shadow-lg shadow-indigo-400 animate-[bounce_2s_infinite] pointer-events-none" style={{ top: '30%' }} />
              
              <div className="space-y-6">
                <div className="h-8 bg-slate-100 rounded-lg w-1/3 animate-pulse" />
                <div className="h-4 bg-slate-100 rounded w-1/4 animate-pulse" />
                <div className="h-px bg-slate-200 w-full my-6" />
                <div className="space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse" style={{ animationDelay: '0.1s' }} />
                  <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
                <div className="space-y-3 pt-4">
                  <div className="h-4 bg-slate-100 rounded w-11/12 animate-pulse" style={{ animationDelay: '0.4s' }} />
                  <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" style={{ animationDelay: '0.5s' }} />
                </div>
              </div>
            </div>
          ) : layoutMode === 'flow' ? (
            /* FLOW RENDERING MODE: Beautiful Reflowing Word Processor Sheet */
            <div 
              className="relative bg-white shadow-2xl rounded-xl text-slate-900 border border-slate-200 p-8 md:p-12 text-left w-full cursor-default select-text"
              style={{ maxWidth: '800px', minHeight: '945px', transition: 'all 0.2s' }}
            >
              <div className="absolute top-2 right-4 text-[9px] text-slate-300 font-mono tracking-widest uppercase">Digital Word Editor</div>
              
              {sortedElements.length === 0 ? (
                <div className="py-20 text-center text-slate-350">
                  <div className="text-4xl mb-4">✍️</div>
                  <p className="text-sm font-semibold text-slate-400">Workspace document is empty.</p>
                  <p className="text-xs text-slate-300 mt-1">Use the quick add tool shortcuts above to generate nodes.</p>
                </div>
              ) : (
                sortedElements.map((el) => {
                  const isSelected = selectedElementId === el.id;
                  
                  let elementStyles: React.CSSProperties = {
                    fontSize: `${el.fontSize || 14}px`,
                    fontWeight: el.fontWeight || 'normal',
                    fontStyle: el.fontStyle || 'normal',
                    color: el.color || '#090d16',
                    textAlign: el.alignment || 'left',
                    fontFamily: el.fontFamily === 'Space Grotesk' ? '"Space Grotesk", sans-serif' :
                                el.fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' :
                                '"Inter", sans-serif',
                    marginBottom: el.type === 'heading' ? '20px' : '15px'
                  };

                  if (el.type === 'heading') {
                    elementStyles = {
                      ...elementStyles,
                      lineHeight: '1.25',
                      letterSpacing: '-0.025em'
                    };
                  }

                  return (
                    <div
                      key={`flow-${el.id}`}
                      style={elementStyles}
                      onClick={() => onSelectElement(el.id)}
                      className={`p-2.5 rounded transition-all duration-150 cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-50/70 border border-indigo-200 shadow-sm' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      {el.type === 'divider' ? (
                        <div className="border-t-2 my-2" style={{ borderColor: el.color || '#cbd5e1' }} />
                      ) : el.type === 'heading' ? (
                        <h1 className="font-bold">{el.content}</h1>
                      ) : el.type === 'image' ? (
                        <div className="bg-slate-100 rounded p-4 text-center text-xs font-mono font-bold text-slate-500 border border-slate-200">
                          🖼️ IMAGE SECTION: {el.content}
                        </div>
                      ) : (
                        <div className="leading-relaxed">
                          {el.content}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* ABSOLUTE CANVAS MODE: Pixel-Perfect Drag and Drop spatial design */
            <div 
              ref={containerRef}
              className="relative bg-white shadow-xl rounded text-slate-900 overflow-hidden select-none border border-slate-200"
              style={{ width: '100%', maxWidth: '800px', aspectRatio: `800/${1050 * pageCount}`, transition: 'all 0.2s' }}
              onClick={() => onSelectElement(null)} // click off to de-select
            >
              {/* Soft grid background helper to guide document design */}
              <div className="absolute inset-0 bg-grid-pattern opacity-[0.06] pointer-events-none" />

              {/* Page Break dashed indicators */}
              {Array.from({ length: pageCount - 1 }).map((_, index) => {
                const foldYPct = (((index + 1) * 1050) / gridHeight) * 100;
                return (
                  <div 
                    key={`page-break-${index}`}
                    className="absolute left-0 w-full border-t-2 border-dashed border-indigo-400 select-none pointer-events-none z-20 flex items-center justify-center h-px" 
                    style={{ top: `${foldYPct}%` }}
                  >
                    <span className="bg-indigo-600 text-white font-mono font-bold text-[8px] px-2.5 py-0.5 rounded-full shadow -translate-y-1/2 tracking-wider whitespace-nowrap">
                      ✂️ PAGE {index + 1} / PAGE {index + 2} BOUNDARY BREAK
                    </span>
                  </div>
                );
              })}

              {/* Render each style/text element absolute */}
              {elements.map((el) => {
                const isSelected = selectedElementId === el.id;
                
                const pctLeft = (el.x / gridWidth) * 100;
                const pctTop = (el.y / gridHeight) * 100;
                const pctWidth = (el.width / gridWidth) * 100;
                const pctHeight = (el.height / gridHeight) * 100;

                // Setup styled fonts
                let fontStyles: React.CSSProperties = {
                  position: 'absolute',
                  left: `${pctLeft}%`,
                  top: `${pctTop}%`,
                  width: `${pctWidth}%`,
                  minHeight: el.type === 'image' || el.type === 'divider' ? `${pctHeight}%` : undefined,
                  height: el.type === 'image' || el.type === 'divider' ? `${pctHeight}%` : 'auto',
                  fontSize: `${(el.fontSize || 14) * scale}px`,
                  fontWeight: el.fontWeight || 'normal',
                  fontStyle: el.fontStyle || 'normal',
                  color: el.color || '#090d16',
                  textAlign: el.alignment || 'left',
                  boxSizing: 'border-box',
                  whiteSpace: 'pre-wrap',
                  fontFamily: el.fontFamily === 'Space Grotesk' ? '"Space Grotesk", sans-serif' :
                              el.fontFamily === 'JetBrains Mono' ? '"JetBrains Mono", monospace' :
                              '"Inter", sans-serif'
                };

                if (el.type === 'divider') {
                  fontStyles = {
                    ...fontStyles,
                    borderTop: `${(el.height > 2 ? el.height / 2 : 1.5) * scale}px solid ${el.color || '#e2e8f0'}`
                  };
                }

                return (
                  <div
                    key={el.id}
                    style={fontStyles}
                    onMouseDown={(e) => handleDragStart(e, el)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement(el.id);
                    }}
                    className={`group transition-all duration-100 cursor-grab active:cursor-grabbing ${
                      isSelected 
                        ? 'ring-2 ring-indigo-500 shadow-md bg-indigo-50/10 z-35' 
                        : 'hover:ring-1 hover:ring-indigo-350 hover:bg-indigo-500/5 z-10'
                    }`}
                  >
                    {/* Floating helpful drag badge overlay shown on hover */}
                    <div 
                      className="absolute -top-3.5 -left-1 text-white bg-indigo-600 rounded px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wider select-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center gap-1 shadow-sm"
                    >
                      <Move className="w-2.5 h-2.5" />
                      DRAG
                    </div>

                    {/* Render content depending on item category */}
                    {el.type === 'image' ? (
                      originalImage ? (
                        <div className="w-full h-full min-h-[40px] relative overflow-hidden rounded border border-slate-250 bg-[#fdfdf7] shadow-inner">
                          <img 
                            src={originalImage} 
                            alt={el.content}
                            className="absolute max-w-none max-h-none pointer-events-none"
                            style={{
                              width: `${(800 / el.width) * 100}%`,
                              height: `${(gridHeight / el.height) * 100}%`,
                              left: `${-((el.x / el.width) * 100)}%`,
                              top: `${-((el.y / el.height) * 100)}%`,
                            }}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        el.id === "inv_brand_logo" ? (
                          <div className="w-full h-full bg-slate-200 rounded flex flex-col items-center justify-center font-bold text-center border border-slate-300 text-slate-800 leading-none" style={{ fontSize: `${10 * scale}px`, padding: `${2 * scale}px` }}>
                            <span className="font-sans">APEX</span>
                            <span className="font-sans text-[7px]" style={{ fontSize: `${7 * scale}px` }}>LABS</span>
                          </div>
                        ) : el.id === "header_logo" ? (
                          <div className="w-full h-full border-2 border-red-700 rounded-full flex flex-col items-center justify-center font-bold text-red-700 text-center leading-none bg-red-500/5" style={{ fontSize: `${8 * scale}px`, padding: `${2 * scale}px` }}>
                            <span className="scale-[0.8]" style={{ transform: `scale(${scale * 0.8})` }}>ರಾಜಮುದ್ರೆ</span>
                            <span className="text-[6px]" style={{ fontSize: `${6 * scale}px` }}>SEAL</span>
                          </div>
                        ) : (
                          <div className="w-full h-full min-h-[40px] border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-2 rounded text-slate-500 overflow-hidden">
                            <div className="w-6 h-6 rounded bg-slate-200 flex items-center justify-center text-slate-400 mb-1">🖼️</div>
                            <span className="text-[9px] font-mono font-medium text-center truncate w-full">{el.content}</span>
                          </div>
                        )
                      )
                    ) : el.type === 'divider' ? (
                      <div className="w-full h-full pointer-events-none" />
                    ) : (
                      <div className="w-full h-full outline-none leading-relaxed p-0.5">
                        {el.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tip panel */}
        <div className="bg-slate-50 border-t border-slate-200 py-3 text-[11px] font-sans font-semibold text-slate-500 flex justify-between items-center px-4 shrink-0">
          {layoutMode === 'flow' ? (
            <span className="flex items-center gap-1.5 text-indigo-600 font-bold">
              <span className="inline-flex w-2 h-2 rounded-full bg-emerald-500 animate-[ping_2s_infinite]"></span>
              Reflow is active: paragraphs flow cleanly automatically (ideal for reading sequence edits).
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-indigo-600 font-bold animate-[pulse_3s_infinite]">
              <Move className="w-3.5 h-3.5 text-indigo-650" />
              Canvas is active: drag boxes vertical/horizontal across {pageCount} pages.
            </span>
          )}
          <span className="font-semibold text-slate-400 hidden md:inline">Grid: 800 x {1050 * pageCount} px</span>
        </div>
      </div>

      {/* Style & Detail Inspector Sidebar */}
      <div className="w-full lg:w-80 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg p-5 shrink-0">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-200">
          <Settings className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-700 font-sans uppercase tracking-wide">Inspector</h3>
        </div>

        {selectedEl ? (
          <div className="space-y-4 flex-grow overflow-y-auto pr-1">
            {/* Quick remove action */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans">SELECTED: {selectedEl.type.toUpperCase()}</span>
              <button
                onClick={() => onDeleteElement(selectedEl.id)}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50/50 border border-red-200 bg-white px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-semibold transition-all shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>

            {/* Text Area Content Editor for non-dividers */}
            {selectedEl.type !== 'divider' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 font-sans">Content Text Editor</label>
                <textarea
                  value={selectedEl.content}
                  onChange={(e) => onUpdateElement(selectedEl.id, { content: e.target.value })}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 outline-none text-slate-800 text-xs p-2.5 rounded-lg leading-relaxed transition-all resize-y shadow-inner font-sans"
                  placeholder="Enter text content here..."
                />
              </div>
            )}

            {/* Text styles configurations */}
            {(selectedEl.type === 'heading' || selectedEl.type === 'text') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {/* Font Size slider */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 font-sans">Font Size ({selectedEl.fontSize || 14}px)</label>
                    <input
                      type="range"
                      min={8}
                      max={64}
                      value={selectedEl.fontSize || 14}
                      onChange={(e) => onUpdateElement(selectedEl.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  
                  {/* Text Color HEX */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 font-sans">Style Color</label>
                    <div className="flex gap-1.5">
                      <input
                        type="color"
                        value={selectedEl.color || '#000000'}
                        onChange={(e) => onUpdateElement(selectedEl.id, { color: e.target.value })}
                        className="w-8 h-7 bg-transparent border border-slate-200 rounded cursor-pointer outline-none shadow-sm"
                      />
                      <input
                        type="text"
                        value={selectedEl.color || ''}
                        onChange={(e) => onUpdateElement(selectedEl.id, { color: e.target.value })}
                        placeholder="#000000"
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold px-2 py-1 rounded outline-none focus:ring-1 ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Typography Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 font-sans">Font Family Typeface</label>
                  <select
                    value={selectedEl.fontFamily || 'Inter'}
                    onChange={(e) => onUpdateElement(selectedEl.id, { fontFamily: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs p-1.5 rounded-lg outline-none cursor-pointer focus:ring-1 ring-indigo-500 font-semibold"
                  >
                    <option value="Inter">Inter (Sans-serif UI)</option>
                    <option value="Space Grotesk">Space Grotesk (Modern Bold)</option>
                    <option value="JetBrains Mono">JetBrains Mono (Technical)</option>
                  </select>
                </div>

                {/* Weights & Alignment Row */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 font-sans block">Formatting Toolbar</label>
                  <div className="flex gap-2">
                    {/* Bold Toggle */}
                    <button
                      onClick={() => onUpdateElement(selectedEl.id, { fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={`p-2 rounded-lg border text-xs flex-1 flex justify-center items-center font-bold cursor-pointer ${
                        selectedEl.fontWeight === 'bold' 
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </button>
                    {/* Italic Toggle */}
                    <button
                      onClick={() => onUpdateElement(selectedEl.id, { fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })}
                      className={`p-2 rounded-lg border text-xs flex-1 flex justify-center items-center italic cursor-pointer ${
                        selectedEl.fontStyle === 'italic' 
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Layout Alignments */}
                  <div className="flex bg-slate-100 border border-slate-200 p-0.5 rounded-lg mt-2">
                    {(['left', 'center', 'right'] as const).map((align) => {
                      const isAlign = (selectedEl.alignment || 'left') === align;
                      return (
                        <button
                          key={align}
                          onClick={() => onUpdateElement(selectedEl.id, { alignment: align })}
                          className={`flex-1 py-1.5 rounded flex justify-center items-center select-none text-xs transition-all cursor-pointer ${
                            isAlign ? 'bg-white text-indigo-600 font-bold shadow-sm' : 'text-slate-500 hover:text-slate-800 font-medium'
                          }`}
                        >
                          {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                          {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                          {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Overlap / Page break warnings */}
                {(() => {
                  const overlapsFirst = selectedEl.y < 1050 && selectedEl.y + selectedEl.height > 1030;
                  const overlapsSecond = selectedEl.y < 2100 && selectedEl.y + selectedEl.height > 2080;
                  if (overlapsFirst || overlapsSecond) {
                    const pageBreakY = overlapsFirst ? 1050 : 2100;
                    return (
                      <div className="p-2.5 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium font-sans flex flex-col gap-1.5 transition-all">
                        <span className="font-bold flex items-center gap-1">⚠️ Page Break Overlap Detected</span>
                        <span>This block crosses a page break line and will look cut off or clipped when exported.</span>
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => onUpdateElement(selectedEl.id, { y: pageBreakY + 10 })}
                            className="bg-amber-600 hover:bg-amber-750 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-sm cursor-pointer transition-colors"
                          >
                            Push to Next Page
                          </button>
                          <button
                            onClick={() => onUpdateElement(selectedEl.id, { y: pageBreakY - selectedEl.height - 10 })}
                            className="bg-white hover:bg-amber-50 text-amber-700 font-bold text-[10px] px-2.5 py-1 rounded border border-amber-300 cursor-pointer transition-colors"
                          >
                            Pull to Prev Page
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}

            {/* Precision Coordinate Box sizing (useful for fine aligning layout objects) */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-600 font-sans flex items-center justify-between">
                <span>Precision Placement</span>
                <span className="text-[10px] text-indigo-650 font-bold uppercase tracking-wider">A4 Grid: 800W</span>
              </label>
              
              <div className="grid grid-cols-2 gap-2 text-xs font-sans font-semibold">
                {/* Horizontal left */}
                <div className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex justify-between items-center text-slate-700">
                  <span className="text-slate-400">X:</span>
                  <input
                    type="number"
                    value={selectedEl.x}
                    onChange={(e) => onUpdateElement(selectedEl.id, { x: parseInt(e.target.value) || 0 })}
                    className="w-12 bg-transparent text-right outline-none text-slate-850 font-bold"
                  />
                </div>
                {/* Vertical Top */}
                <div className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex justify-between items-center text-slate-700">
                  <span className="text-slate-400">Y:</span>
                  <input
                    type="number"
                    value={selectedEl.y}
                    onChange={(e) => onUpdateElement(selectedEl.id, { y: parseInt(e.target.value) || 0 })}
                    className="w-12 bg-transparent text-right outline-none text-slate-850 font-bold"
                  />
                </div>
                {/* Width dimension */}
                <div className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex justify-between items-center text-slate-700">
                  <span className="text-slate-400">W:</span>
                  <input
                    type="number"
                    value={selectedEl.width}
                    onChange={(e) => onUpdateElement(selectedEl.id, { width: parseInt(e.target.value) || 0 })}
                    className="w-12 bg-transparent text-right outline-none text-slate-850 font-bold"
                  />
                </div>
                {/* Height Dimension */}
                <div className="bg-slate-50 p-2 border border-slate-200 rounded-lg flex justify-between items-center text-slate-700">
                  <span className="text-slate-400">H:</span>
                  <input
                    type="number"
                    value={selectedEl.height}
                    onChange={(e) => onUpdateElement(selectedEl.id, { height: parseInt(e.target.value) || 0 })}
                    className="w-12 bg-transparent text-right outline-none text-slate-850 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-3 text-center text-slate-400 space-y-3">
            <div className="p-3.5 bg-slate-50 rounded-full border border-slate-200 text-indigo-500">
              <TypeIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-sm font-bold text-slate-600 font-sans uppercase tracking-wider">No Selection</p>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs font-medium">Click any text node, logo, or line on the workspace to inspect styles, modify spacing, and refine layout coordinates.</p>
          </div>
        )}
      </div>
    </div>
  );
};
