'use client';

// Main application page with header, grid, and modals
// Alternative: Consider using a layout system like react-mosaic for resizable panels

import React, { useState, useEffect, useRef } from 'react';
import { useStore, initializeApp } from '@/lib/store';
import { 
  importCSV, 
  parseFullCSV, 
  downloadCSV, 
  downloadMetadata,
  validateCSVFile 
} from '@/lib/csv';
import { sheetDb } from '@/lib/persist';
import Grid from '@/components/Grid';
import FormulaBar from '@/components/FormulaBar';
import FormulaEditor from '@/components/FormulaEditor';
import Settings from '@/components/Settings';
import AppMenu from '@/components/AppMenu';
import ComputeProgressOverlay from '@/components/ComputeProgressOverlay';

export default function Home() {
  const store = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [recentSheets, setRecentSheets] = useState<Array<{ id: string; name: string }>>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize app on mount
  useEffect(() => {
    initializeApp();
    loadRecentSheets();
  }, []);
  
  const loadRecentSheets = async () => {
    const sheets = await sheetDb.getAll();
    setRecentSheets(sheets.slice(0, 5).map(s => ({ id: s.id, name: s.name })));
  };
  
  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file
    const validation = validateCSVFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    
    setIsImporting(true);
    setImportProgress(0);
    
    try {
      // First, get a preview
      const preview = await importCSV(file, (percent) => {
        setImportProgress(Math.round(percent * 0.3)); // 30% for preview
      });
      
      // Confirm import
      const confirmed = confirm(
        `Import CSV with ${preview.headers.length} columns and ${preview.totalRows} rows?\n\n` +
        `Headers: ${preview.headers.slice(0, 5).join(', ')}${preview.headers.length > 5 ? '...' : ''}`
      );
      
      if (!confirmed) {
        setIsImporting(false);
        return;
      }
      
      // Parse full CSV
      const sheetName = file.name.replace(/\.[^/.]+$/, '');
      const sheet = await parseFullCSV(file, sheetName, (percent) => {
        setImportProgress(30 + Math.round(percent * 0.7)); // 70% for full parse
      });
      
      // Save to database
      await sheetDb.create(sheet);
      
      // Load the sheet
      store.loadSheet(sheet.id);
      
      // Refresh recent sheets
      loadRecentSheets();
    } catch (error) {
      alert(`Failed to import CSV: ${(error as Error).message}`);
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleNewSheet = async () => {
    const name = prompt('Enter sheet name:');
    if (name) {
      await store.createSheet(name);
      loadRecentSheets();
    }
  };
  
  const handleExportCSV = () => {
    if (!store.currentSheet) return;
    downloadCSV(store.currentSheet);
  };
  
  const handleExportMetadata = () => {
    if (!store.currentSheet) return;
    downloadMetadata(store.currentSheet);
  };
  
  const handleAddRow = () => {
    store.addRow();
  };
  
  const handleAddColumn = () => {
    const name = prompt('Enter column name:');
    if (name) {
      store.addColumn(name, 'text');
    }
  };
  
  const handleStartEditName = () => {
    if (store.currentSheet) {
      setEditedName(store.currentSheet.name);
      setIsEditingName(true);
      setTimeout(() => {
        nameInputRef.current?.select();
      }, 0);
    }
  };
  
  const handleSaveName = async () => {
    if (store.currentSheet && editedName.trim() && editedName !== store.currentSheet.name) {
      store.updateSheet({ name: editedName.trim() });
      await store.saveSheet();
      loadRecentSheets();
    }
    setIsEditingName(false);
  };
  
  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <AppMenu
                onNewSheet={handleNewSheet}
                onImportCSV={handleImportCSV}
                onExportCSV={handleExportCSV}
                onExportMeta={handleExportMetadata}
                onAddRow={handleAddRow}
                onAddColumn={handleAddColumn}
                onSettings={() => setIsSettingsOpen(true)}
                currentSheet={!!store.currentSheet}
              />
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                AI Sheet
              </h1>
            </div>
            
            {store.currentSheet && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-300 dark:text-gray-600">|</span>
                {isEditingName ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveName();
                      } else if (e.key === 'Escape') {
                        handleCancelEditName();
                      }
                    }}
                    onBlur={handleSaveName}
                    className="text-sm font-medium bg-transparent border-b-2 border-blue-500 text-gray-900 dark:text-gray-100 outline-none px-1"
                    autoFocus
                  />
                ) : (
                  <h2 
                    className="text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    onClick={handleStartEditName}
                    title="Click to rename"
                  >
                    {store.currentSheet.name}
                  </h2>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {store.currentSheet.rows.length} × {store.currentSheet.columns.length}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center">
            {/* Just empty space or you can add other elements here */}
          </div>
        </div>
        
        {/* Import Progress */}
        {isImporting && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Importing CSV...</span>
              <span>{importProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}
      </header>
      
      {/* Formula Bar */}
      {store.currentSheet && <FormulaBar />}
      
      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {store.currentSheet ? (
          <Grid />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                Welcome to AI Sheet
              </h2>
              <p className="text-gray-600 mb-8 max-w-md">
                Import a CSV file or create a new sheet to get started.
                Add AI-powered columns to generate content using your data.
              </p>
              
              <div className="flex flex-col items-center space-y-4">
                <div className="flex space-x-4">
                  <button
                    onClick={handleNewSheet}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create New Sheet
                  </button>
                  
                  <label className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
                    Import CSV
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isImporting}
                    />
                  </label>
                </div>
                
                {recentSheets.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Recent Sheets
                    </h3>
                    <div className="space-y-1">
                      {recentSheets.map(sheet => (
                        <button
                          key={sheet.id}
                          onClick={() => store.loadSheet(sheet.id)}
                          className="block w-full px-4 py-2 text-left text-sm bg-white border border-gray-200 rounded hover:bg-gray-50"
                        >
                          {sheet.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isImporting}
      />
      
      {/* Modals */}
      <FormulaEditor />
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Progress Overlay */}
      <ComputeProgressOverlay />
    </div>
  );
}