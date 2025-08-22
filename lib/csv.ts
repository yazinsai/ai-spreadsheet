// CSV import/export utilities using PapaParse
// Alternative: Consider using native FileReader API for smaller files

import Papa from 'papaparse';
import { nanoid } from 'nanoid';
import type { Sheet, Column, Row, CSVPreview, SheetMetadata } from './types';

// CSV import with worker mode for large files
export async function importCSV(
  file: File,
  onProgress?: (percent: number) => void
): Promise<CSVPreview> {
  return new Promise((resolve, reject) => {
    let totalRows = 0;
    let headers: string[] = [];
    const previewRows: string[][] = [];
    let delimiter = ',';
    
    Papa.parse(file, {
      worker: true, // Use worker thread for large files
      header: false, // We'll handle headers manually
      dynamicTyping: false, // Keep everything as strings initially
      skipEmptyLines: 'greedy',
      
      step: (results) => {
        if (totalRows === 0 && results.data) {
          // First row is headers
          headers = (results.data as string[]).map(h => String(h).trim());
          delimiter = results.meta.delimiter || ',';
        } else if (totalRows < 51 && results.data) {
          // Collect first 50 data rows for preview
          previewRows.push(results.data as string[]);
        }
        
        totalRows++;
        
        // Report progress
        if (onProgress && results.meta.cursor && file.size > 0) {
          const percent = (results.meta.cursor / file.size) * 100;
          onProgress(Math.min(percent, 99)); // Cap at 99% until complete
        }
        
        // For very large files, we already have enough preview data
      },
      
      complete: () => {
        if (onProgress) onProgress(100);
        
        resolve({
          headers,
          rows: previewRows.slice(0, 50),
          delimiter,
          totalRows: totalRows - 1, // Exclude header row
        });
      },
      
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

// Parse full CSV and convert to Sheet format
export async function parseFullCSV(
  file: File,
  sheetName: string,
  onProgress?: (percent: number) => void
): Promise<Sheet> {
  return new Promise((resolve, reject) => {
    const columns: Column[] = [];
    const rows: Row[] = [];
    let headers: string[] = [];
    let totalRows = 0;
    
    Papa.parse(file, {
      worker: true,
      header: false,
      dynamicTyping: true, // Auto-detect numbers
      skipEmptyLines: 'greedy',
      
      step: (results) => {
        if (totalRows === 0 && results.data) {
          // Process headers
          headers = (results.data as string[]).map(h => String(h).trim());
          
          // Create columns from headers
          headers.forEach((header, index) => {
            columns.push({
              id: nanoid(),
              name: header || `Column ${index + 1}`,
              kind: 'text', // Default to text, can be changed later
            });
          });
        } else if (results.data) {
          // Process data row
          const rowData = results.data as (string | number | null)[];
          const row: Row = {
            id: nanoid(),
            values: {},
          };
          
          columns.forEach((col, index) => {
            if (index < rowData.length) {
              const value = rowData[index];
              // Store as string or number based on type
              row.values[col.id] = 
                value === null || value === undefined || value === '' 
                  ? null 
                  : typeof value === 'number' 
                    ? value 
                    : String(value);
            }
          });
          
          rows.push(row);
        }
        
        totalRows++;
        
        // Report progress
        if (onProgress && results.meta.cursor && file.size > 0) {
          const percent = (results.meta.cursor / file.size) * 100;
          onProgress(Math.min(percent, 99));
        }
      },
      
      complete: () => {
        if (onProgress) onProgress(100);
        
        const now = Date.now();
        resolve({
          id: nanoid(),
          name: sheetName,
          columns,
          rows,
          createdAt: now,
          updatedAt: now,
          version: 1,
        });
      },
      
      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`));
      },
    });
  });
}

// Export sheet to CSV
export function exportToCSV(sheet: Sheet): string {
  // Prepare headers
  const headers = sheet.columns.map(col => col.name);
  
  // Prepare data rows
  const data = sheet.rows.map(row => {
    return sheet.columns.map(col => {
      const value = row.values[col.id];
      
      // For AI columns, use the computed value, not the formula
      if (col.kind === 'ai') {
        return value === null || value === undefined ? '' : String(value);
      }
      
      return value === null || value === undefined ? '' : value;
    });
  });
  
  // Use Papa.unparse to generate CSV
  const csv = Papa.unparse({
    fields: headers,
    data,
  });
  
  return csv;
}

// Export sheet metadata (formulas and configs)
export function exportMetadata(sheet: Sheet): SheetMetadata {
  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    columns: sheet.columns.map(col => ({
      id: col.id,
      name: col.name,
      kind: col.kind,
      formula: col.formula,
      ai: col.ai,
    })),
  };
}

// Download CSV file
export function downloadCSV(sheet: Sheet, filename?: string): void {
  const csv = exportToCSV(sheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename || `${sheet.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Download metadata JSON file
export function downloadMetadata(sheet: Sheet, filename?: string): void {
  const metadata = exportMetadata(sheet);
  const json = JSON.stringify(metadata, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.download = filename || `${sheet.name.replace(/[^a-z0-9]/gi, '_')}_meta_${Date.now()}.json`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Import metadata and apply to sheet
export async function importMetadata(
  metadataFile: File,
  sheet: Sheet
): Promise<Sheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const metadata: SheetMetadata = JSON.parse(content);
        
        // Validate metadata
        if (!metadata.version || !metadata.columns) {
          throw new Error('Invalid metadata format');
        }
        
        // Map metadata to existing columns by name
        const updatedColumns = sheet.columns.map(col => {
          const metaCol = metadata.columns.find(mc => mc.name === col.name);
          
          if (metaCol) {
            return {
              ...col,
              kind: metaCol.kind,
              formula: metaCol.formula,
              ai: metaCol.ai,
            };
          }
          
          return col;
        });
        
        resolve({
          ...sheet,
          columns: updatedColumns,
          updatedAt: Date.now(),
        });
      } catch (error) {
        reject(new Error(`Failed to parse metadata: ${(error as Error).message}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read metadata file'));
    };
    
    reader.readAsText(metadataFile);
  });
}

// Validate CSV file
export function validateCSVFile(file: File): { valid: boolean; error?: string } {
  // Check file extension
  const validExtensions = ['.csv', '.txt'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
  
  if (!hasValidExtension) {
    return {
      valid: false,
      error: 'Please select a CSV file',
    };
  }
  
  // Check file size (limit to 100MB for browser processing)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 100MB limit',
    };
  }
  
  return { valid: true };
}