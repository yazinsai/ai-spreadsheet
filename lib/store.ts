// Zustand store for application state management
// Alternative: Consider Redux Toolkit for more complex state requirements

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { Sheet, Column, Row, Settings, CellState, ComputeTask } from './types';
import { sheetDb, settingsDb, DEFAULT_SETTINGS } from './persist';

interface ComputeProgress {
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
}

interface AppState {
  // Current sheet
  currentSheet: Sheet | null;
  
  // Application settings
  settings: Settings;
  
  // Compute state
  isComputing: boolean;
  computeProgress: Record<string, ComputeProgress>; // By columnId
  abortController: AbortController | null;
  
  // UI state
  selectedCell: { rowId: string; columnId: string } | null;
  isFormulaEditorOpen: boolean;
  editingColumn: Column | null;
  
  // Actions
  loadSheet: (id: string) => Promise<void>;
  createSheet: (name: string) => Promise<void>;
  deleteSheet: (id: string) => Promise<void>;
  updateSheet: (updates: Partial<Sheet>) => void;
  
  // Column operations
  addColumn: (name: string, kind: Column['kind'], after?: string) => void;
  updateColumn: (id: string, updates: Partial<Column>) => void;
  deleteColumn: (id: string) => void;
  convertToAIColumn: (id: string) => void;
  
  // Row operations
  addRow: () => void;
  updateCell: (rowId: string, columnId: string, value: string | number | null) => void;
  updateCellState: (rowId: string, columnId: string, state: CellState, error?: string) => void;
  deleteRow: (id: string) => void;
  
  // Compute operations
  startCompute: (columnId: string, retry?: boolean, forceAll?: boolean) => Promise<void>;
  computeSingleCell: (rowId: string, columnId: string) => Promise<void>;
  stopCompute: () => void;
  updateComputeProgress: (columnId: string, progress: Partial<ComputeProgress>) => void;
  
  // Settings
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  
  // UI state
  setSelectedCell: (cell: { rowId: string; columnId: string } | null) => void;
  openFormulaEditor: (column: Column) => void;
  closeFormulaEditor: () => void;
  
  // Persistence
  saveSheet: () => Promise<void>;
  autoSave: () => void;
}

// Throttle function for autosave
const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  
  return ((...args: Parameters<T>) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      lastExecTime = currentTime;
      func(...args);
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        func(...args);
      }, delay);
    }
  }) as T;
};

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentSheet: null,
    settings: DEFAULT_SETTINGS,
    isComputing: false,
    computeProgress: {},
    abortController: null,
    selectedCell: null,
    isFormulaEditorOpen: false,
    editingColumn: null,

    // Sheet operations
    loadSheet: async (id: string) => {
      const sheet = await sheetDb.get(id);
      if (sheet) {
        set({ currentSheet: sheet });
      }
    },

    createSheet: async (name: string) => {
      const sheet = await sheetDb.create({
        id: nanoid(),
        name,
        columns: [
          { id: nanoid(), name: 'Column A', kind: 'text' },
          { id: nanoid(), name: 'Column B', kind: 'text' },
        ],
        rows: Array.from({ length: 10 }, () => ({
          id: nanoid(),
          values: {},
        })),
      });
      set({ currentSheet: sheet });
    },

    deleteSheet: async (id: string) => {
      await sheetDb.delete(id);
      const state = get();
      if (state.currentSheet?.id === id) {
        set({ currentSheet: null });
      }
    },

    updateSheet: (updates: Partial<Sheet>) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        return {
          currentSheet: {
            ...state.currentSheet,
            ...updates,
          },
        };
      });
      get().autoSave();
    },

    // Column operations
    addColumn: (name: string, kind: Column['kind'], after?: string) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const newColumn: Column = {
          id: nanoid(),
          name,
          kind,
        };
        
        const columns = [...state.currentSheet.columns];
        if (after) {
          const index = columns.findIndex(c => c.id === after);
          if (index !== -1) {
            columns.splice(index + 1, 0, newColumn);
          } else {
            columns.push(newColumn);
          }
        } else {
          columns.push(newColumn);
        }
        
        return {
          currentSheet: {
            ...state.currentSheet,
            columns,
          },
        };
      });
      get().autoSave();
    },

    updateColumn: (id: string, updates: Partial<Column>) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const columns = state.currentSheet.columns.map(col =>
          col.id === id ? { ...col, ...updates } : col
        );
        
        return {
          currentSheet: {
            ...state.currentSheet,
            columns,
          },
        };
      });
      get().autoSave();
    },

    deleteColumn: (id: string) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const columns = state.currentSheet.columns.filter(col => col.id !== id);
        const rows = state.currentSheet.rows.map(row => {
          const { [id]: _, ...values } = row.values;
          const meta = row.meta ? { ...row.meta } : undefined;
          if (meta) {
            delete meta[id];
          }
          return { ...row, values, meta };
        });
        
        return {
          currentSheet: {
            ...state.currentSheet,
            columns,
            rows,
          },
        };
      });
      get().autoSave();
    },

    convertToAIColumn: (id: string) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const columns = state.currentSheet.columns.map(col =>
          col.id === id
            ? {
                ...col,
                kind: 'ai' as const,
                formula: '=AI("")',
                ai: {
                  modelId: state.settings.defaultModelId,
                  temperature: state.settings.defaultTemperature,
                  maxTokens: state.settings.defaultMaxTokens,
                },
              }
            : col
        );
        
        return {
          currentSheet: {
            ...state.currentSheet,
            columns,
          },
        };
      });
      get().autoSave();
    },

    // Row operations
    addRow: () => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const newRow: Row = {
          id: nanoid(),
          values: {},
        };
        
        return {
          currentSheet: {
            ...state.currentSheet,
            rows: [...state.currentSheet.rows, newRow],
          },
        };
      });
      get().autoSave();
    },

    updateCell: (rowId: string, columnId: string, value: string | number | null) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const rows = state.currentSheet.rows.map(row =>
          row.id === rowId
            ? {
                ...row,
                values: {
                  ...row.values,
                  [columnId]: value,
                },
              }
            : row
        );
        
        return {
          currentSheet: {
            ...state.currentSheet,
            rows,
          },
        };
      });
      get().autoSave();
    },

    updateCellState: (rowId: string, columnId: string, state: CellState, error?: string) => {
      set((s) => {
        if (!s.currentSheet) return s;
        
        const rows = s.currentSheet.rows.map(row =>
          row.id === rowId
            ? {
                ...row,
                meta: {
                  ...row.meta,
                  [columnId]: { state, error },
                },
              }
            : row
        );
        
        return {
          currentSheet: {
            ...s.currentSheet,
            rows,
          },
        };
      });
    },

    deleteRow: (id: string) => {
      set((state) => {
        if (!state.currentSheet) return state;
        
        const rows = state.currentSheet.rows.filter(row => row.id !== id);
        
        return {
          currentSheet: {
            ...state.currentSheet,
            rows,
          },
        };
      });
      get().autoSave();
    },

    // Compute operations
    startCompute: async (columnId: string, retry = false, forceAll = false) => {
      const controller = new AbortController();
      set({
        isComputing: true,
        abortController: controller,
      });
      
      // Initialize progress
      const state = get();
      if (!state.currentSheet) return;
      
      const column = state.currentSheet.columns.find(c => c.id === columnId);
      if (!column || column.kind !== 'ai' || !column.formula) {
        console.error('Cannot compute - column not found or not AI column', { columnId, column });
        set({ isComputing: false, abortController: null });
        return;
      }
      
      // Count cells that need processing
      const unprocessedCount = forceAll 
        ? state.currentSheet.rows.length
        : state.currentSheet.rows.filter(row => {
            const cellState = row.meta?.[columnId]?.state;
            const cellValue = row.values[columnId];
            return !(cellState === 'done' && cellValue);
          }).length;
      
      const failedCount = state.currentSheet.rows.filter(
        r => r.meta?.[columnId]?.state === 'error'
      ).length;
      
      const toProcess = retry ? failedCount : unprocessedCount;
      
      set((s) => ({
        computeProgress: {
          ...s.computeProgress,
          [columnId]: {
            total: toProcess,
            queued: toProcess,
            running: 0,
            done: 0,
            failed: 0,
          },
        },
      }));
      
      // Import required modules
      const { parseFormula, renderTemplate } = await import('./formula');
      const { batchCompletions } = await import('./ai');
      
      // Parse formula
      const parsed = parseFormula(column.formula);
      if ('error' in parsed) {
        alert(`Invalid formula: ${parsed.error}`);
        set({ isComputing: false, abortController: null });
        return;
      }
      
      // Prepare column map
      const columnsByName = new Map(state.currentSheet.columns.map(col => [col.name, col]));
      
      // Build compute tasks
      const tasks: ComputeTask[] = [];
      const rowsToCompute = retry
        ? state.currentSheet.rows.filter(row => row.meta?.[columnId]?.state === 'error')
        : forceAll
        ? state.currentSheet.rows
        : state.currentSheet.rows.filter(row => {
            // Skip rows that are already computed (have a value and state is 'done')
            const cellState = row.meta?.[columnId]?.state;
            const cellValue = row.values[columnId];
            return !(cellState === 'done' && cellValue);
          });
      
      for (const row of rowsToCompute) {
        // Set initial state
        get().updateCellState(row.id, columnId, 'queued');
        
        // Render template
        const { rendered } = renderTemplate(
          parsed.template,
          row,
          columnsByName,
          state.settings.maxInputChars
        );
        
        // Skip empty prompts
        if (!rendered.trim()) {
          get().updateCell(row.id, columnId, '');
          get().updateCellState(row.id, columnId, 'done');
          continue;
        }
        
        tasks.push({
          rowId: row.id,
          columnId,
          prompt: rendered,
          modelId: parsed.options?.model || column.ai?.modelId || state.settings.defaultModelId,
          temperature: parsed.options?.temperature ?? column.ai?.temperature ?? state.settings.defaultTemperature,
          maxTokens: parsed.options?.maxTokens ?? column.ai?.maxTokens ?? state.settings.defaultMaxTokens,
        });
      }
      
      if (tasks.length === 0) {
        console.log('No tasks to compute');
        set({ isComputing: false, abortController: null });
        return;
      }
      
      console.log(`Starting compute with ${tasks.length} tasks`);
      
      // Process tasks with concurrency control
      try {
        await batchCompletions(
          tasks,
          state.settings.concurrency,
          (result) => {
            // Get current progress state from store
            const currentProgress = get().computeProgress[columnId] || { 
              total: 0, queued: 0, running: 0, done: 0, failed: 0 
            };
            
            // Update cell with result
            if (result.error) {
              get().updateCellState(result.rowId, result.columnId, 'error', result.error);
              get().updateComputeProgress(columnId, {
                failed: currentProgress.failed + 1,
                running: Math.max(0, currentProgress.running - 1),
              });
            } else {
              get().updateCell(result.rowId, result.columnId, result.value);
              get().updateCellState(result.rowId, result.columnId, 'done');
              get().updateComputeProgress(columnId, {
                done: currentProgress.done + 1,
                running: Math.max(0, currentProgress.running - 1),
              });
            }
            
            // Auto-save periodically
            const totalProcessed = currentProgress.done + currentProgress.failed + 1;
            if (totalProcessed % 10 === 0) {
              get().saveSheet();
            }
          },
          controller.signal,
          (task) => {
            // Task is starting - move from queued to running
            const currentProgress = get().computeProgress[columnId] || { 
              total: 0, queued: 0, running: 0, done: 0, failed: 0 
            };
            get().updateCellState(task.rowId, task.columnId, 'running');
            get().updateComputeProgress(columnId, {
              running: currentProgress.running + 1,
              queued: Math.max(0, currentProgress.queued - 1),
            });
          }
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Compute stopped by user');
        } else {
          console.error('Compute error:', error);
          alert(`Compute failed: ${(error as Error).message}`);
        }
      } finally {
        get().stopCompute();
        get().saveSheet();
      }
    },

    computeSingleCell: async (rowId: string, columnId: string) => {
      const state = get();
      if (!state.currentSheet) return;
      
      const column = state.currentSheet.columns.find(c => c.id === columnId);
      const row = state.currentSheet.rows.find(r => r.id === rowId);
      
      if (!column || !row || column.kind !== 'ai' || !column.formula) {
        return;
      }
      
      // Dynamic import to avoid circular dependency
      const { parseFormula, renderTemplate } = await import('./formula');
      const { getCompletion } = await import('./ai');
      
      // Parse formula
      const parsed = parseFormula(column.formula);
      if ('error' in parsed) {
        state.updateCellState(rowId, columnId, 'error', parsed.error);
        return;
      }
      
      // Set cell to running state
      state.updateCellState(rowId, columnId, 'running');
      
      // Render template
      const columnsByName = new Map(state.currentSheet.columns.map(col => [col.name, col]));
      const { rendered } = renderTemplate(
        parsed.template,
        row,
        columnsByName,
        state.settings.maxInputChars
      );
      
      // Skip empty prompts
      if (!rendered.trim()) {
        state.updateCell(rowId, columnId, '');
        state.updateCellState(rowId, columnId, 'done');
        return;
      }
      
      // Create compute task
      const task = {
        rowId,
        columnId,
        prompt: rendered,
        modelId: parsed.options?.model || column.ai?.modelId || state.settings.defaultModelId,
        temperature: parsed.options?.temperature ?? column.ai?.temperature ?? state.settings.defaultTemperature,
        maxTokens: parsed.options?.maxTokens ?? column.ai?.maxTokens ?? state.settings.defaultMaxTokens,
      };
      
      try {
        // Execute AI completion
        const result = await getCompletion(task);
        
        if (result.error) {
          state.updateCellState(rowId, columnId, 'error', result.error);
        } else {
          state.updateCell(rowId, columnId, result.value);
          state.updateCellState(rowId, columnId, 'done');
        }
      } catch (error) {
        state.updateCellState(rowId, columnId, 'error', (error as Error).message);
      }
      
      // Save changes
      state.saveSheet();
    },

    stopCompute: () => {
      const state = get();
      if (state.abortController) {
        state.abortController.abort();
      }
      set({
        isComputing: false,
        abortController: null,
      });
    },

    updateComputeProgress: (columnId: string, progress: Partial<ComputeProgress>) => {
      set((state) => ({
        computeProgress: {
          ...state.computeProgress,
          [columnId]: {
            ...state.computeProgress[columnId],
            ...progress,
          },
        },
      }));
    },

    // Settings
    updateSettings: async (updates: Partial<Settings>) => {
      await settingsDb.update(updates);
      const newSettings = await settingsDb.get();
      set({ settings: newSettings });
    },

    resetSettings: async () => {
      await settingsDb.reset();
      set({ settings: DEFAULT_SETTINGS });
    },

    // UI state
    setSelectedCell: (cell) => {
      set({ selectedCell: cell });
    },

    openFormulaEditor: (column: Column) => {
      set({
        isFormulaEditorOpen: true,
        editingColumn: column,
      });
    },

    closeFormulaEditor: () => {
      set({
        isFormulaEditorOpen: false,
        editingColumn: null,
      });
    },

    // Persistence
    saveSheet: async () => {
      const state = get();
      if (state.currentSheet) {
        await sheetDb.update(state.currentSheet.id, state.currentSheet);
      }
    },

    autoSave: throttle(() => {
      get().saveSheet();
    }, 500),
  }))
);

// Initialize settings on app load
export const initializeApp = async () => {
  const settings = await settingsDb.get();
  useStore.setState({ settings });
};