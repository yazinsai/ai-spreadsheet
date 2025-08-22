// Formula parsing and template rendering for AI columns
// Alternative: Consider using a proper parser combinator library for complex formulas

import type { ParsedFormula, Row, Column } from './types';

// Regex patterns for formula parsing
const PLACEHOLDER_PATTERN = /\{\{([^}]+)\}\}/g;
const ESCAPED_BRACE_PATTERN = /\\\{\{/g;

// Parse and validate AI formula syntax
export function parseFormula(formula: string): ParsedFormula | { error: string } {
  if (!formula.startsWith('=AI(')) {
    return { error: 'Formula must start with =AI(' };
  }

  if (!formula.endsWith(')')) {
    return { error: 'Formula must end with )' };
  }

  // Extract content between =AI( and )
  const content = formula.slice(4, -1);
  
  // Parse the template and optional options
  try {
    // Use a simple parser to extract the template string and optional JSON
    const result = parseFormulaContent(content);
    
    if ('error' in result) {
      return result;
    }

    return result;
  } catch (error) {
    return { error: `Failed to parse formula: ${(error as Error).message}` };
  }
}

// Parse formula content to extract template and options
function parseFormulaContent(content: string): ParsedFormula | { error: string } {
  // Handle empty content
  if (!content.trim()) {
    return { error: 'Formula cannot be empty' };
  }

  // Check if content starts with a quote
  if (!content.startsWith('"')) {
    return { error: 'Formula template must be a quoted string' };
  }

  // Find the end of the quoted template
  let inEscape = false;
  let endQuoteIndex = -1;
  
  for (let i = 1; i < content.length; i++) {
    if (inEscape) {
      inEscape = false;
      continue;
    }
    
    if (content[i] === '\\') {
      inEscape = true;
      continue;
    }
    
    if (content[i] === '"') {
      endQuoteIndex = i;
      break;
    }
  }

  if (endQuoteIndex === -1) {
    return { error: 'Unclosed template string' };
  }

  // Extract template (without quotes)
  const template = content.slice(1, endQuoteIndex);
  
  // Check for options after the template
  const remaining = content.slice(endQuoteIndex + 1).trim();
  
  if (!remaining) {
    return { template };
  }

  // Options should start with a comma
  if (!remaining.startsWith(',')) {
    return { error: 'Expected comma after template string' };
  }

  // Parse JSON options
  const optionsStr = remaining.slice(1).trim();
  
  if (!optionsStr) {
    return { template };
  }

  try {
    const options = JSON.parse(optionsStr);
    
    // Validate options structure
    const validatedOptions: ParsedFormula['options'] = {};
    
    if (typeof options.model === 'string') {
      validatedOptions.model = options.model;
    }
    
    if (typeof options.temperature === 'number') {
      validatedOptions.temperature = Math.max(0, Math.min(1, options.temperature));
    }
    
    if (typeof options.maxTokens === 'number') {
      validatedOptions.maxTokens = Math.max(1, options.maxTokens);
    }
    
    return {
      template,
      options: Object.keys(validatedOptions).length > 0 ? validatedOptions : undefined,
    };
  } catch {
    return { error: 'Invalid JSON options' };
  }
}

// Render template with row data
export function renderTemplate(
  template: string,
  row: Row,
  columnsByName: Map<string, Column>,
  maxInputChars?: number
): { rendered: string; warnings: string[] } {
  const warnings: string[] = [];
  
  // First, handle escaped braces
  let processed = template.replace(ESCAPED_BRACE_PATTERN, '\x00ESCAPED_BRACE\x00');
  
  // Replace placeholders with values
  processed = processed.replace(PLACEHOLDER_PATTERN, (match, columnName) => {
    const column = columnsByName.get(columnName.trim());
    
    if (!column) {
      warnings.push(`Column "${columnName}" not found`);
      return '';
    }
    
    const value = row.values[column.id];
    
    if (value === null || value === undefined) {
      return '';
    }
    
    return String(value);
  });
  
  // Restore escaped braces as single braces
  processed = processed.replace(/\x00ESCAPED_BRACE\x00/g, '{');
  
  // Apply character limit if specified
  if (maxInputChars && maxInputChars > 0 && processed.length > maxInputChars) {
    processed = processed.slice(0, maxInputChars);
    warnings.push(`Input truncated to ${maxInputChars} characters`);
  }
  
  return { rendered: processed, warnings };
}

// Validate formula and return detailed errors
export function validateFormula(
  formula: string,
  columns: Column[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Parse the formula
  const parsed = parseFormula(formula);
  
  if ('error' in parsed) {
    errors.push(parsed.error);
    return { valid: false, errors, warnings };
  }
  
  // Create column name map
  const columnsByName = new Map(columns.map(col => [col.name, col]));
  
  // Extract placeholders and check if columns exist
  const placeholders = extractPlaceholders(parsed.template);
  
  for (const placeholder of placeholders) {
    if (!columnsByName.has(placeholder)) {
      warnings.push(`Column "${placeholder}" not found - will use empty value`);
    }
  }
  
  // Validate options if present
  if (parsed.options) {
    if (parsed.options.temperature !== undefined) {
      if (parsed.options.temperature < 0 || parsed.options.temperature > 1) {
        errors.push('Temperature must be between 0 and 1');
      }
    }
    
    if (parsed.options.maxTokens !== undefined) {
      if (parsed.options.maxTokens < 1) {
        errors.push('Max tokens must be at least 1');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Extract placeholder names from template
export function extractPlaceholders(template: string): string[] {
  const placeholders: string[] = [];
  
  // Remove escaped braces first
  const processed = template.replace(ESCAPED_BRACE_PATTERN, '');
  
  // Extract all placeholders
  let match;
  while ((match = PLACEHOLDER_PATTERN.exec(processed)) !== null) {
    placeholders.push(match[1].trim());
  }
  
  // Reset regex state
  PLACEHOLDER_PATTERN.lastIndex = 0;
  
  return [...new Set(placeholders)]; // Remove duplicates
}

// Format formula for display
export function formatFormula(formula: string): string {
  const parsed = parseFormula(formula);
  
  if ('error' in parsed) {
    return formula;
  }
  
  let formatted = `=AI("${parsed.template}"`;
  
  if (parsed.options) {
    formatted += `, ${JSON.stringify(parsed.options, null, 2)}`;
  }
  
  formatted += ')';
  
  return formatted;
}

// Generate example formula
export function generateExampleFormula(columns: Column[]): string {
  if (columns.length === 0) {
    return '=AI("Generate a summary")';
  }
  
  const textColumns = columns.filter(col => col.kind === 'text');
  
  if (textColumns.length === 0) {
    return '=AI("Generate a summary")';
  }
  
  if (textColumns.length === 1) {
    return `=AI("Summarize {{${textColumns[0].name}}}")`;
  }
  
  return `=AI("Combine {{${textColumns[0].name}}} with {{${textColumns[1].name}}}")`;
}