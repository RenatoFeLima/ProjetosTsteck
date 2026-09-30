"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SellerOption = { id: string; name: string; active: boolean };

type Props = {
  /** id do campo de busca (para o <label htmlFor>). */
  inputId?: string;
  /** Todos os cadastros de vendedor, inclusive inativos. */
  sellers: SellerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Vínculos que já existem no banco: um vendedor inativo só pode CONTINUAR
   *  vinculado (aparece com "(inativo)"), nunca ser escolhido como novo. */
  linkedIds?: string[];
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

/** Busca sem diferenciar maiúsculas nem acentos ("erica" encontra "ÉRICA"). */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Seleção múltipla de vendedores: chips removíveis + busca digitável com lista
 * (combobox/listbox). Teclado: ↑/↓ navegam, Enter seleciona, Esc fecha a lista,
 * Backspace com a busca vazia remove o último chip. Só apresentação: a regra
 * real (existência, inativos, mínimo de 1) é validada no servidor.
 */
export function SellerMultiSelect({ inputId, sellers, value, onChange, linkedIds = [], disabled, invalid, describedBy }: Props) {
  const listboxId = useId();
  const optionPrefix = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const byId = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);
  // Cadastro ainda não carregado (a lista chega depois de abrir o diálogo): nunca
  // exibe o ID cru — mostra "Carregando…" até o nome chegar.
  const selected = value.map((id) => byId.get(id) ?? { id, name: "Carregando…", active: true });

  const options = useMemo(() => {
    const q = normalize(query);
    return sellers
      .filter((s) => !value.includes(s.id))
      .filter((s) => s.active || linkedIds.includes(s.id))
      .filter((s) => !q || normalize(s.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [sellers, value, linkedIds, query]);

  const activeIndex = Math.min(highlight, Math.max(options.length - 1, 0));

  function add(id: string) {
    onChange([...value, id]);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setHighlight(Math.min(activeIndex + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      // Nunca envia o formulário a partir da busca.
      event.preventDefault();
      if (open && options[activeIndex]) add(options[activeIndex].id);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    } else if (event.key === "Backspace" && !query && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  const label = (s: SellerOption) => (s.active ? s.name : `${s.name} (inativo)`);

  return (
    <div className="min-w-0">
      <div
        className={cn(
          "flex min-h-[42px] w-full min-w-0 flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2 py-1.5 transition-all dark:bg-panel-soft",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10",
          invalid ? "border-red-300 dark:border-red-700/60" : "border-zinc-200 dark:border-white/10",
          disabled && "cursor-not-allowed opacity-60",
        )}
        onMouseDown={(event) => {
          // Clique na área vazia foca a busca (sem roubar o clique dos chips).
          if (event.target === event.currentTarget) {
            event.preventDefault();
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
      >
        {selected.map((s) => (
          <span
            key={s.id}
            className={cn(
              "inline-flex max-w-full min-w-0 items-center gap-1 rounded-lg py-1 pr-1 pl-2 text-[12px] font-medium",
              s.active
                ? "bg-zinc-100 text-zinc-800 dark:bg-white/8 dark:text-zinc-200"
                : "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
            )}
          >
            <span className="min-w-0 truncate" title={label(s)}>{label(s)}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => remove(s.id)}
              aria-label={`Remover ${s.name}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:hover:bg-white/10 dark:hover:text-zinc-100"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <span className="flex min-w-[9rem] flex-1 items-center gap-1.5 px-1">
          <Search size={13} className="shrink-0 text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={open && options[activeIndex] ? `${optionPrefix}-${options[activeIndex].id}` : undefined}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            disabled={disabled}
            value={query}
            placeholder="Buscar vendedor..."
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
            className="h-7 w-full min-w-0 bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-foreground dark:placeholder:text-zinc-600"
          />
        </span>
      </div>

      {open && !disabled && (
        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-label="Vendedores disponíveis"
          // No fluxo (não absoluto): dentro do diálogo com rolagem própria a lista
          // nunca fica cortada, inclusive a 390px.
          className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-panel"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-zinc-500 dark:text-zinc-400">Nenhum vendedor encontrado.</li>
          ) : (
            options.map((s, index) => (
              <li
                key={s.id}
                id={`${optionPrefix}-${s.id}`}
                role="option"
                aria-selected={false}
                // mousedown (e não click): escolhe antes do blur fechar a lista.
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(s.id);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-2 text-[13px] break-words text-zinc-800 dark:text-zinc-200 pointer-coarse:py-3",
                  index === activeIndex && "bg-zinc-100 dark:bg-white/8",
                )}
              >
                {label(s)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
