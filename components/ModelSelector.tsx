'use client';

// Searchable model selector combobox
// Fetches models from OpenRouter API with caching

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchModels, getCachedModels, findModelLabel } from '@/lib/models';
import { FALLBACK_MODEL_OPTIONS, type ModelOption } from '@/lib/types';
import { clsx } from 'clsx';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function ModelSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [models, setModels] = useState<ModelOption[]>(() => {
    // Initialize with cached models or fallback
    return getCachedModels() || FALLBACK_MODEL_OPTIONS;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter models based on search
  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const lower = search.toLowerCase();
    return models.filter(
      (m) =>
        m.label.toLowerCase().includes(lower) ||
        m.id.toLowerCase().includes(lower)
    );
  }, [models, search]);

  // Get display label for current value
  const displayLabel = useMemo(() => {
    return findModelLabel(models, value);
  }, [models, value]);

  // Load models on mount
  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();

    const loadModels = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetched = await fetchModels(false, abortController.signal);
        if (!cancelled) {
          setModels(fetched);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== 'AbortError') {
          setError('Failed to load models');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredModels.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setSearch('');
      setHighlightedIndex(0);
    }
  }, [disabled]);

  const handleSelect = useCallback(
    (model: ModelOption) => {
      onChange(model.id);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetched = await fetchModels(true); // Force refresh
      setModels(fetched);
    } catch {
      setError('Failed to refresh models');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredModels.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredModels[highlightedIndex]) {
            handleSelect(filteredModels[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [isOpen, filteredModels, highlightedIndex, handleSelect]
  );

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={clsx(
          'w-full px-3 py-2 text-left border rounded-md',
          'flex items-center justify-between gap-2',
          'bg-white dark:bg-gray-800',
          'text-gray-900 dark:text-white',
          'border-gray-300 dark:border-gray-600',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={clsx(
            'w-4 h-4 shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={clsx(
            'absolute z-50 mt-1 w-full min-w-[300px]',
            'bg-white dark:bg-gray-800',
            'border border-gray-300 dark:border-gray-600',
            'rounded-md shadow-lg'
          )}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search models..."
              className={clsx(
                'w-full px-3 py-2 text-sm',
                'bg-gray-50 dark:bg-gray-900',
                'border border-gray-300 dark:border-gray-600',
                'rounded-md',
                'text-gray-900 dark:text-white',
                'placeholder-gray-500 dark:placeholder-gray-400',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <svg
                className="animate-spin h-5 w-5 mx-auto mb-2"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading models...
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-4 text-center">
              <p className="text-red-600 dark:text-red-400 text-sm mb-2">
                {error}
              </p>
              <button
                onClick={handleRefresh}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Model List */}
          {!isLoading && !error && (
            <>
              {filteredModels.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No models found
                </div>
              ) : (
                <ul
                  ref={listRef}
                  className="max-h-60 overflow-auto py-1"
                  role="listbox"
                >
                  {filteredModels.map((model, index) => (
                    <li
                      key={model.id}
                      role="option"
                      aria-selected={model.id === value}
                      onClick={() => handleSelect(model)}
                      className={clsx(
                        'px-3 py-2 cursor-pointer',
                        'flex flex-col',
                        index === highlightedIndex &&
                          'bg-blue-50 dark:bg-blue-900/30',
                        model.id === value &&
                          'bg-blue-100 dark:bg-blue-900/50',
                        index !== highlightedIndex &&
                          model.id !== value &&
                          'hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {model.label}
                        </span>
                        {model.id === value && (
                          <svg
                            className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      {model.pricing && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {model.pricing}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Refresh Button */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className={clsx(
                    'w-full px-3 py-2 text-sm',
                    'flex items-center justify-center gap-2',
                    'text-gray-600 dark:text-gray-400',
                    'hover:bg-gray-50 dark:hover:bg-gray-700',
                    'rounded-md',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <svg
                    className={clsx('w-4 h-4', isLoading && 'animate-spin')}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh models
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
