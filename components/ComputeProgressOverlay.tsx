'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { clsx } from 'clsx';

export default function ComputeProgressOverlay() {
  const store = useStore();
  const { isComputing, computeProgress, currentSheet } = store;
  const [showDetails, setShowDetails] = useState(false);
  
  // Get active compute column
  const activeColumnId = useMemo(() => {
    if (!isComputing) return null;
    return Object.keys(computeProgress).find(
      id => computeProgress[id] && computeProgress[id].running > 0
    );
  }, [isComputing, computeProgress]);
  
  const activeColumn = useMemo(() => {
    if (!activeColumnId || !currentSheet) return null;
    return currentSheet.columns.find(c => c.id === activeColumnId);
  }, [activeColumnId, currentSheet]);
  
  const progress = useMemo(() => {
    if (!activeColumnId) return null;
    return computeProgress[activeColumnId];
  }, [activeColumnId, computeProgress]);
  
  const progressPercent = useMemo(() => {
    if (!progress || progress.total === 0) return 0;
    return Math.round(((progress.done + progress.failed) / progress.total) * 100);
  }, [progress]);
  
  // Estimated time remaining
  const [startTime, setStartTime] = useState<number | null>(null);
  const [estimatedRemaining, setEstimatedRemaining] = useState<string>('');
  
  useEffect(() => {
    if (isComputing && !startTime) {
      setStartTime(Date.now());
    } else if (!isComputing) {
      setStartTime(null);
      setEstimatedRemaining('');
    }
  }, [isComputing, startTime]);
  
  useEffect(() => {
    if (!startTime || !progress) return;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const completed = progress.done + progress.failed;
      if (completed > 0) {
        const avgTimePerItem = elapsed / completed;
        const remaining = progress.queued + progress.running;
        const estimatedMs = avgTimePerItem * remaining;
        
        if (estimatedMs < 60000) {
          setEstimatedRemaining(`~${Math.ceil(estimatedMs / 1000)}s remaining`);
        } else {
          setEstimatedRemaining(`~${Math.ceil(estimatedMs / 60000)}m remaining`);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [startTime, progress]);
  
  if (!isComputing || !progress || !activeColumn) return null;
  
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Main overlay card */}
      <div className="absolute bottom-8 right-8 w-96 pointer-events-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div className="absolute inset-0 animate-ping">
                    <svg className="w-5 h-5 text-white opacity-30" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    </svg>
                  </div>
                </div>
                <span className="font-semibold">Computing {activeColumn.name}</span>
              </div>
              <button
                onClick={() => store.stopCompute()}
                className="text-white/80 hover:text-white transition-colors"
                title="Stop computation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Progress stats */}
          <div className="p-4">
            {/* Main progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {progressPercent}% Complete
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {estimatedRemaining}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden relative">
                {/* Animated background stripes */}
                <div className="absolute inset-0 opacity-20">
                  <div className="h-full w-[200%] bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
                </div>
                <div className="h-full flex relative">
                  <div 
                    className="bg-green-500 transition-all duration-500 ease-out"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                  <div 
                    className="bg-blue-500 transition-all duration-500 ease-out relative overflow-hidden"
                    style={{ width: `${(progress.running / progress.total) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                  <div 
                    className="bg-red-500 transition-all duration-500 ease-out"
                    style={{ width: `${(progress.failed / progress.total) * 100}%` }}
                  />
                  <div 
                    className="bg-gray-300 dark:bg-gray-600 transition-all duration-500 ease-out"
                    style={{ width: `${(progress.queued / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Status grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Processing</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{progress.running}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Queued</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{progress.queued}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{progress.done}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{progress.failed}</div>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => store.stopCompute()}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium text-sm"
              >
                Stop Processing
              </button>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                {showDetails ? 'Hide' : 'Show'} Details
              </button>
            </div>
            
            {/* Detailed stats */}
            {showDetails && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                  <div>Total rows: {progress.total}</div>
                  <div>Concurrency: {store.settings.concurrency} parallel requests</div>
                  <div>Model: {activeColumn.ai?.modelId || store.settings.defaultModelId}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Optional subtle backdrop */}
      <div className="absolute inset-0 bg-black/5 dark:bg-black/10 pointer-events-none" />
    </div>
  );
}