# High-level PRD (final)

## Goal

A single-user, client-side **AI spreadsheet** to import CSVs, edit data, add **AI formula columns**, batch-compute them across up to **10k rows × \~40 columns**, show progress & failures, retry failed cells, and export to CSV. Everything persists locally.

## Non-Goals

Auth, multi-user, server, rate-limit handling, security/privacy controls, undo/redo, pagination.

## Platform & Key Tech

* **Next.js (App Router) + TypeScript**, client-heavy.
* **Styling:** Tailwind.
* **Grid:** `react-data-grid` (virtualized).
* **CSV:** PapaParse (worker mode).
* **Persistence:** Dexie (IndexedDB).
* **State:** Zustand (lightweight + middleware).
* **AI:** OpenRouter `/chat/completions` via `OPENROUTER_API_KEY` in `.env.local`.
* **Concurrency:** `p-limit`, default **4** (user-tunable).
* **Scrolling:** full virtualized scrolling; **no** pagination.

## Core UX

1. **Import CSV**

   * Drag/drop or picker → PapaParse auto-detects delimiter; previews first 50 rows; confirm → load all.
   * Header row required; map headers → internal column IDs.

2. **Grid Editing**

   * All cells inline-editable; fixed row height for perf.
   * **Header right-click menu:** Add Column, Rename, Delete, **Convert to AI Column**, **Compute**, **Retry Failed**, **Stop**.

3. **AI Columns**

   * **Formula syntax:** `=AI("…{{ColumnName}}…")`

     * Only **double braces** `{{ColumnName}}` are recognized as placeholders.
     * **Skip rule:** If a row renders to an **empty** user message (all placeholders empty), **do not call** the model; set value `""` with state `done`.
     * **Escapes:** `\{{` renders a literal `{` (placeholders only match `{{…}}`).
   * **Per-column model override** with **global default** in Settings.
   * No system prompt prefix (by design).
   * Optional JSON options inside the formula are supported but not required:

     * `=AI("…", {"temperature":0.2,"maxTokens":512,"model":"anthropic/claude-opus-4.1"})`
     * If present, they override column/global settings for that compute run.

4. **Batch Compute**

   * Column header **Compute** runs across all rows.
   * Cell states: `idle | queued | running | done | error`.
   * **Progress UI** in header: percent + counts (running/queued/failed/done).
   * **Retry Failed** re-renders prompts (picks up source edits) and re-queues only `error` cells.
   * **Stop** cancels queued and aborts in-flight via `AbortController`.

5. **Export**

   * Export current sheet to **CSV** (values only).
   * Optional “Export formulas & column configs” to a **.meta.json**.

6. **Persistence**

   * Entire sheet (columns, rows, formulas, states, settings) in IndexedDB.
   * Autosave throttle \~500ms; versioned schema + simple migration.
   * Backup/restore JSON of the whole DB.

## Data Model (TS)

```ts
type ColumnKind = 'text' | 'number' | 'ai';

type Column = {
  id: string;            // stable
  name: string;          // user-facing header
  kind: ColumnKind;
  formula?: string;      // only for ai columns; raw =AI(...)
  ai?: {
    modelId?: string;    // per-column override
    temperature?: number;
    maxTokens?: number;
  };
};

type CellState = 'idle' | 'queued' | 'running' | 'done' | 'error';

type Row = {
  id: string;
  values: Record<string, string | number | null>; // by columnId
  meta?: Record<string, { state: CellState; error?: string }>;
};

type Sheet = {
  id: string;
  name: string;
  columns: Column[];
  rows: Row[];
  createdAt: number;
  updatedAt: number;
  version: number;       // for Dexie migrations
};

type Settings = {
  defaultModelId: string;     // global default
  defaultTemperature: number; // e.g., 0.2
  defaultMaxTokens: number;   // e.g., 512
  concurrency: number;        // default 4
};
```

## AI Models (hardcoded options)

* `google/gemini-2.5-pro`
* `openai/gpt-5` *(editable placeholder)*
* `anthropic/claude-opus-4.1`
* `meta-llama/llama-3.1-405b-instruct`
* `mistral/mistral-large-latest`
* `qwen/qwen2.5-72b-instruct`

> Note: Ship as an editable constant so you can tweak to whatever OpenRouter exposes in your account.

## Parsing & Prompting

* **Render function:** Replace `{{ColumnName}}` with stringified cell value for that row.
* Missing columns resolve to `""` and trigger a non-blocking warning badge on the formula editor (but still compute).
* **Length policy:** No hard truncation by default; expose “Max input chars per row” in Settings (default 0 = unlimited).

## Performance

* Virtualized grid; no dynamic row heights.
* PapaParse in **worker mode**; UI stays responsive on import.
* Batched Dexie writes (e.g., commit results every 50 updates).
* Zustand selectors to avoid grid-wide re-renders; only updated cells re-render.
* Concurrency default **4**; adjustable in Settings.

## Error Handling

* Per-cell error message recorded in `meta`.
* Abort → cells revert to `queued`.
* Network/JSON/HTTP errors → `error` with message; column header shows failure count; **Retry Failed** uses re-rendered prompts.

---

# Paste-ready Claude Code prompt (updated)

````
You are a senior full-stack engineer. Generate a runnable Next.js (App Router) + TypeScript app called “AI Sheet” that matches this spec. Include fully commented, efficient code and brief “Alternative” notes where tradeoffs exist. Keep dependencies free/OSS.

## Tech & Packages
- Next.js (latest) + TypeScript + ESLint
- TailwindCSS (PostCSS config & minimal styles)
- Grid: react-data-grid
- CSV: papaparse (worker mode)
- State: zustand (with persist middleware where useful)
- Persistence: dexie (IndexedDB)
- Concurrency: p-limit
- Validation: zod
- Utils: clsx
- AI: fetch to OpenRouter `/api/v1/chat/completions`
- Env: `.env.local` with OPENROUTER_API_KEY

## App Structure
- `app/page.tsx` – main sheet UI
- `components/Grid.tsx` – react-data-grid wrapper + header context menu
- `components/FormulaEditor.tsx` – editor modal with live preview (for a sample row)
- `components/ComputeControls.tsx` – progress bar & buttons (Compute/Retry/Stop)
- `components/Settings.tsx` – defaults (model/temp/maxTokens/concurrency)
- `lib/formula.ts` – parse/validate `=AI("...")` and render placeholders
- `lib/ai.ts` – OpenRouter client with AbortController; map response → string
- `lib/csv.ts` – import/export via PapaParse (worker on import; unparse on export)
- `lib/persist.ts` – Dexie schema, migrations, backup/restore JSON
- `lib/store.ts` – Zustand store (Sheet, Settings, actions)
- `lib/types.ts` – shared TS types (Sheet, Column, Row, etc.)
- `public/` – (no sample files by request)

## Hardcoded Model Options (editable)
Define:
```ts
export const MODEL_OPTIONS = [
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5', label: 'GPT-5 (OpenAI)' },
  { id: 'anthropic/claude-opus-4.1', label: 'Claude 4.1' },
  { id: 'meta-llama/llama-3.1-405b-instruct', label: 'Llama 3.1 405B Instruct' },
  { id: 'mistral/mistral-large-latest', label: 'Mistral Large' },
  { id: 'qwen/qwen2.5-72b-instruct', label: 'Qwen2.5 72B Instruct' },
] as const;
````

Use `Settings.defaultModelId` to pick the initial selection.

## Data Model

(Use these exact types)

```ts
type ColumnKind = 'text' | 'number' | 'ai';
type Column = { id: string; name: string; kind: ColumnKind; formula?: string; ai?: { modelId?: string; temperature?: number; maxTokens?: number; } };
type CellState = 'idle' | 'queued' | 'running' | 'done' | 'error';
type Row = { id: string; values: Record<string, string|number|null>; meta?: Record<string, { state: CellState; error?: string }>; };
type Sheet = { id: string; name: string; columns: Column[]; rows: Row[]; createdAt: number; updatedAt: number; version: number; };
type Settings = { defaultModelId: string; defaultTemperature: number; defaultMaxTokens: number; concurrency: number; maxInputChars?: number; };
```

## Formula Syntax & Parsing

* Only support **double braces** placeholders: `{{ColumnName}}`.
* Valid AI formula:

  * `=AI("Generate a tagline for {{Name}} based on {{Description}}")`
  * Optional options: `=AI("...", {"temperature":0.2,"maxTokens":512,"model":"anthropic/claude-opus-4.1"})`
* Implement `renderTemplate(template: string, row: Row, columnsByName: Map<string, Column>): string`

  * Replace `{{Col}}` with string value from `row.values[colId]`. Missing → `""`.
  * Support escape for literal brace: `\{{` → `{` (placeholders only match `{{...}}`).
* `validateFormula(str)`:

  * Must start with `=AI("` and end with `)`.
  * Extract the quoted template and optional JSON object after the comma (use a small parser, not regex-only).
  * Return `{ template: string; options?: { model?: string; temperature?: number; maxTokens?: number } }` or a typed error.

## Compute Semantics

* Column header has **Compute**, **Retry Failed**, **Stop**.
* Use `p-limit` with `Settings.concurrency` (default 4).
* For each row:

  * Render user message; if empty → set value `""`, state `done` (skip network).
  * Build OpenRouter payload:

    ```ts
    { model, messages: [{ role:'user', content: rendered }], temperature, max_tokens }
    ```
  * No system message (by product decision).
  * Extract `choices[0].message.content` as the cell value; trim whitespace.
* **Retry Failed** re-renders prompts using current row values & column formula/options.
* **Stop** aborts in-flight (AbortController) and clears queued tasks.

## UI Requirements

* **react-data-grid** virtualized list; fixed row height.
* All cells editable (text/number).
* Header right-click menu: Add Column, Rename, Delete, Convert to AI Column, Compute, Retry Failed, Stop.
* AI columns show a small chip (model id) and a per-cell spinner/error icon.
* Column header progress: `% + running/queued/failed/done`.
* **FormulaEditor**: textarea, inline lint, tiny preview for the currently selected row.

## CSV Import/Export

* Import: PapaParse in **worker mode**, header detected, preview then commit.
* Export: “Values to CSV”; optional toggle to also download `.meta.json` with formulas/configs.

## Persistence

* Dexie DB `ai-sheet`, table `sheets` keyed by `sheetId`.
* Autosave (throttle 500ms) after edits/compute batches.
* Batched commits: write results to Dexie every N (e.g., 50) cell updates.
* Backup/Restore entire DB to/from JSON.

## Performance & Reliability

* Target: 10k rows × 40 cols without freezing main thread.
* Avoid grid-wide re-renders (use selectors/memo).
* Minimal object churn; prefer updates by cell.
* Provide a simple `memory usage` debug readout (optional).

## Error Handling

* Per-cell error message and `error` state on non-2xx/parse failures.
* If a placeholder references a non-existing column, warn in editor but compute with `""`.
* Abort sets in-flight to `queued`.

## Settings UI

* Global defaults: model (from MODEL\_OPTIONS), temperature (0..1), max tokens, concurrency, max input chars (0 = unlimited).
* Per-AI-column overrides (model/temperature/maxTokens). No system prompt field.

## Deliverables

* Full source files in code blocks:

  * `package.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`
  * `components/*` (Grid, FormulaEditor, ComputeControls, Settings)
  * `lib/*` (ai, csv, persist, formula, store, types)
  * `.env.local.example` with `OPENROUTER_API_KEY=`
  * `README.md` with setup, commands, and “Alternative” notes (e.g., AG Grid Community swap)
* Comments throughout explaining decisions & tradeoffs.

Constraints:

* Single-user, client-only. No auth. No undo/redo. No pagination. No server routes beyond static.

Always use context7 for latest docs.