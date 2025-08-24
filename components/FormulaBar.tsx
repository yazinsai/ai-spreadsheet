'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { clsx } from 'clsx';

export default function FormulaBar() {
  const store = useStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get current cell value and formula
  const currentCell = store.selectedCell;
  const currentColumn = currentCell 
    ? store.currentSheet?.columns.find(c => c.id === currentCell.columnId)
    : null;
  const currentRow = currentCell
    ? store.currentSheet?.rows.find(r => r.id === currentCell.rowId)
    : null;
  
  const cellValue = currentCell && currentRow 
    ? currentRow.values[currentCell.columnId] ?? ''
    : '';
  
  const isAIColumn = currentColumn?.kind === 'ai';
  const formula = isAIColumn && currentColumn.formula ? currentColumn.formula : '';
  
  // Get column letter (A, B, C, etc.) from index
  const getColumnLetter = (columnId: string) => {
    const index = store.currentSheet?.columns.findIndex(c => c.id === columnId);
    if (index === undefined || index === -1) return '';
    return String.fromCharCode(65 + (index % 26)) + (Math.floor(index / 26) > 0 ? Math.floor(index / 26) : '');
  };
  
  // Get row number from index
  const getRowNumber = (rowId: string) => {
    const index = store.currentSheet?.rows.findIndex(r => r.id === rowId);
    if (index === undefined || index === -1) return '';
    return String(index + 1);
  };
  
  const cellAddress = currentCell 
    ? `${getColumnLetter(currentCell.columnId)}${getRowNumber(currentCell.rowId)}`
    : '';
  
  const displayValue = isAIColumn && formula && !isEditing ? formula : cellValue;
  
  // Handle formula bar click to expand
  const handleFormulaBarClick = () => {
    if (isAIColumn && formula) {
      setIsExpanded(true);
      setEditValue(formula);
      setIsEditing(true);
      setTimeout(() => {
        inputRef.current?.focus();
        // Place cursor at the end instead of selecting all
        if (inputRef.current) {
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 0);
    } else if (!isAIColumn && currentCell) {
      setIsEditing(true);
      setEditValue(String(cellValue));
      setTimeout(() => {
        inputRef.current?.focus();
        // Place cursor at the end instead of selecting all
        if (inputRef.current) {
          const length = inputRef.current.value.length;
          inputRef.current.setSelectionRange(length, length);
        }
      }, 0);
    }
  };
  
  // Handle save
  const handleSave = () => {
    if (isAIColumn && currentColumn) {
      // Update formula for AI column
      store.updateColumn(currentColumn.id, { formula: editValue });
    } else if (currentCell) {
      // Update cell value for regular column
      store.updateCell(currentCell.rowId, currentCell.columnId, editValue || null);
    }
    setIsEditing(false);
    setIsExpanded(false);
  };
  
  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setIsExpanded(false);
    setEditValue('');
  };
  
  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };
  
  // Handle compute all for current column
  const handleComputeAll = async () => {
    if (currentColumn && isAIColumn) {
      await store.startCompute(currentColumn.id);
    }
  };
  
  // Check if column is currently computing
  const isComputing = currentColumn && store.computeProgress[currentColumn.id]?.running > 0;
  
  // Remove the auto-select behavior
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // Just focus, don't select all
      inputRef.current.focus();
    }
  }, [isEditing]);
  
  // Reset when selected cell changes
  useEffect(() => {
    setIsEditing(false);
    setIsExpanded(false);
    setEditValue('');
  }, [currentCell?.rowId, currentCell?.columnId]);
  
  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center h-10">
        {/* Cell Address Box */}
        <div className="flex-shrink-0 w-24 h-full border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">
            {cellAddress || '-'}
          </span>
        </div>
        
        {/* Formula/Value Bar */}
        <div className="flex-1 h-full flex items-center px-2 relative">
          {!isEditing ? (
            <div 
              className={clsx(
                "flex-1 h-full flex items-center cursor-text px-2",
                isAIColumn && formula && "text-blue-600 dark:text-blue-400"
              )}
              onClick={handleFormulaBarClick}
            >
              <span className={clsx(
                "text-sm font-mono truncate",
                !displayValue && "text-gray-400 dark:text-gray-500"
              )}>
                {displayValue || (isAIColumn ? 'Click to edit AI formula' : 'Select a cell')}
              </span>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className={clsx(
                "flex-1 font-mono text-sm border-0 outline-none resize-none p-2 bg-transparent text-gray-900 dark:text-gray-100",
                isExpanded ? "absolute top-0 left-0 right-0 z-10 bg-white dark:bg-gray-800 border border-blue-500 rounded shadow-lg min-h-[120px]" : ""
              )}
              style={isExpanded ? { height: 'auto', minHeight: '120px' } : { height: '100%' }}
              placeholder={isAIColumn ? '=AI("Your prompt with {{ColumnName}} references")' : 'Enter value'}
            />
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex-shrink-0 flex items-center px-2 gap-2">
          {isEditing && (
            <>
              <button
                onClick={handleCancel}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Cancel (Esc)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={handleSave}
                className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                title="Save (Enter)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </>
          )}
          
          {/* Compute All Button - Only visible for AI columns */}
          {isAIColumn && !isEditing && currentColumn && (
            <button
              onClick={handleComputeAll}
              disabled={isComputing || !formula}
              className={clsx(
                "px-3 py-1 text-xs font-medium rounded transition-colors",
                isComputing 
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : !formula
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
              title={isComputing ? "Computing..." : !formula ? "Add formula first" : "Compute all cells in this column"}
            >
              {isComputing ? (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Computing...
                </span>
              ) : (
                'Compute All'
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Progress indicator for computing */}
      {isComputing && currentColumn && store.computeProgress[currentColumn.id] && (
        <div className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-700 dark:text-blue-300">
              Computing: {store.computeProgress[currentColumn.id].done}/{store.computeProgress[currentColumn.id].total}
            </span>
            {store.computeProgress[currentColumn.id].failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {store.computeProgress[currentColumn.id].failed} failed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}