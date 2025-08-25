# AI Sheet - Smart Spreadsheet with AI Formulas

A powerful spreadsheet application that lets you use AI to transform and analyze your data. Think of it as Excel meets ChatGPT - you can write formulas that use AI to process your data automatically.

## What Can You Do With AI Sheet?

- **Extract information** from messy text (emails, documents, reviews)
- **Categorize and classify** data automatically
- **Generate content** based on patterns in your data
- **Translate** text between languages
- **Summarize** long text into key points
- **Clean and standardize** inconsistent data
- And much more with custom AI prompts!

## Quick Start

### 1. Get the Code

First, make sure you have [Node.js](https://nodejs.org/) installed (version 18 or higher).

Then download this project:
```bash
git clone https://github.com/yazinsai/ai-spreadsheet.git
cd ai-spreadsheet
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Application

```bash
npm run dev
```

Open your browser and go to [http://localhost:3000](http://localhost:3000)

### 4. Get an API Key

You'll need an OpenRouter API key to use AI features:

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Go to [Keys](https://openrouter.ai/keys) and create a new key
3. In AI Sheet, click the **Settings** button and paste your API key

## How to Use AI Formulas

### Basic Formula

Type this in any cell:
```
=AI("Your prompt here")
```

### Using Data from Other Columns

Reference other columns with `{{ColumnName}}`:
```
=AI("Summarize this text in one sentence: {{Description}}")
```

### Examples

#### Extract Email Addresses
```
=AI("Extract the email address from: {{Contact Info}}")
```

#### Categorize Products
```
=AI("What category does this product belong to: {{Product Name}}? Choose from: Electronics, Clothing, Food, Other")
```

#### Sentiment Analysis
```
=AI("Is this review positive, negative, or neutral? {{Review Text}}")
```

#### Generate Descriptions
```
=AI("Write a brief product description for {{Product}} that costs {{Price}}")
```

#### Clean Data
```
=AI("Extract just the phone number from: {{Messy Contact Data}}")
```

### Choosing AI Models

By default, formulas use GPT-4o Mini (fast and cheap). You can specify a different model:

```
=AI("Your prompt", model: "anthropic/claude-3.5-sonnet")
```

Popular models:
- `openai/gpt-4o-mini` - Fast and affordable (default)
- `openai/gpt-4o` - More capable, slower
- `anthropic/claude-3.5-sonnet` - Great for complex tasks
- `google/gemini-2.0-flash-exp` - Google's fast model

## Tips for Beginners

### Start Simple
Begin with basic prompts and gradually make them more complex as you learn what works.

### Be Specific
Instead of: `=AI("Process this: {{Data}}")`
Try: `=AI("Extract the year from this date: {{Date Column}}")`

### Test on a Few Rows First
Before running AI on thousands of rows, test your formula on 5-10 rows to make sure it works.

### Use Templates
Create a formula that works well? Save it as a template for future use.

### Monitor Costs
Each AI call costs a small amount. The app shows estimated costs before running formulas on many rows.

## Working with Data

### Import CSV Files
Click **Import CSV** to load your existing spreadsheets. Supports files with thousands of rows.

### Export Your Results
Click **Export CSV** to save your data with all computed AI results.

### Auto-Save
Your work is automatically saved locally in your browser. Come back anytime and your data will be there.

## Common Use Cases

### Customer Feedback Analysis
1. Import CSV with customer reviews
2. Add formula: `=AI("What is the main complaint in this review: {{Review}}")`
3. Add another: `=AI("Rate the sentiment from 1-10: {{Review}}")`
4. Run formulas to analyze hundreds of reviews in minutes

### Data Cleaning
1. Import messy contact list
2. Add formulas to extract and standardize:
   - `=AI("Extract the person's full name: {{Raw Data}}")`
   - `=AI("Extract and format the phone number as (XXX) XXX-XXXX: {{Raw Data}}")`
   - `=AI("Extract the email address: {{Raw Data}}")`

### Content Generation
1. Start with product names and basic info
2. Generate marketing copy: `=AI("Write a compelling 50-word product description for {{Product}} which is a {{Category}} priced at {{Price}}")`
3. Create SEO titles: `=AI("Create an SEO-friendly title under 60 characters for {{Product}}")`

## Troubleshooting

### "API Key Required"
You need to add your OpenRouter API key in Settings. Get one free at [OpenRouter](https://openrouter.ai/).

### Formulas Not Running
- Check your API key is valid
- Make sure you clicked "Run AI" after writing formulas
- Verify your formula syntax (needs `=AI("...")`)

### Slow Performance
- Use a faster model like `gpt-4o-mini`
- Reduce the number of concurrent requests in Settings
- Process data in smaller batches

### Results Look Wrong
- Make your prompts more specific
- Add examples to your prompt
- Try a different AI model

## Keyboard Shortcuts

- `Enter` - Edit selected cell
- `Escape` - Cancel editing
- `Tab` - Move to next cell
- `Shift+Tab` - Move to previous cell
- `Ctrl/Cmd+C` - Copy
- `Ctrl/Cmd+V` - Paste
- `Ctrl/Cmd+Z` - Undo
- `Ctrl/Cmd+Shift+Z` - Redo

## Development

### Tech Stack
- Next.js 15 with TypeScript
- React Data Grid for virtualized rendering
- Zustand for state management
- IndexedDB for local storage
- OpenRouter API for AI models

### Commands
```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run lint   # Run linting
```

### Contributing
Contributions welcome! Please feel free to submit a Pull Request.

## Privacy & Security

- **Local Storage**: All your data is stored locally in your browser
- **No Backend**: This app runs entirely in your browser - we don't have servers storing your data
- **API Keys**: Your OpenRouter API key is stored only in your browser's local storage
- **Direct API Calls**: AI requests go directly from your browser to OpenRouter

## License

MIT License - feel free to use this for anything!

## Support

Having issues? 
- Check the troubleshooting section above
- Open an issue on GitHub
- Review the [OpenRouter documentation](https://openrouter.ai/docs)

---

Built with ❤️ for making data work easier with AI
