import React, { useState, useEffect, useRef } from 'react';

interface FileAutocompleteProps {
  files: string[];
  onSelect: (file: string) => void;
  triggerChar: string;
}

export const FileAutocomplete: React.FC<FileAutocompleteProps> = ({ files, onSelect, triggerChar }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sort files alphabetically
    const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
    setFilteredFiles(sortedFiles);
  }, [files]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    // Find the last $ trigger before cursor
    const lastTrigger = value.lastIndexOf(triggerChar, cursorPos);
    
    if (lastTrigger !== -1) {
      const searchTerm = value.slice(lastTrigger + 1, cursorPos);
      setTriggerPosition(lastTrigger);
      
      // Filter files based on search term
      const filtered = files
        .filter(file => file.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
      
      setFilteredFiles(filtered);
      setIsOpen(filtered.length > 0 && searchTerm.length >= 0);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
      setTriggerPosition(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredFiles.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredFiles.length) % filteredFiles.length);
        break;
      case 'Tab':
      case 'Enter':
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          selectFile(filteredFiles[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const selectFile = (file: string) => {
    if (triggerPosition !== null && inputRef.current) {
      const currentValue = inputRef.current.value;
      const beforeTrigger = currentValue.slice(0, triggerPosition);
      const afterCursor = currentValue.slice(inputRef.current.selectionStart || 0);
      const newValue = `${beforeTrigger}$${file} ${afterCursor}`;
      
      onSelect(newValue);
      setIsOpen(false);
      setTriggerPosition(null);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Escribe una consulta... Usa $ para autocompletar archivos"
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 font-mono text-xs text-zinc-100 focus:outline-none focus:border-emerald-500/50"
      />
      
      {isOpen && filteredFiles.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filteredFiles.map((file, index) => (
            <button
              key={file}
              onClick={() => selectFile(file)}
              className={`w-full text-left px-3 py-2 text-xs font-mono transition ${
                index === selectedIndex
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {triggerChar}{file}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};