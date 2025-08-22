// Dexie (IndexedDB) persistence layer for offline storage
// Alternative: Consider using localStorage for smaller datasets (<5MB)

import Dexie, { type Table } from 'dexie';
import type { Sheet, Settings } from './types';

// Database schema definition
class AISheetDatabase extends Dexie {
  sheets!: Table<Sheet>;
  settings!: Table<Settings & { id: string }>;

  constructor() {
    super('ai-sheet');
    
    // Version 1: Initial schema
    this.version(1).stores({
      sheets: 'id, name, updatedAt',
      settings: 'id'
    });

    // Version 2: Example migration (for future use)
    // this.version(2).stores({
    //   sheets: 'id, name, updatedAt, createdAt'
    // }).upgrade(tx => {
    //   return tx.sheets.toCollection().modify(sheet => {
    //     sheet.createdAt = sheet.createdAt || Date.now();
    //   });
    // });
  }
}

// Singleton database instance
export const db = new AISheetDatabase();

// Default settings factory
export const DEFAULT_SETTINGS: Settings = {
  defaultModelId: 'google/gemini-2.5-flash',
  defaultTemperature: 1,
  defaultMaxTokens: 2048,
  concurrency: 4,
  maxInputChars: 0, // 0 = unlimited
};

// Settings management
export const settingsDb = {
  async get(): Promise<Settings> {
    const settings = await db.settings.get('default');
    return settings || DEFAULT_SETTINGS;
  },

  async update(updates: Partial<Settings>): Promise<void> {
    const current = await this.get();
    await db.settings.put({
      ...current,
      ...updates,
      id: 'default'
    });
  },

  async reset(): Promise<void> {
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      id: 'default'
    });
  }
};

// Sheet operations with batched writes for performance
export const sheetDb = {
  async get(id: string): Promise<Sheet | undefined> {
    return db.sheets.get(id);
  },

  async getAll(): Promise<Sheet[]> {
    return db.sheets.orderBy('updatedAt').reverse().toArray();
  },

  async create(sheet: Omit<Sheet, 'createdAt' | 'updatedAt' | 'version'>): Promise<Sheet> {
    const now = Date.now();
    const newSheet: Sheet = {
      ...sheet,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    await db.sheets.add(newSheet);
    return newSheet;
  },

  async update(id: string, updates: Partial<Sheet>): Promise<void> {
    await db.sheets.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  },

  async delete(id: string): Promise<void> {
    await db.sheets.delete(id);
  },

  // Batch update for performance when computing many cells
  async batchUpdateRows(sheetId: string, rows: Sheet['rows']): Promise<void> {
    await db.transaction('rw', db.sheets, async () => {
      const sheet = await db.sheets.get(sheetId);
      if (sheet) {
        await db.sheets.update(sheetId, {
          rows,
          updatedAt: Date.now()
        });
      }
    });
  }
};

// Database backup and restore utilities
export const backupDb = {
  async export(): Promise<string> {
    const sheets = await db.sheets.toArray();
    const settings = await db.settings.toArray();
    
    const backup = {
      version: '1.0.0',
      exportedAt: Date.now(),
      data: {
        sheets,
        settings
      }
    };
    
    return JSON.stringify(backup, null, 2);
  },

  async import(jsonString: string): Promise<void> {
    try {
      const backup = JSON.parse(jsonString);
      
      // Validate backup structure
      if (!backup.data || !backup.version) {
        throw new Error('Invalid backup format');
      }

      // Clear existing data
      await db.transaction('rw', db.sheets, db.settings, async () => {
        await db.sheets.clear();
        await db.settings.clear();
        
        // Import sheets
        if (backup.data.sheets?.length > 0) {
          await db.sheets.bulkAdd(backup.data.sheets);
        }
        
        // Import settings
        if (backup.data.settings?.length > 0) {
          await db.settings.bulkAdd(backup.data.settings);
        }
      });
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw new Error('Failed to import backup: ' + (error as Error).message);
    }
  },

  async downloadBackup(): Promise<void> {
    const backup = await this.export();
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-sheet-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Storage size monitoring
export const storageInfo = {
  async getUsage(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { used: 0, quota: 0 };
  },

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};