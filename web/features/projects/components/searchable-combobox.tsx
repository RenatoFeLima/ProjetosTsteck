"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

type ComboboxOption = {
  value: string;
  label?: string;
};

type SearchableComboboxProps = {
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  ariaLabel: string;
  error?: string;
  disabled?: boolean;
};

const ITEM_HEIGHT = 42;
const MAX_HEIGHT = 320;

function normalizeLabel(value: string): string {
  const keepLower = new Set(["de", "da", "do", "dos", "das", "e", "ao"]);
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((token, index) => {
      if (index > 0 && keepLower.has(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");
}

function matchText(text: string, query: string): boolean {
  return text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function highlightLabel(label: string, query: string) {
  if (!query.trim()) return label;
  const source = label.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  const start = source.indexOf(needle);
  if (start === -1) return label;

  const end = start + query.length;
  return (
    <>
      {label.slice(0, start)}
      <span className="bg-brand/10 text-brand">{label.slice(start, end)}</span>
      {label.slice(end)}
    </>
  );
}

export function SearchableCombobox({
  value,
  options,
  onChange,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado.",
  ariaLabel,
  error,
  disabled,
}: SearchableComboboxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const safeOptions = useMemo(
    () =>
      options.map((option) => ({
        value: option.value,
        label: option.label ?? normalizeLabel(option.value),
      })),
    [options],
  );

  const selectedOption = useMemo(
    () => safeOptions.find((option) => option.value === value),
    [safeOptions, value],
  );

  const filtered = useMemo(
    () =>
      safeOptions.filter(
        (option) => matchText(option.label, query) || matchText(option.value, query),
      ),
    [safeOptions, query],
  );

  const listHeight = Math.min(MAX_HEIGHT, Math.max(filtered.length * ITEM_HEIGHT, ITEM_HEIGHT));
  const visibleCount = Math.max(Math.ceil(listHeight / ITEM_HEIGHT), 1);
  const startIndex = Math.max(Math.floor(scrollTop / ITEM_HEIGHT) - 4, 0);
  const endIndex = Math.min(startIndex + visibleCount + 8, filtered.length);
  const virtualSlice = filtered.slice(startIndex, endIndex);

  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", closeOnOutside);
    return () => window.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rootRect) return;
    const roomBelow = window.innerHeight - rootRect.bottom;
    setOpenUpwards(roomBelow < 360 && rootRect.top > roomBelow);

    window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
  }, [open]);

  function openDropdown() {
    setQuery("");
    setScrollTop(0);
    const selectedIdx = safeOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  }

  useEffect(() => {
    if (!open || !listRef.current) return;

    const targetTop = activeIndex * ITEM_HEIGHT;
    const targetBottom = targetTop + ITEM_HEIGHT;
    const viewTop = listRef.current.scrollTop;
    const viewBottom = viewTop + listRef.current.clientHeight;

    if (targetTop < viewTop) {
      listRef.current.scrollTop = targetTop;
      return;
    }

    if (targetBottom > viewBottom) {
      listRef.current.scrollTop = targetBottom - listRef.current.clientHeight;
    }
  }, [activeIndex, open]);

  function select(option: ComboboxOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      setActiveIndex((idx) => Math.min(idx + 1, filtered.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((idx) => Math.max(idx - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = filtered[activeIndex];
      if (target) select(target);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
          error ? "border-brand" : "border-line hover:border-zinc-300"
        } ${disabled ? "cursor-not-allowed bg-zinc-100 text-zinc-500" : ""}`}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            return;
          }
          openDropdown();
        }}
      >
        <span className={selectedOption ? "text-zinc-800" : "text-zinc-500"}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className="ml-2 inline-flex items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpar selecao"
              className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
                setQuery("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange("");
                  setQuery("");
                }
              }}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className={`text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {error && <p className="mt-1 text-xs font-medium text-brand">{error}</p>}

      {open && (
        <div
          className={`absolute z-[80] mt-2 w-full rounded-xl border border-line bg-white shadow-[0_16px_30px_-18px_rgba(0,0,0,0.35)] ${openUpwards ? "bottom-[calc(100%+8px)] mt-0" : "top-full"}`}
        >
          <div className="border-b border-zinc-100 p-2">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-line bg-zinc-50 pr-2 pl-8 text-sm outline-none transition focus:border-brand focus:bg-white"
                role="combobox"
                aria-label={searchPlaceholder}
                aria-autocomplete="list"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls="searchable-listbox"
              />
            </label>
          </div>

          <div
            ref={listRef}
            role="listbox"
            id="searchable-listbox"
            className="overflow-y-auto"
            style={{ maxHeight: `${MAX_HEIGHT}px`, height: `${listHeight}px` }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          >
            {filtered.length === 0 ? (
              <div className="grid h-full place-items-center px-3 text-sm text-zinc-500">{emptyMessage}</div>
            ) : (
              <div style={{ height: filtered.length * ITEM_HEIGHT, position: "relative" }}>
                {virtualSlice.map((option, idx) => {
                  const realIndex = startIndex + idx;
                  const selected = option.value === value;
                  const active = realIndex === activeIndex;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`absolute right-2 left-2 flex h-10 items-center justify-between rounded-lg px-2.5 text-sm transition ${
                        selected
                          ? "bg-brand/10 font-semibold text-brand"
                          : active
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                      style={{ top: realIndex * ITEM_HEIGHT }}
                      onMouseEnter={() => setActiveIndex(realIndex)}
                      onClick={() => select(option)}
                    >
                      <span>{highlightLabel(option.label, query)}</span>
                      {selected && <Check size={14} className="text-brand" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
