'use client';

// React Data Grid wrapper with custom header context menu
// Alternative: Consider AG Grid Community for more advanced features

import React, { useMemo, useCallback, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { DataGrid } from 'react-data-grid';
import type { 
  Column as RDGColumn,
  RenderHeaderCellProps,
  RenderCellProps,
} from 'react-data-grid';
import { clsx } from 'clsx';
import { useStore } from '@/lib/store';

// Grid styles
import 'react-data-grid/lib/styles.css';

interface GridRow {
  id: string;
  [key: string]: string | number | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  columnId: string;
}

interface CellContextMenuState {
  x: number;
  y: number;
  rowId: string;
  columnId: string;
}

// Custom header cell with context menu and double-click for AI columns
function HeaderCell({ 
  column, 
  onContextMenu,
  onDoubleClick 
}: RenderHeaderCellProps<GridRow> & { 
  onContextMenu: (e: React.MouseEvent, columnId: string) => void;
  onDoubleClick: (columnId: string) => void;
}) {
  const store = useStore();
  const col = store.currentSheet?.columns.find(c => c.id === column.key);
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, column.key);
  };
  
  const handleDoubleClick = () => {
    // Only open formula editor for AI columns
    if (col?.kind === 'ai') {
      onDoubleClick(column.key);
    }
  };
  
  return (
    <div 
      className={clsx(
        "flex items-center justify-between w-full h-full",
        col?.kind === 'ai' && "cursor-pointer bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
      )}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      title={col?.kind === 'ai' ? 'Double-click to edit formula' : undefined}
    >
      <span className="truncate font-medium pl-2">{column.name}</span>
      {col?.kind === 'ai' && (
        <span className="mr-2 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full inline-flex items-center gap-1 font-semibold">
          AI
        </span>
      )}
    </div>
  );
}

// Popover component that renders through a Portal
function CellPopover({ 
  show, 
  content, 
  targetElement,
  onMouseEnter,
  onMouseLeave 
}: { 
  show: boolean;
  content: string;
  targetElement: HTMLElement | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  React.useEffect(() => {
    if (show && targetElement) {
      const updatePosition = () => {
        const rect = targetElement.getBoundingClientRect();
        
        // Calculate position relative to viewport
        let x = rect.left;
        let y = rect.bottom + 5;
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Estimate popover dimensions
        const popoverWidth = Math.min(384, viewportWidth - 20); // max-w-md is 384px
        const popoverMaxHeight = 300;
        
        // Adjust horizontal position to keep popover in viewport
        if (x + popoverWidth > viewportWidth - 10) {
          x = Math.max(10, viewportWidth - popoverWidth - 10);
        }
        if (x < 10) {
          x = 10;
        }
        
        // Check if there's enough space below
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (spaceBelow < popoverMaxHeight + 10 && spaceAbove > spaceBelow) {
          // Show above if more space there
          y = Math.max(10, rect.top - 5);
          // Adjust the popover to appear above, growing upward
          const availableHeight = rect.top - 10;
          if (availableHeight < popoverMaxHeight) {
            // Position at top of screen if not enough space above
            y = 10;
          } else {
            // Position above the cell
            y = rect.top - Math.min(popoverMaxHeight, availableHeight) - 5;
          }
        }
        
        setPosition({ x, y });
      };
      
      updatePosition();
      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [show, targetElement]);
  
  if (!show || !content || typeof document === 'undefined') return null;
  
  return ReactDOM.createPortal(
    <div
      className="fixed z-[99999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-3 max-w-md pointer-events-auto"
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        maxHeight: '300px',
        overflowY: 'auto',
        wordBreak: 'break-word'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{content}</div>
    </div>,
    document.body
  );
}

// Custom cell renderer with state indicators and context menu
function Cell({ 
  row, 
  column,
  onContextMenu 
}: RenderCellProps<GridRow> & {
  onContextMenu?: (e: React.MouseEvent, rowId: string, columnId: string) => void;
}) {
  const store = useStore();
  const sheetRow = store.currentSheet?.rows.find(r => r.id === row.id);
  const col = store.currentSheet?.columns.find(c => c.id === column.key);
  const cellMeta = sheetRow?.meta?.[column.key];
  
  const [showPopover, setShowPopover] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  
  const cellValue = row[column.key];
  
  
  const handleMouseEnter = useCallback(() => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Set timeout for 1 second
    hoverTimeoutRef.current = setTimeout(() => {
      // Check if text is truncated when about to show popover
      if (!textRef.current || textRef.current.scrollWidth <= textRef.current.clientWidth) {
        return;
      }
      
      if (cellRef.current) {
        setTargetElement(cellRef.current);
        setShowPopover(true);
      }
    }, 1000);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    // Clear timeout if mouse leaves before 1 second
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setShowPopover(false);
  }, []);
  
  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);
  
  const getCellClassName = () => {
    if (!cellMeta) return '';
    
    switch (cellMeta.state) {
      case 'queued':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'running':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'done':
        return col?.kind === 'ai' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : '';
      default:
        return '';
    }
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    // Only show context menu for AI columns
    if (col?.kind === 'ai' && onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, row.id, column.key);
    }
  };
  
  return (
    <>
      <div 
        ref={cellRef}
        className={clsx(
          'w-full h-full flex items-center relative',
          getCellClassName(),
          col?.kind === 'ai' && 'cursor-context-menu'
        )}
        title={cellMeta?.error || (col?.kind === 'ai' && !cellValue ? 'Right-click for options' : undefined)}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span ref={textRef} className="truncate flex-1 pl-2">{cellValue}</span>
        
        {/* Status indicators */}
        {cellMeta?.state === 'queued' && (
          <div className="pr-2 flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" opacity="0.3"/>
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span className="text-xs">Queued</span>
          </div>
        )}
        
        {cellMeta?.state === 'running' && (
          <div className="pr-2 flex items-center gap-1">
            <div className="relative">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <div className="absolute inset-0 w-3 h-3 border-2 border-blue-300 rounded-full opacity-30 animate-ping" />
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Processing...</span>
          </div>
        )}
        
        {cellMeta?.state === 'error' && (
          <div 
            className="pr-2 flex items-center gap-1 text-red-500 cursor-help" 
            title={cellMeta.error || 'Error computing cell'}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Failed</span>
          </div>
        )}
        
        {cellMeta?.state === 'done' && col?.kind === 'ai' && cellValue && (
          <div className="pr-2 text-green-500">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
      
      <CellPopover
        show={showPopover}
        content={String(cellValue ?? '')}
        targetElement={targetElement}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={handleMouseLeave}
      />
    </>
  );
}

export default function Grid() {
  const store = useStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [cellContextMenu, setCellContextMenu] = useState<CellContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cellMenuRef = useRef<HTMLDivElement>(null);
  
  // Handle cell selection
  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    store.setSelectedCell({ rowId, columnId });
  }, [store]);
  
  // Convert sheet data to grid format
  const rows: GridRow[] = useMemo(() => {
    if (!store.currentSheet) return [];
    
    return store.currentSheet.rows.map(row => {
      const gridRow: GridRow = { id: row.id };
      
      store.currentSheet!.columns.forEach(col => {
        const value = row.values[col.id];
        gridRow[col.id] = value === null || value === undefined ? '' : String(value);
      });
      
      return gridRow;
    });
  }, [store.currentSheet]);
  
  // Handler for double-clicking AI column headers
  const handleColumnDoubleClick = useCallback((columnId: string) => {
    const column = store.currentSheet?.columns.find(c => c.id === columnId);
    if (column && column.kind === 'ai') {
      store.openFormulaEditor(column);
    }
  }, [store]);
  
  // Handler for cell context menu
  const handleCellContextMenu = useCallback((e: React.MouseEvent, rowId: string, columnId: string) => {
    setCellContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowId,
      columnId,
    });
    // Close column context menu if open
    setContextMenu(null);
  }, []);
  
  // Define columns for react-data-grid
  const columns: RDGColumn<GridRow>[] = useMemo(() => {
    if (!store.currentSheet) return [];
    
    return store.currentSheet.columns.map(col => ({
      key: col.id,
      name: col.name,
      resizable: true,
      editable: col.kind !== 'ai', // AI columns should not be directly editable
      width: 200,
      minWidth: 100,
      maxWidth: 500,
      renderHeaderCell: (props) => (
        <HeaderCell 
          {...props} 
          onContextMenu={(e, colId) => {
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              columnId: colId,
            });
          }}
          onDoubleClick={handleColumnDoubleClick}
        />
      ),
      // Use custom renderCell for all columns to handle selection
      renderCell: (props) => (
        <div 
          onClick={() => handleCellClick(props.row.id, props.column.key)}
          className="w-full h-full"
        >
          <Cell {...props} onContextMenu={handleCellContextMenu} />
        </div>
      ),
    }));
  }, [store.currentSheet, handleColumnDoubleClick, handleCellContextMenu, handleCellClick]);
  
  // Handle cell edits
  const handleRowsChange = useCallback((newRows: GridRow[], { indexes }: { indexes: number[] }) => {
    const sheet = store.currentSheet;
    if (!sheet) return;
    
    // Process only the changed rows
    indexes.forEach(index => {
      const newRow = newRows[index];
      const oldRow = rows[index];
      
      if (!oldRow || !newRow) return;
      
      // Find which column changed
      for (const col of sheet.columns) {
        // Skip AI columns as they shouldn't be directly editable
        if (col.kind === 'ai') continue;
        
        if (newRow[col.id] !== oldRow[col.id]) {
          // Update the cell value
          const value = newRow[col.id];
          store.updateCell(
            newRow.id,
            col.id,
            value === '' ? null : value
          );
        }
      }
    });
  }, [store, rows]);
  
  // Context menu actions
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu) return;
    
    const column = store.currentSheet?.columns.find(c => c.id === contextMenu.columnId);
    if (!column) return;
    
    switch (action) {
      case 'add':
        const name = prompt('Enter column name:');
        if (name) {
          store.addColumn(name, 'text', contextMenu.columnId);
        }
        break;
        
      case 'rename':
        const newName = prompt('Enter new name:', column.name);
        if (newName && newName !== column.name) {
          store.updateColumn(contextMenu.columnId, { name: newName });
        }
        break;
        
      case 'delete':
        if (confirm(`Delete column "${column.name}"?`)) {
          store.deleteColumn(contextMenu.columnId);
        }
        break;
        
      case 'convert':
        store.convertToAIColumn(contextMenu.columnId);
        store.openFormulaEditor(
          store.currentSheet!.columns.find(c => c.id === contextMenu.columnId)!
        );
        break;
        
      case 'edit':
        if (column.kind === 'ai') {
          store.openFormulaEditor(column);
        }
        break;
        
      case 'compute':
        store.startCompute(contextMenu.columnId).catch(err => {
          console.error('Failed to start compute:', err);
        });
        break;
        
      case 'retry':
        store.startCompute(contextMenu.columnId, true).catch(err => {
          console.error('Failed to start retry compute:', err);
        });
        break;
        
      case 'recompute':
        store.startCompute(contextMenu.columnId, false, true).catch(err => {
          console.error('Failed to start recompute all:', err);
        });
        break;
        
      case 'stop':
        store.stopCompute();
        break;
    }
    
    setContextMenu(null);
  }, [contextMenu, store]);
  
  // Cell context menu actions
  const handleCellContextMenuAction = useCallback(async (action: string) => {
    if (!cellContextMenu) return;
    
    const column = store.currentSheet?.columns.find(c => c.id === cellContextMenu.columnId);
    if (!column || column.kind !== 'ai') return;
    
    switch (action) {
      case 'compute-cell':
        // Compute single cell
        await store.computeSingleCell(cellContextMenu.rowId, cellContextMenu.columnId);
        break;
        
      case 'clear-cell':
        // Clear cell value and state
        store.updateCell(cellContextMenu.rowId, cellContextMenu.columnId, '');
        store.updateCellState(cellContextMenu.rowId, cellContextMenu.columnId, 'idle');
        break;
        
      case 'retry-cell':
        // Retry if failed
        const row = store.currentSheet?.rows.find(r => r.id === cellContextMenu.rowId);
        if (row?.meta?.[cellContextMenu.columnId]?.state === 'error') {
          await store.computeSingleCell(cellContextMenu.rowId, cellContextMenu.columnId);
        }
        break;
    }
    
    setCellContextMenu(null);
  }, [cellContextMenu, store]);
  
  // Close context menus on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
      if (cellMenuRef.current && !cellMenuRef.current.contains(e.target as Node)) {
        setCellContextMenu(null);
      }
    };
    
    if (contextMenu || cellContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu, cellContextMenu]);
  
  if (!store.currentSheet) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No sheet loaded. Import a CSV or create a new sheet to get started.
      </div>
    );
  }
  
  const contextColumn = contextMenu 
    ? store.currentSheet.columns.find(c => c.id === contextMenu.columnId)
    : null;
  
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0" style={{ contain: 'size' }}>
        <DataGrid
          columns={columns}
          rows={rows}
          onRowsChange={handleRowsChange}
          className="rdg-light"
          style={{ height: '100%', width: '100%' }}
          rowHeight={35}
          headerRowHeight={40}
          enableVirtualization
        />
      </div>
      
      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            onClick={() => handleContextMenuAction('add')}
          >
            Add Column
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            onClick={() => handleContextMenuAction('rename')}
          >
            Rename
          </button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
            onClick={() => handleContextMenuAction('delete')}
          >
            Delete
          </button>
          
          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
          
          {contextColumn?.kind !== 'ai' ? (
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
              onClick={() => handleContextMenuAction('convert')}
            >
              Convert to AI Column
            </button>
          ) : (
            <>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                onClick={() => handleContextMenuAction('edit')}
              >
                Edit Formula (or double-click header)
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                onClick={() => handleContextMenuAction('compute')}
              >
                Compute Unprocessed
              </button>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                onClick={() => handleContextMenuAction('retry')}
              >
                Retry Failed
              </button>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                onClick={() => handleContextMenuAction('recompute')}
                title="Recompute all cells including completed ones"
              >
                Recompute All
              </button>
              {store.isComputing && (
                <button
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-red-600 dark:text-red-400"
                  onClick={() => handleContextMenuAction('stop')}
                >
                  Stop
                </button>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Cell Context Menu */}
      {cellContextMenu && (() => {
        const cellRow = store.currentSheet?.rows.find(r => r.id === cellContextMenu.rowId);
        const cellColumn = store.currentSheet?.columns.find(c => c.id === cellContextMenu.columnId);
        const cellMeta = cellRow?.meta?.[cellContextMenu.columnId];
        
        if (!cellColumn || cellColumn.kind !== 'ai') return null;
        
        return (
          <div
            ref={cellMenuRef}
            className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-50"
            style={{ left: cellContextMenu.x, top: cellContextMenu.y }}
          >
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              Cell: {cellColumn.name}
            </div>
            
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-900 dark:text-gray-100"
              onClick={() => handleCellContextMenuAction('compute-cell')}
              disabled={cellMeta?.state === 'running'}
            >
              {cellMeta?.state === 'running' ? 'Computing...' : 'Compute This Cell'}
            </button>
            
            {cellMeta?.state === 'error' && (
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-orange-600 dark:text-orange-400"
                onClick={() => handleCellContextMenuAction('retry-cell')}
              >
                Retry (Failed)
              </button>
            )}
            
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-red-600 dark:text-red-400"
              onClick={() => handleCellContextMenuAction('clear-cell')}
            >
              Clear Cell
            </button>
            
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            
            <button
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-blue-600 dark:text-blue-400"
              onClick={() => {
                setCellContextMenu(null);
                store.startCompute(cellContextMenu.columnId);
              }}
            >
              Compute Entire Column
            </button>
          </div>
        );
      })()}
    </div>
  );
}