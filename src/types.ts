/**
 * Shared Type Declarations for Chnada OCR
 */

export interface DocumentElement {
  id: string;
  type: 'text' | 'heading' | 'divider' | 'image';
  content: string;
  x: number;       // Normalized X coordinate (relative to width of 800)
  y: number;       // Normalized Y coordinate (relative to height of 1050)
  width: number;   // Width (relative to 800)
  height: number;  // Height (relative to 1050)
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;     // HEX code e.g. '#1e293b'
  alignment?: 'left' | 'center' | 'right';
  fontFamily?: string; // Standard font stacks e.g. 'Inter', 'Space Grotesk', etc.
}

export interface DocumentLayout {
  width: number;   // Grid width reference (usually 800)
  height: number;  // Grid height reference (usually 1050)
  elements: DocumentElement[];
}

export interface SampleDoc {
  name: string;
  description: string;
  language: string;
  imagePlaceholder: string; // Base64 or a styled URL
  layout: DocumentLayout;
}
