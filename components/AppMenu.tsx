'use client';

import React, { useState, useRef, useEffect } from 'react';

type MenuItem = 
  | {
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      shortcut?: string;
      divider?: never;
    }
  | {
      divider: true;
      label?: never;
      onClick?: never;
      disabled?: never;
      shortcut?: never;
    };

interface AppMenuProps {
  onNewSheet: () => void;
  onImportCSV: () => void;
  onExportCSV: () => void;
  onExportMeta: () => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onSettings: () => void;
  currentSheet: boolean;
}

export default function AppMenu({
  onNewSheet,
  onImportCSV,
  onExportCSV,
  onExportMeta,
  onAddRow,
  onAddColumn,
  onSettings,
  currentSheet
}: AppMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleImportClick = () => {
    onImportCSV();
    setIsOpen(false);
  };

  const menuItems: MenuItem[] = [
    { label: 'New Sheet', onClick: () => { onNewSheet(); setIsOpen(false); }, shortcut: 'Ctrl+N' },
    { label: 'Import CSV...', onClick: handleImportClick, shortcut: 'Ctrl+O' },
    { divider: true } as MenuItem,
    { label: 'Export as CSV', onClick: () => { onExportCSV(); setIsOpen(false); }, disabled: !currentSheet, shortcut: 'Ctrl+S' },
    { label: 'Export Metadata', onClick: () => { onExportMeta(); setIsOpen(false); }, disabled: !currentSheet },
    { divider: true } as MenuItem,
    { label: 'Add Row', onClick: () => { onAddRow(); setIsOpen(false); }, disabled: !currentSheet, shortcut: 'Ctrl+Shift+R' },
    { label: 'Add Column', onClick: () => { onAddColumn(); setIsOpen(false); }, disabled: !currentSheet, shortcut: 'Ctrl+Shift+C' },
    { divider: true } as MenuItem,
    { label: 'Settings...', onClick: () => { onSettings(); setIsOpen(false); }, shortcut: 'Ctrl+,' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        aria-label="Application menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
          {menuItems.map((item, index) => {
            if (item.divider) {
              return <div key={index} className="my-1 border-t border-gray-200 dark:border-gray-700" />;
            }

            return (
              <button
                key={index}
                onClick={item.onClick}
                disabled={item.disabled}
                className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between group
                  ${item.disabled 
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700'
                  } transition-colors`}
              >
                <span className={!item.disabled ? 'group-hover:text-blue-600 dark:group-hover:text-blue-400' : ''}>{item.label}</span>
                {item.shortcut && (
                  <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                    {item.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}