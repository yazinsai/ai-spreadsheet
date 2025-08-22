# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Start development server with Turbopack (runs on port 3000+)

# Build & Production
npm run build         # Build for production with Turbopack
npm run start         # Start production server

# Code Quality
npm run lint          # Run ESLint checks
```

## Architecture Overview

**AI Sheet** is a client-side Next.js 15 application with TypeScript, designed for spreadsheet operations with AI-powered formula columns. The app uses:
- **react-data-grid** for virtualized spreadsheet rendering (10k+ rows)
- **Zustand** for state management with auto-save
- **Dexie/IndexedDB** for local data persistence
- **OpenRouter API** for multi-model AI integration (GPT-5, Claude 4.1, Gemini 2.5)

### Core Modules

- **lib/store.ts**: Central Zustand store managing spreadsheet state, compute operations, and UI state
- **lib/ai.ts**: OpenRouter API integration with batch processing and concurrency control
- **lib/formula.ts**: AI formula parser supporting `=AI("prompt with {{Column}} refs")` syntax
- **lib/persist.ts**: Dexie schema and IndexedDB operations for auto-save/load
- **components/Grid.tsx**: Main data grid wrapper handling cell editing and column operations

### AI Formula System

Formulas use the pattern `=AI("template")` with `{{ColumnName}}` placeholders for referencing other columns. Supports model overrides like `=AI("prompt", model: "google/gemini-2.5-pro-latest")`.

Batch computation runs with configurable concurrency (default 4 parallel requests) and includes retry logic, progress tracking, and cancellation support.

### State Management Flow

1. User actions trigger Zustand store updates
2. Store middleware throttles saves to IndexedDB (500ms)
3. Grid component subscribes to store slices for optimized re-renders
4. Compute operations use transient state for progress tracking

### Development Notes

- **No backend required** - fully client-side application
- **Turbopack enabled** for faster builds
- **Path alias configured**: `@/*` maps to root directory
- **API key stored in localStorage** (accessed via Settings panel)
- **CSV parsing uses Web Workers** for non-blocking import of large files