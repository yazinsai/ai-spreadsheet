// Core type definitions for the AI Sheet application
// Alternative: Consider using branded types for IDs to ensure type safety

export type ColumnKind = 'text' | 'number' | 'ai';

export type CellState = 'idle' | 'queued' | 'running' | 'done' | 'error';

// Column definition with optional AI configuration
export interface Column {
  id: string;            // Stable unique identifier
  name: string;          // User-facing header name
  kind: ColumnKind;      // Column type
  formula?: string;      // Only for AI columns: raw =AI(...) formula
  ai?: {
    modelId?: string;    // Per-column model override
    temperature?: number; // 0-1 range
    maxTokens?: number;  // Token limit for generation
  };
}

// Row data structure with values and metadata
export interface Row {
  id: string;
  values: Record<string, string | number | null>; // Keyed by columnId
  meta?: Record<string, {
    state: CellState;
    error?: string;
  }>;
}

// Complete sheet structure with versioning
export interface Sheet {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
  createdAt: number;     // Unix timestamp
  updatedAt: number;     // Unix timestamp
  version: number;       // For Dexie migrations
}

// Global application settings
export interface Settings {
  defaultModelId: string;      // Global default model
  defaultTemperature: number;   // e.g., 0.2
  defaultMaxTokens: number;     // e.g., 512
  concurrency: number;          // Default 4
  maxInputChars?: number;       // Optional truncation limit (0 = unlimited)
}

// Model options configuration
export const MODEL_OPTIONS = [
  { id: 'anthropic/claude-opus-4.1', label: 'Claude 4.1 Opus' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5', label: 'GPT-5 (OpenAI)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'deepseek/deepseek-r1-distill-llama-70b', label: 'DeepSeek: R1 Distill Llama 70B' },
  { id: 'mistral/mistral-large-latest', label: 'Mistral Large' },
  { id: 'qwen/qwen-turbo', label: 'Qwen-Turbo' },
] as const;

export type ModelId = typeof MODEL_OPTIONS[number]['id'];

// Formula parsing result
export interface ParsedFormula {
  template: string;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

// CSV import preview data
export interface CSVPreview {
  headers: string[];
  rows: string[][];
  delimiter: string;
  totalRows: number;
}

// Compute task for batch processing
export interface ComputeTask {
  rowId: string;
  columnId: string;
  prompt: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
}

// Compute result from AI
export interface ComputeResult {
  rowId: string;
  columnId: string;
  value: string;
  error?: string;
}

// Export configuration
export interface ExportConfig {
  includeFormulas: boolean;
  includeColumnConfigs: boolean;
  format: 'csv' | 'json';
}

// Sheet metadata for exports
export interface SheetMetadata {
  version: string;
  exportedAt: number;
  columns: Array<{
    id: string;
    name: string;
    kind: ColumnKind;
    formula?: string;
    ai?: Column['ai'];
  }>;
}