'use client';

// Compute controls with progress bar and action buttons
// Alternative: Consider using a dedicated progress library like nprogress

import React, { useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { batchCompletions } from '@/lib/ai';
import { parseFormula, renderTemplate } from '@/lib/formula';
import type { ComputeTask } from '@/lib/types';
import { clsx } from 'clsx';

interface ComputeControlsProps {
  columnId: string;
}

export default function ComputeControls({ columnId }: ComputeControlsProps) {
  const store = useStore();
  const { currentSheet, computeProgress, isComputing, settings } = store;
  
  const column = currentSheet?.columns.find(c => c.id === columnId);
  
  const progress = useMemo(() => 
    computeProgress[columnId] || {
      total: 0,
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
    }, [computeProgress, columnId]);
  
  const progressPercent = useMemo(() => {
    if (progress.total === 0) return 0;
    return Math.round(((progress.done + progress.failed) / progress.total) * 100);
  }, [progress.total, progress.done, progress.failed]);
  
  const handleCompute = useCallback(async (retry = false) => {
    console.log('Starting compute for column:', columnId, { retry, column });
    
    if (!currentSheet || !column || column.kind !== 'ai' || !column.formula) {
      console.error('Cannot compute - missing requirements:', { currentSheet: !!currentSheet, column, formula: column?.formula });
      return;
    }
    
    // Parse formula
    const parsed = parseFormula(column.formula);
    if ('error' in parsed) {
      alert(`Invalid formula: ${parsed.error}`);
      return;
    }
    console.log('Parsed formula:', parsed);
    
    // Prepare column map
    const columnsByName = new Map(currentSheet.columns.map(col => [col.name, col]));
    
    // Build compute tasks
    const tasks: ComputeTask[] = [];
    const rowsToCompute = retry
      ? currentSheet.rows.filter(row => row.meta?.[columnId]?.state === 'error')
      : currentSheet.rows;
    
    for (const row of rowsToCompute) {
      // Set initial state
      store.updateCellState(row.id, columnId, 'queued');
      
      // Render template
      const { rendered } = renderTemplate(
        parsed.template,
        row,
        columnsByName,
        settings.maxInputChars
      );
      
      // Skip empty prompts
      if (!rendered.trim()) {
        store.updateCell(row.id, columnId, '');
        store.updateCellState(row.id, columnId, 'done');
        continue;
      }
      
      tasks.push({
        rowId: row.id,
        columnId,
        prompt: rendered,
        modelId: parsed.options?.model || column.ai?.modelId || settings.defaultModelId,
        temperature: parsed.options?.temperature ?? column.ai?.temperature ?? settings.defaultTemperature,
        maxTokens: parsed.options?.maxTokens ?? column.ai?.maxTokens ?? settings.defaultMaxTokens,
      });
    }
    
    if (tasks.length === 0) {
      console.log('No tasks to compute');
      return;
    }
    
    console.log(`Starting compute with ${tasks.length} tasks`, tasks.slice(0, 3)); // Log first 3 tasks
    
    // Start compute
    store.startCompute(columnId, retry);
    
    // Process tasks with concurrency control
    try {
      await batchCompletions(
        tasks,
        settings.concurrency,
        (result) => {
          // Get current progress state from store
          const currentProgress = store.computeProgress[columnId] || { 
            total: 0, queued: 0, running: 0, done: 0, failed: 0 
          };
          
          // Update cell with result
          if (result.error) {
            store.updateCellState(result.rowId, result.columnId, 'error', result.error);
            store.updateComputeProgress(columnId, {
              failed: currentProgress.failed + 1,
              running: Math.max(0, currentProgress.running - 1),
            });
          } else {
            store.updateCell(result.rowId, result.columnId, result.value);
            store.updateCellState(result.rowId, result.columnId, 'done');
            store.updateComputeProgress(columnId, {
              done: currentProgress.done + 1,
              running: Math.max(0, currentProgress.running - 1),
            });
          }
          
          // Auto-save periodically
          const totalProcessed = currentProgress.done + currentProgress.failed + 1;
          if (totalProcessed % 10 === 0) {
            store.saveSheet();
          }
        },
        store.abortController?.signal,
        (task) => {
          // Task is starting - move from queued to running
          const currentProgress = store.computeProgress[columnId] || { 
            total: 0, queued: 0, running: 0, done: 0, failed: 0 
          };
          store.updateCellState(task.rowId, task.columnId, 'running');
          store.updateComputeProgress(columnId, {
            running: currentProgress.running + 1,
            queued: Math.max(0, currentProgress.queued - 1),
          });
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Compute was stopped
        console.log('Compute stopped by user');
      } else {
        console.error('Compute error:', error);
        alert(`Compute failed: ${(error as Error).message}`);
      }
    } finally {
      store.stopCompute();
      store.saveSheet();
    }
  }, [currentSheet, column, columnId, settings, store]);
  
  if (!column || column.kind !== 'ai') {
    return null;
  }
  
  return (
    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="font-medium text-gray-900">
            {column.name}
          </h3>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleCompute(false)}
              disabled={isComputing}
              className={clsx(
                'px-3 py-1 rounded text-sm font-medium',
                isComputing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              )}
            >
              Compute All
            </button>
            
            {progress.failed > 0 && (
              <button
                onClick={() => handleCompute(true)}
                disabled={isComputing}
                className={clsx(
                  'px-3 py-1 rounded text-sm font-medium',
                  isComputing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                )}
              >
                Retry Failed ({progress.failed})
              </button>
            )}
            
            {isComputing && (
              <button
                onClick={() => store.stopCompute()}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
              >
                Stop
              </button>
            )}
          </div>
        </div>
        
        {/* Progress Info */}
        {progress.total > 0 && (
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{progressPercent}%</span>
              {' • '}
              {progress.running > 0 && (
                <span className="text-blue-600">
                  {progress.running} running
                </span>
              )}
              {progress.running > 0 && progress.queued > 0 && ' • '}
              {progress.queued > 0 && (
                <span className="text-yellow-600">
                  {progress.queued} queued
                </span>
              )}
              {(progress.running > 0 || progress.queued > 0) && ' • '}
              {progress.done > 0 && (
                <span className="text-green-600">
                  {progress.done} done
                </span>
              )}
              {progress.failed > 0 && (
                <span className="text-red-600">
                  {' • '}{progress.failed} failed
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Progress Bar */}
      {progress.total > 0 && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div className="h-full flex">
            <div 
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
            <div 
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${(progress.failed / progress.total) * 100}%` }}
            />
            <div 
              className="bg-blue-500 animate-pulse transition-all duration-300"
              style={{ width: `${(progress.running / progress.total) * 100}%` }}
            />
            <div 
              className="bg-yellow-500 transition-all duration-300"
              style={{ width: `${(progress.queued / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}