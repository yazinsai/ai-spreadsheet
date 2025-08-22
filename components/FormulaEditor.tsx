'use client';

// Formula editor modal with live preview and validation
// Alternative: Consider Monaco Editor for syntax highlighting

import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { 
  parseFormula, 
  validateFormula, 
  renderTemplate,
  generateExampleFormula 
} from '@/lib/formula';
import { MODEL_OPTIONS } from '@/lib/types';
import { clsx } from 'clsx';

export default function FormulaEditor() {
  const store = useStore();
  const { editingColumn, currentSheet, isFormulaEditorOpen } = store;
  
  const [formula, setFormula] = useState('');
  const [modelId, setModelId] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(512);
  const [previewRow, setPreviewRow] = useState(0);
  
  // Initialize state when opening
  useEffect(() => {
    if (editingColumn && isFormulaEditorOpen) {
      setFormula(editingColumn.formula || generateExampleFormula(currentSheet?.columns || []));
      setModelId(editingColumn.ai?.modelId || store.settings.defaultModelId);
      setTemperature(editingColumn.ai?.temperature || store.settings.defaultTemperature);
      setMaxTokens(editingColumn.ai?.maxTokens || store.settings.defaultMaxTokens);
      setPreviewRow(0);
    }
  }, [editingColumn, isFormulaEditorOpen, currentSheet, store.settings]);
  
  // Validate formula
  const validation = useMemo(() => {
    if (!formula || !currentSheet) {
      return { valid: false, errors: [], warnings: [] };
    }
    return validateFormula(formula, currentSheet.columns);
  }, [formula, currentSheet]);
  
  // Generate preview
  const preview = useMemo(() => {
    if (!currentSheet || !formula || currentSheet.rows.length === 0) {
      return { rendered: '', warnings: [] };
    }
    
    const parsed = parseFormula(formula);
    if ('error' in parsed) {
      return { rendered: '', warnings: [parsed.error] };
    }
    
    const row = currentSheet.rows[Math.min(previewRow, currentSheet.rows.length - 1)];
    const columnsByName = new Map(currentSheet.columns.map(col => [col.name, col]));
    
    return renderTemplate(
      parsed.template,
      row,
      columnsByName,
      store.settings.maxInputChars
    );
  }, [formula, currentSheet, previewRow, store.settings.maxInputChars]);
  
  const handleSave = () => {
    if (!editingColumn || !validation.valid) return;
    
    // Parse formula to extract options
    const parsed = parseFormula(formula);
    if ('error' in parsed) return;
    
    // Update column with new formula and settings
    store.updateColumn(editingColumn.id, {
      formula,
      ai: {
        modelId: parsed.options?.model || modelId,
        temperature: parsed.options?.temperature ?? temperature,
        maxTokens: parsed.options?.maxTokens ?? maxTokens,
      },
    });
    
    store.closeFormulaEditor();
  };
  
  const handleCancel = () => {
    store.closeFormulaEditor();
  };
  
  if (!isFormulaEditorOpen || !editingColumn || !currentSheet) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">
            Edit AI Formula - {editingColumn.name}
          </h2>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Formula Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formula
            </label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 border rounded-md font-mono text-sm',
                'focus:outline-none focus:ring-2',
                validation.valid 
                  ? 'border-gray-300 focus:ring-blue-500' 
                  : 'border-red-300 focus:ring-red-500'
              )}
              rows={4}
              placeholder='=AI("Generate a summary for {{Column Name}}")'
            />
            
            {/* Validation Messages */}
            {validation.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {validation.errors.map((error, i) => (
                  <p key={i} className="text-sm text-red-600">
                    ❌ {error}
                  </p>
                ))}
              </div>
            )}
            
            {validation.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {validation.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-yellow-600">
                    ⚠️ {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
          
          {/* Model Settings */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {MODEL_OPTIONS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature ({temperature})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                min="1"
                max="4096"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 512)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Preview (Row {previewRow + 1})
              </label>
              {currentSheet.rows.length > 1 && (
                <select
                  value={previewRow}
                  onChange={(e) => setPreviewRow(parseInt(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  {currentSheet.rows.map((_, i) => (
                    <option key={i} value={i}>
                      Row {i + 1}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              {preview.rendered ? (
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {preview.rendered}
                </pre>
              ) : (
                <span className="text-gray-500 text-sm italic">
                  No preview available
                </span>
              )}
            </div>
            
            {preview.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {preview.warnings.map((warning, i) => (
                  <p key={i} className="text-sm text-yellow-600">
                    ⚠️ {warning}
                  </p>
                ))}
              </div>
            )}
          </div>
          
          {/* Help Text */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Formula Syntax:</strong> Use {`{{Column Name}}`} to reference other columns.
              Example: {`=AI("Summarize {{Product}} for {{Customer}}")`}
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Options:</strong> You can override settings in the formula:
              {` =AI("...", {"temperature": 0.5, "maxTokens": 1000, "model": "openai/gpt-4"})`}
            </p>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className={clsx(
              'px-4 py-2 rounded-md text-white',
              validation.valid
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            )}
          >
            Save Formula
          </button>
        </div>
      </div>
    </div>
  );
}