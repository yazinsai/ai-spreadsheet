'use client';

// Settings panel for global defaults and API configuration
// Alternative: Consider using a drawer component library for better UX

import React, { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { setApiKey, validateApiKey } from '@/lib/ai';
import { backupDb, storageInfo } from '@/lib/persist';
import ModelSelector from './ModelSelector';
import { clsx } from 'clsx';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: SettingsProps) {
  const store = useStore();
  const { settings } = store;
  
  const [apiKey, setApiKeyState] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidation, setKeyValidation] = useState<'valid' | 'invalid' | null>(null);
  const [storageUsage, setStorageUsage] = useState({ used: 0, quota: 0 });
  
  // Load API key from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('OPENROUTER_API_KEY') || '';
      setApiKeyState(savedKey);
    }
  }, []);
  
  // Load storage info
  useEffect(() => {
    if (isOpen) {
      storageInfo.getUsage().then(setStorageUsage);
    }
  }, [isOpen]);
  
  const handleApiKeyChange = async (key: string) => {
    setApiKeyState(key);
    setKeyValidation(null);
    
    if (key) {
      setIsValidatingKey(true);
      const isValid = await validateApiKey(key);
      setKeyValidation(isValid ? 'valid' : 'invalid');
      setIsValidatingKey(false);
      
      if (isValid) {
        setApiKey(key);
      }
    }
  };
  
  const handleSave = () => {
    if (apiKey) {
      setApiKey(apiKey);
    }
    onClose();
  };
  
  const handleExportBackup = async () => {
    try {
      await backupDb.downloadBackup();
    } catch (error) {
      alert(`Failed to export backup: ${(error as Error).message}`);
    }
  };
  
  const handleImportBackup = async (file: File) => {
    try {
      const content = await file.text();
      await backupDb.import(content);
      alert('Backup imported successfully. Please refresh the page.');
      window.location.reload();
    } catch (error) {
      alert(`Failed to import backup: ${(error as Error).message}`);
    }
  };
  
  const handleReset = async () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      await store.resetSettings();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Settings</h2>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* API Configuration */}
          <div>
            <h3 className="text-lg font-medium mb-4">API Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenRouter API Key
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-or-..."
                  className={clsx(
                    'flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2',
                    keyValidation === 'valid' 
                      ? 'border-green-300 focus:ring-green-500'
                      : keyValidation === 'invalid'
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  )}
                />
                {isValidatingKey && (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                {keyValidation === 'valid' && (
                  <span className="text-green-600">✓</span>
                )}
                {keyValidation === 'invalid' && (
                  <span className="text-red-600">✗</span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Get your API key from{' '}
                <a 
                  href="https://openrouter.ai/keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  OpenRouter
                </a>
              </p>
            </div>
          </div>
          
          {/* Default Model Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4">Default Model Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Model
                </label>
                <ModelSelector
                  value={settings.defaultModelId}
                  onChange={(id) => store.updateSettings({ defaultModelId: id })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Temperature ({settings.defaultTemperature})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.defaultTemperature}
                  onChange={(e) => store.updateSettings({ 
                    defaultTemperature: parseFloat(e.target.value) 
                  })}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Lower = more focused, Higher = more creative
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Max Tokens
                </label>
                <input
                  type="number"
                  min="1"
                  max="4096"
                  value={settings.defaultMaxTokens}
                  onChange={(e) => store.updateSettings({ 
                    defaultMaxTokens: parseInt(e.target.value) || 512 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* Performance Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4">Performance</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Concurrency ({settings.concurrency} parallel requests)
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={settings.concurrency}
                  onChange={(e) => store.updateSettings({ 
                    concurrency: parseInt(e.target.value) 
                  })}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Higher = faster processing but may hit rate limits
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Input Characters (0 = unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={settings.maxInputChars || 0}
                  onChange={(e) => store.updateSettings({ 
                    maxInputChars: parseInt(e.target.value) || 0 
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Truncate rendered prompts to this length (per row)
                </p>
              </div>
            </div>
          </div>
          
          {/* Data Management */}
          <div>
            <h3 className="text-lg font-medium mb-4">Data Management</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Storage: {storageInfo.formatBytes(storageUsage.used)} / {storageInfo.formatBytes(storageUsage.quota)}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ 
                      width: `${storageUsage.quota ? (storageUsage.used / storageUsage.quota) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={handleExportBackup}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Export Backup
                </button>
                
                <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
                  Import Backup
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportBackup(file);
                    }}
                    className="hidden"
                  />
                </label>
                
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Reset Settings
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}