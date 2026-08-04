import React, { useState, useEffect, useRef } from 'react';

interface FileAutocompleteProps {
  files: string[];
  value: string;
  onChange: (value: string) => void;
  triggerChar: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onEnter?: () => void;
}

export const FileAutocomplete: React.FC<FileAutocompleteProps> = ({
  files,
  value,
  onChange,
  triggerChar,
  placeholder,
  className,
  disabled,
  onEnter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredFiles, setFilteredFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setFilteredFiles([...files].sort((a, b) => a.localeCompare(b)));
  }, [files]);

  // Auto-grow del textarea según el contenido
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    onChange(nextValue);

    const cursorPos = e.target.selectionStart || 0;
    const lastTrigger = nextValue.lastIndexOf(triggerChar, cursorPos - 1);

    if (lastTrigger !== -1) {
      const searchTerm = nextValue.slice(lastTrigger + 1, cursorPos);
      if (searchTerm.includes(' ')) {
        setIsOpen(false);
        setTriggerPosition(null);
        return;
      }
      setTriggerPosition(lastTrigger);

      const filtered = files
        .filter((file) => file.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

      setFilteredFiles(filtered);
      setIsOpen(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setIsOpen(false);
      setTriggerPosition(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isOpen && filteredFiles.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredFiles.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredFiles.length) % filteredFiles.length);
          return;
        case 'Tab':
        case 'Enter':
          e.preventDefault();
          selectFile(filteredFiles[selectedIndex]);
          return;
        case 'Escape':
          setIsOpen(false);
          setTriggerPosition(null);
          return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !isOpen && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  const selectFile = (file: string) => {
    if (triggerPosition !== null) {
      const beforeTrigger = value.slice(0, triggerPosition);
      const afterCursor = value.slice(inputRef.current?.selectionStart || value.length);
      onChange(`${beforeTrigger}${triggerChar}${file} ${afterCursor}`);
    }
    setIsOpen(false);
    setTriggerPosition(null);
    inputRef.current?.focus();
  };

  return (
    <div className="relative flex-1">
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`${className} w-full resize-none`}
      />

      {isOpen && filteredFiles.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filteredFiles.map((file, index) => (
            <button
              key={file}
              onClick={() => selectFile(file)}
              className={`w-full text-left px-3 py-2 text-xs font-mono transition ${
                index === selectedIndex
                  ? 'bg-amber-500/20 dark:bg-emerald-500/20 text-amber-700 dark:text-emerald-400'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {triggerChar}
              {file}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
