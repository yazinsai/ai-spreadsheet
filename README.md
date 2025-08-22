# AI Sheet - Intelligent Spreadsheet with AI Formulas

A single-user, client-side AI spreadsheet application that allows you to import CSVs, edit data, add AI formula columns, and batch-compute them across thousands of rows with progress tracking and retry capabilities.

## Features

- **CSV Import/Export**: Drag-and-drop or select CSV files with automatic delimiter detection and preview
- **AI Formula Columns**: Create columns with AI-powered formulas using `=AI("...")` syntax
- **Batch Processing**: Compute AI formulas across up to 10,000 rows × 40 columns with configurable concurrency
- **Progress Tracking**: Real-time progress bars showing queued, running, completed, and failed cells
- **Error Recovery**: Retry failed cells with updated prompts
- **Local Persistence**: All data stored locally in IndexedDB for offline access
- **Virtualized Grid**: Smooth scrolling and editing of large datasets using react-data-grid
- **Model Selection**: Choose from multiple AI models (GPT-5, Claude 4.1, Gemini 2.5 Pro, etc.)
- **Formula Templates**: Reference other columns using `{{ColumnName}}` placeholders

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenRouter API key (get one at [https://openrouter.ai/keys](https://openrouter.ai/keys))

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-spreadsheet
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local and add your OPENROUTER_API_KEY
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

```bash
npm run build
npm start
```

## Usage Guide

### Creating AI Formulas

AI formulas use the syntax `=AI("template")` where the template can include placeholders for other columns:

```
=AI("Generate a product description for {{Product Name}}")
=AI("Summarize the feedback: {{Customer Review}}")
=AI("Translate {{English Text}} to Spanish")
```

### Advanced Formula Options

You can override model settings directly in the formula:

```
=AI("Generate a creative story about {{Topic}}", {
  "temperature": 0.9,
  "maxTokens": 1000,
  "model": "openai/gpt-5"
})
```

### Placeholder Syntax

- **Column Reference**: `{{Column Name}}` - References the value from another column
- **Escape Sequence**: `\{{` - Produces a literal `{` in the output
- **Empty Values**: If a placeholder references an empty cell, it resolves to an empty string

### Performance Tips

1. **Concurrency**: Adjust concurrency in Settings (1-10 parallel requests)
2. **Max Input Characters**: Set a limit to truncate long prompts
3. **Batch Size**: The app automatically batches database writes for performance
4. **Worker Mode**: CSV parsing happens in a web worker to keep the UI responsive

## Architecture

### Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Grid**: react-data-grid (virtualized)
- **CSV**: PapaParse (worker mode)
- **State**: Zustand (with persist middleware)
- **Persistence**: Dexie (IndexedDB wrapper)
- **AI**: OpenRouter API (supports multiple models)
- **Concurrency**: p-limit for rate limiting

### Data Flow

1. **Import**: CSV → PapaParse Worker → Sheet Data Structure → IndexedDB
2. **Edit**: User Input → Zustand Store → Auto-save to IndexedDB
3. **Compute**: Formula → Template Rendering → OpenRouter API → Cell Updates
4. **Export**: Sheet Data → PapaParse Unparse → CSV Download

### Key Components

- `Grid.tsx`: Main spreadsheet grid with context menus and cell editing
- `FormulaEditor.tsx`: Modal for editing AI formulas with live preview
- `ComputeControls.tsx`: Progress tracking and batch compute controls
- `Settings.tsx`: Global configuration and API key management

## Alternative Implementations

Several architectural decisions were made with alternatives in mind:

### Grid Library
- **Current**: react-data-grid (lightweight, good virtualization)
- **Alternative**: AG Grid Community (more features, heavier bundle)

### State Management
- **Current**: Zustand (simple, lightweight)
- **Alternative**: Redux Toolkit (more boilerplate, better DevTools)

### Persistence
- **Current**: Dexie/IndexedDB (large storage, offline-first)
- **Alternative**: localStorage (simpler but 5MB limit)

### AI Integration
- **Current**: Direct OpenRouter fetch (simple, flexible)
- **Alternative**: Vercel AI SDK (streaming support, more abstraction)

### Formula Parser
- **Current**: Custom regex-based parser (lightweight)
- **Alternative**: Parser combinator library (more robust, larger bundle)

## Limitations

- **Single-user only**: No multi-user collaboration or sharing
- **Client-side only**: All processing happens in the browser
- **No undo/redo**: Changes are immediately persisted
- **No pagination**: Uses virtualized scrolling instead
- **Rate limits**: Depends on your OpenRouter account limits
- **Browser storage**: Limited by browser's IndexedDB quota

## Development

### Project Structure

```
ai-spreadsheet/
├── app/                 # Next.js app router pages
│   ├── page.tsx        # Main application page
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── Grid.tsx        # Spreadsheet grid
│   ├── FormulaEditor.tsx
│   ├── ComputeControls.tsx
│   └── Settings.tsx
├── lib/                # Core logic
│   ├── types.ts        # TypeScript types
│   ├── store.ts        # Zustand store
│   ├── persist.ts      # Dexie/IndexedDB
│   ├── ai.ts           # OpenRouter client
│   ├── formula.ts      # Formula parsing
│   └── csv.ts          # CSV import/export
└── public/             # Static assets
```

### Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Testing

To test the application:

1. Create a sample CSV file with headers
2. Import it into the app
3. Right-click a column header and select "Convert to AI Column"
4. Edit the formula (e.g., `=AI("Summarize {{Column1}}")`)
5. Click "Compute All" to process all rows
6. Export the results as CSV

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Ensure your OpenRouter API key is valid
   - Check that you have credits in your account
   - Verify the key is saved in Settings

2. **Import Fails**
   - Ensure CSV has a header row
   - Check file size (< 100MB recommended)
   - Verify proper CSV formatting

3. **Compute Errors**
   - Check formula syntax
   - Verify referenced columns exist
   - Monitor rate limits in OpenRouter dashboard

4. **Storage Full**
   - Check browser storage quota in Settings
   - Export and backup old sheets
   - Clear browser data if needed

## Security Considerations

- **API Keys**: Stored in browser localStorage (consider risks)
- **Data Privacy**: All data stays in your browser
- **HTTPS Only**: API calls require secure connection
- **No Backend**: No server-side processing or storage

## Contributing

This is a demonstration project. For production use, consider:

- Implementing proper API key management
- Adding authentication and authorization
- Setting up server-side processing for large datasets
- Implementing comprehensive error handling
- Adding unit and integration tests

## License

MIT

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [react-data-grid](https://github.com/adazzle/react-data-grid)
- [PapaParse](https://www.papaparse.com/)
- [Dexie.js](https://dexie.org/)
- [Zustand](https://github.com/pmndrs/zustand)
- [OpenRouter](https://openrouter.ai/)