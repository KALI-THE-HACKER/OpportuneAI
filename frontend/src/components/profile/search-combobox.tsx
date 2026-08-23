import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Search, X, Check, Plus, ChevronDown } from "lucide-react";
import { filterSuggestions } from "@/lib/data/profile-options";

interface SearchComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  label?: string;
}

export function SearchCombobox({
  value,
  onChange,
  options,
  placeholder = "Search or enter value...",
}: SearchComboboxProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const suggestions = filterSuggestions(options, query);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(val: string) {
    setQuery(val);
    onChange(val);
    setIsOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setActiveIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && suggestions.length > 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else {
        onChange(query.trim());
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-9 px-3 pr-8 rounded-lg bg-background border border-input text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all shadow-sm"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`size-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-xl bg-popover border border-border shadow-dropdown p-1 space-y-0.5 text-xs animate-in fade-in-0 zoom-in-95">
          {suggestions.map((option, index) => {
            const isSelected = index === activeIndex;
            const isCurrent = option.toLowerCase() === value.toLowerCase();
            return (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-accent/15 text-accent font-medium"
                    : isCurrent
                      ? "bg-surface font-medium text-foreground"
                      : "text-foreground hover:bg-surface"
                }`}
              >
                <span className="truncate">{option}</span>
                {isCurrent && <Check className="size-3.5 text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MultiSearchComboboxProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: readonly string[];
  placeholder?: string;
}

export function MultiSearchCombobox({
  values,
  onChange,
  options,
  placeholder = "Search and select...",
}: MultiSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = filterSuggestions(options, query, values);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleAdd(val: string) {
    const trimmed = val.trim();
    if (!trimmed) return;
    const lower = new Set(values.map((v) => v.toLowerCase()));
    if (!lower.has(trimmed.toLowerCase())) {
      onChange([...values, trimmed]);
    }
    setQuery("");
    setIsOpen(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  }

  function handleRemove(idx: number) {
    onChange(values.filter((_, i) => i !== idx));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setActiveIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (isOpen && suggestions.length > 0 && activeIndex < suggestions.length) {
        handleAdd(suggestions[activeIndex]);
      } else if (query.trim()) {
        handleAdd(query.trim());
      }
    } else if (e.key === "Backspace" && !query && values.length > 0) {
      handleRemove(values.length - 1);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="space-y-2 w-full">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1.5 min-h-8 p-1.5 rounded-md bg-background/60 ring-1 ring-border/80">
        {values.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs rounded-md bg-accent/10 text-accent ring-1 ring-accent/20 font-medium group transition-all"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(index)}
              title={`Remove ${item}`}
              className="size-3.5 rounded-sm flex items-center justify-center opacity-60 hover:opacity-100 hover:text-destructive transition-opacity"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-xs text-muted-foreground italic py-0.5 px-1 self-center">
            None selected yet.
          </span>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-8.5 pl-8 pr-8 rounded-md bg-background ring-1 ring-border text-xs outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground/60 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div className="relative">
          <div className="absolute z-50 top-1 w-full max-h-52 overflow-y-auto rounded-md bg-popover ring-1 ring-border shadow-lg p-1 space-y-0.5 text-xs animate-in fade-in-0 zoom-in-95">
            {suggestions.length === 0 ? (
              <div className="p-2 text-center text-muted-foreground text-xs">
                {query ? `Press Enter to add "${query.trim()}"` : "No suggestions available."}
              </div>
            ) : (
              suggestions.map((option, index) => {
                const isSelected = index === activeIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAdd(option);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent/15 text-accent font-medium"
                        : "text-foreground hover:bg-surface"
                    }`}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <Plus className="size-3 opacity-60 shrink-0" />
                      {option}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
