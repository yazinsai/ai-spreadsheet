// Model fetching and caching service
// Fetches models from OpenRouter API and caches in localStorage

import { fetchModelsFromAPI } from './ai';
import type { OpenRouterModel, ModelOption, CachedModelList } from './types';
import { FALLBACK_MODEL_OPTIONS } from './types';

// Cache configuration
const MODEL_CACHE_KEY = 'OPENROUTER_MODELS_CACHE';
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Format pricing for display
function formatPricing(prompt: string, completion: string): string {
  const promptCost = parseFloat(prompt) * 1_000_000; // Per million tokens
  const completionCost = parseFloat(completion) * 1_000_000;

  if (promptCost === 0 && completionCost === 0) {
    return 'Free';
  }

  // Format to reasonable decimal places
  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`;
    if (cost >= 0.01) return `$${cost.toFixed(3)}`;
    return `$${cost.toFixed(4)}`;
  };

  return `${formatCost(promptCost)}/${formatCost(completionCost)} per 1M`;
}

// Transform API model to display option
function toModelOption(model: OpenRouterModel): ModelOption {
  return {
    id: model.id,
    label: model.name,
    contextLength: model.context_length,
    pricing: formatPricing(model.pricing.prompt, model.pricing.completion),
  };
}

// Get cached models from localStorage (synchronous)
export function getCachedModels(): ModelOption[] | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(MODEL_CACHE_KEY);
    if (!cached) return null;

    const data: CachedModelList = JSON.parse(cached);
    return data.models;
  } catch {
    // Cache corrupted, clear it
    localStorage.removeItem(MODEL_CACHE_KEY);
    return null;
  }
}

// Check if cache is valid (not expired)
function isCacheValid(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const cached = localStorage.getItem(MODEL_CACHE_KEY);
    if (!cached) return false;

    const data: CachedModelList = JSON.parse(cached);
    const now = Date.now();
    return now - data.fetchedAt < MODEL_CACHE_TTL_MS;
  } catch {
    return false;
  }
}

// Save models to cache
function saveToCache(models: ModelOption[]): void {
  if (typeof window === 'undefined') return;

  const data: CachedModelList = {
    models,
    fetchedAt: Date.now(),
  };

  try {
    localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or other error, ignore
    console.warn('Failed to cache models to localStorage');
  }
}

// Main function to fetch models with caching
export async function fetchModels(
  forceRefresh = false,
  signal?: AbortSignal
): Promise<ModelOption[]> {
  // Return cached if valid and not forcing refresh
  if (!forceRefresh && isCacheValid()) {
    const cached = getCachedModels();
    if (cached && cached.length > 0) {
      return cached;
    }
  }

  try {
    // Fetch from API
    const apiModels = await fetchModelsFromAPI(signal);

    // Transform and cache
    const models = apiModels.map(toModelOption);
    saveToCache(models);

    return models;
  } catch (error) {
    // On error, try to return stale cache
    const cached = getCachedModels();
    if (cached && cached.length > 0) {
      console.warn('Using stale cache due to fetch error:', error);
      return cached;
    }

    // Last resort: return fallback models
    console.warn('Using fallback models due to fetch error:', error);
    return FALLBACK_MODEL_OPTIONS;
  }
}

// Find a model by ID (for display purposes when model might not be in list)
export function findModelLabel(models: ModelOption[], modelId: string): string {
  const found = models.find(m => m.id === modelId);
  if (found) return found.label;

  // Not found - return a formatted version of the ID
  // e.g., "openai/gpt-4" -> "openai/gpt-4"
  return modelId;
}
