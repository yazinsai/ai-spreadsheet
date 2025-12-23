// OpenRouter AI integration for LLM calls
// Alternative: Consider using Vercel AI SDK for streaming support

import type { ComputeTask, ComputeResult, OpenRouterModel } from './types';
import pLimit from 'p-limit';

// OpenRouter API configuration
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

// Get API key from environment
function getApiKey(): string {
  if (typeof window === 'undefined') {
    return process.env.OPENROUTER_API_KEY || '';
  }
  // In browser, we'll need to pass this from a server endpoint
  // For now, using localStorage as a workaround
  return localStorage.getItem('OPENROUTER_API_KEY') || '';
}

// Main AI completion function
export async function getCompletion(
  task: ComputeTask,
  signal?: AbortSignal
): Promise<ComputeResult> {
  const apiKey = getApiKey();
  console.log('getCompletion called, API key present:', !!apiKey);
  
  if (!apiKey) {
    console.error('No API key found in localStorage');
    return {
      rowId: task.rowId,
      columnId: task.columnId,
      value: '',
      error: 'OpenRouter API key not configured. Please add your API key in Settings (gear icon in header).',
    };
  }

  // Skip empty prompts (per spec)
  if (!task.prompt.trim()) {
    return {
      rowId: task.rowId,
      columnId: task.columnId,
      value: '',
    };
  }

  const request: OpenRouterRequest = {
    model: task.modelId,
    messages: [
      {
        role: 'user',
        content: task.prompt,
      },
    ],
    temperature: task.temperature,
    max_tokens: task.maxTokens,
    stream: false,
  };

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'AI Sheet',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message if parsing fails
      }

      return {
        rowId: task.rowId,
        columnId: task.columnId,
        value: '',
        error: errorMessage,
      };
    }

    const data: OpenRouterResponse = await response.json();

    // Check for API errors in response
    if (data.error) {
      return {
        rowId: task.rowId,
        columnId: task.columnId,
        value: '',
        error: data.error.message || 'Unknown API error',
      };
    }

    // Extract content from response
    const content = data.choices?.[0]?.message?.content || '';
    
    return {
      rowId: task.rowId,
      columnId: task.columnId,
      value: content.trim(),
    };
  } catch (error) {
    // Handle network errors and aborts
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          rowId: task.rowId,
          columnId: task.columnId,
          value: '',
          error: 'Request cancelled',
        };
      }
      
      return {
        rowId: task.rowId,
        columnId: task.columnId,
        value: '',
        error: error.message,
      };
    }

    return {
      rowId: task.rowId,
      columnId: task.columnId,
      value: '',
      error: 'Unknown error occurred',
    };
  }
}

// Batch completion with concurrency control
export async function batchCompletions(
  tasks: ComputeTask[],
  concurrency: number,
  onProgress: (result: ComputeResult) => void,
  signal?: AbortSignal,
  onTaskStart?: (task: ComputeTask) => void
): Promise<ComputeResult[]> {
  console.log(`batchCompletions called with ${tasks.length} tasks, concurrency: ${concurrency}`);
  
  const limit = pLimit(concurrency);
  console.log('p-limit initialized successfully');
  
  const results = await Promise.all(
    tasks.map((task) =>
      limit(async () => {
        if (signal?.aborted) {
          return {
            rowId: task.rowId,
            columnId: task.columnId,
            value: '',
            error: 'Batch cancelled',
          };
        }
        
        // Notify that task is starting
        if (onTaskStart) {
          console.log('Task starting:', task.rowId);
          onTaskStart(task);
        }
        
        const result = await getCompletion(task, signal);
        console.log('Task completed:', task.rowId, result.error ? 'with error' : 'successfully');
        onProgress(result);
        return result;
      })
    )
  );
  
  return results;
}

// Model availability check (optional enhancement)
export async function checkModelAvailability(): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return false;

  try {
    // OpenRouter doesn't have a models endpoint publicly documented
    // This is a placeholder for potential future API
    // For now, we assume all models in our list are available
    return true;
  } catch {
    return false;
  }
}

// API key validation
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

// Store API key in browser (temporary solution)
export function setApiKey(apiKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('OPENROUTER_API_KEY', apiKey);
  }
}

// Clear stored API key
export function clearApiKey(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('OPENROUTER_API_KEY');
  }
}

// Fetch available models from OpenRouter API (no auth required)
export async function fetchModelsFromAPI(
  signal?: AbortSignal
): Promise<OpenRouterModel[]> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.data || [];
}