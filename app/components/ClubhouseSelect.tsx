"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import type { ComponentProps, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ClubhouseOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type MobilePresentation = "auto" | "popover" | "sheet";
type Placement = "top" | "bottom" | "sheet";

type OverlayPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: Placement;
};

const VIEWPORT_PADDING = 12;
const OPTION_ROW_HEIGHT = 44;

function useOverlayPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  optionCount: number,
  presentation: MobilePresentation,
  extraHeight = 0,
) {
  const [position, setPosition] = useState<OverlayPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const gap = 6;
    const desiredHeight = Math.min(460, Math.max(112, optionCount * OPTION_ROW_HEIGHT + extraHeight + 20));
    const availableBelow = Math.max(0, viewportBottom - rect.bottom - VIEWPORT_PADDING - gap);
    const availableAbove = Math.max(0, rect.top - viewportTop - VIEWPORT_PADDING - gap);
    const shouldUseSheet = presentation === "sheet" || (
      presentation === "auto" && (viewportWidth <= 640 || (viewportWidth <= 900 && viewportHeight <= 540) || Math.max(availableBelow, availableAbove) < 132)
    );

    if (shouldUseSheet) {
      const maxHeight = Math.min(560, Math.max(224, viewportHeight - VIEWPORT_PADDING * 2));
      setPosition({
        top: viewportTop + Math.max(VIEWPORT_PADDING, viewportHeight - maxHeight - VIEWPORT_PADDING),
        left: viewportLeft + 8,
        width: Math.max(0, viewportWidth - 16),
        maxHeight,
        placement: "sheet",
      });
      return;
    }

    const placement: Placement = availableBelow >= desiredHeight || availableBelow >= availableAbove ? "bottom" : "top";
    const availableHeight = placement === "bottom" ? availableBelow : availableAbove;
    const maxHeight = Math.max(112, Math.min(460, availableHeight));
    const menuHeight = Math.min(desiredHeight, maxHeight);
    const width = Math.min(Math.max(rect.width, 212), viewportWidth - VIEWPORT_PADDING * 2);
    const left = Math.min(Math.max(rect.left, viewportLeft + VIEWPORT_PADDING), viewportRight - width - VIEWPORT_PADDING);
    const candidateTop = placement === "bottom" ? rect.bottom + gap : rect.top - menuHeight - gap;
    const top = Math.min(Math.max(candidateTop, viewportTop + VIEWPORT_PADDING), viewportBottom - menuHeight - VIEWPORT_PADDING);
    setPosition({ top, left, width, maxHeight, placement });
  }, [extraHeight, optionCount, presentation, triggerRef]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("orientationchange", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("orientationchange", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open, updatePosition]);

  return { position, updatePosition };
}

function ClubhouseOverlay({
  position,
  title,
  ariaLabel,
  className = "",
  onDismiss,
  children,
}: {
  position: OverlayPosition;
  title?: string;
  ariaLabel: string;
  className?: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const overlayRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dismissOnOutsidePress = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && overlayRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", dismissOnOutsidePress);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePress);
  }, [onDismiss]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {position.placement === "sheet" && (
        <button className="clubhouse-option-overlay__scrim" type="button" aria-label={`Close ${ariaLabel}`} onClick={onDismiss} />
      )}
      <section
        ref={overlayRef}
        className={["clubhouse-option-overlay", className].filter(Boolean).join(" ")}
        data-placement={position.placement}
        role="dialog"
        aria-label={ariaLabel}
        style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
      >
        {position.placement === "sheet" && title && (
          <header className="clubhouse-option-overlay__sheet-head">
            <strong>{title}</strong>
            <button type="button" onClick={onDismiss} aria-label={`Close ${title}`}><X size={17} aria-hidden="true" /></button>
          </header>
        )}
        {children}
      </section>
    </>,
    document.body,
  );
}

export function ClubhouseSelect({
  label,
  value,
  options,
  onChange,
  className = "",
  disabled = false,
  showSelectedDescription = true,
  placeholder = "Select",
  open: controlledOpen,
  onOpenChange,
  mobilePresentation = "auto",
  searchable = false,
  searchPlaceholder = "Search options...",
  sheetTitle,
  "aria-label": ariaLabel,
}: {
  label?: string;
  value: string;
  options: ClubhouseOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  showSelectedDescription?: boolean;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mobilePresentation?: MobilePresentation;
  searchable?: boolean;
  searchPlaceholder?: string;
  sheetTitle?: string;
  "aria-label"?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const reactId = useId();
  const listboxId = `clubhouse-select-${reactId.replace(/[^a-z0-9_-]/gi, "")}`;
  const open = controlledOpen ?? internalOpen;
  const selected = options.find((option) => option.value === value);
  const query = search.trim().toLowerCase();
  const visibleOptions = useMemo(() => query
    ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query))
    : options, [options, query]);
  const { position, updatePosition } = useOverlayPosition(buttonRef, open, visibleOptions.length, mobilePresentation, searchable ? 64 : 0);

  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    setSearch("");
    if (returnFocus) window.setTimeout(() => buttonRef.current?.focus(), 0);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (rootRef.current?.contains(target) || listRef.current?.contains(target))) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open || !position) return;
    const frame = window.requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, position, searchable]);

  function focusOption(index: number) {
    const optionsInList = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    optionsInList[Math.max(0, Math.min(optionsInList.length - 1, index))]?.focus();
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const optionsInList = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = Math.max(0, optionsInList.findIndex((button) => button === document.activeElement));
    if (event.key === "ArrowDown") { event.preventDefault(); focusOption(index + 1); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusOption(index - 1); }
    if (event.key === "Home") { event.preventDefault(); focusOption(0); }
    if (event.key === "End") { event.preventDefault(); focusOption(optionsInList.length - 1); }
  }

  return (
    <div ref={rootRef} className={["choice-select", "clubhouse-select", open ? "open" : "", className].filter(Boolean).join(" ")} data-empty={!selected ? "true" : undefined}>
      {label && <span className="choice-select__label">{label}</span>}
      <button
        ref={buttonRef}
        type="button"
        className="choice-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => { updatePosition(); setOpen(!open); }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            updatePosition();
            setOpen(true);
          }
        }}
      >
        {selected?.icon && <span className="choice-select__icon">{selected.icon}</span>}
        <strong>
          {selected?.label ?? placeholder}
          {showSelectedDescription && selected?.description && <small>{selected.description}</small>}
        </strong>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && position && !disabled && (
        <ClubhouseOverlay position={position} title={sheetTitle ?? label ?? ariaLabel} ariaLabel={ariaLabel ?? label ?? "Options"} onDismiss={() => close()} className={`${className} clubhouse-option-overlay--select`}>
          {searchable && (
            <label className="clubhouse-option-overlay__search">
              <Search size={15} aria-hidden="true" />
              <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
            </label>
          )}
          <div ref={listRef} id={listboxId} className="clubhouse-option-overlay__list" role="listbox" tabIndex={-1} aria-label={ariaLabel ?? label} onKeyDown={handleListKeyDown}>
            {visibleOptions.length ? visibleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                className={option.value === value ? "active" : ""}
                onClick={() => { onChange(option.value); close(true); }}
              >
                {option.icon && <span className="choice-select__icon">{option.icon}</span>}
                <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
                {option.value === value && <Check size={16} aria-hidden="true" />}
              </button>
            )) : <p className="clubhouse-option-overlay__empty">No matching options.</p>}
          </div>
        </ClubhouseOverlay>
      )}
    </div>
  );
}

export function ClubhouseSearchSelect(props: Omit<ComponentProps<typeof ClubhouseSelect>, "searchable">) {
  return <ClubhouseSelect {...props} searchable />;
}

export function ClubhouseMultiSelect({
  label,
  values,
  options,
  onApply,
  className = "",
  placeholder = "All",
  searchable = false,
  searchPlaceholder = "Search options...",
  mobilePresentation = "auto",
  "aria-label": ariaLabel,
}: {
  label?: string;
  values: string[];
  options: ClubhouseOption[];
  onApply: (values: string[]) => void;
  className?: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  mobilePresentation?: MobilePresentation;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(values);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const query = search.trim().toLowerCase();
  const visibleOptions = useMemo(() => query
    ? options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query))
    : options, [options, query]);
  const { position, updatePosition } = useOverlayPosition(triggerRef, open, visibleOptions.length, mobilePresentation, searchable ? 116 : 52);
  const selectedLabels = options.filter((option) => values.includes(option.value)).map((option) => option.label);
  const summary = selectedLabels.length === 0 ? placeholder : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    setSearch("");
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open || !position) return;
    const frame = window.requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, position, searchable]);

  return (
    <div className={["choice-select", "clubhouse-select", "clubhouse-multi-select", open ? "open" : "", className].filter(Boolean).join(" ")}>
      {label && <span className="choice-select__label">{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        className="choice-select__button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        onClick={() => { setDraft(values); updatePosition(); setOpen(true); }}
      >
        <strong>{summary}</strong><ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && position && (
        <ClubhouseOverlay position={position} title={label ?? ariaLabel ?? "Options"} ariaLabel={ariaLabel ?? label ?? "Options"} onDismiss={() => close()} className="clubhouse-option-overlay--multi">
          <header className="clubhouse-option-overlay__head">
            {position.placement !== "sheet" && <strong>{label ?? ariaLabel ?? "Options"}</strong>}
            <button type="button" className="text-button" onClick={() => setDraft([])}>Clear</button>
          </header>
          {searchable && <label className="clubhouse-option-overlay__search"><Search size={15} aria-hidden="true" /><input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /></label>}
          <div ref={listRef} className="clubhouse-option-overlay__list" role="listbox" aria-multiselectable="true" aria-label={ariaLabel ?? label}>
            {visibleOptions.length ? visibleOptions.map((option) => {
              const selected = draft.includes(option.value);
              return <button key={option.value} type="button" role="option" aria-selected={selected} className={selected ? "active" : ""} onClick={() => setDraft((current) => selected ? current.filter((item) => item !== option.value) : [...current, option.value])}>
                <span className="clubhouse-option-overlay__checkbox">{selected && <Check size={14} aria-hidden="true" />}</span>
                <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              </button>;
            }) : <p className="clubhouse-option-overlay__empty">No matching options.</p>}
          </div>
          <footer className="clubhouse-option-overlay__actions">
            <button type="button" className="secondary-button" onClick={() => close()}>Cancel</button>
            <button type="button" className="primary-button" onClick={() => { onApply(draft); close(true); }}>Apply{draft.length ? ` (${draft.length})` : ""}</button>
          </footer>
        </ClubhouseOverlay>
      )}
    </div>
  );
}

export function ClubhousePicker(props: Omit<ComponentProps<typeof ClubhouseSelect>, "mobilePresentation">) {
  return <ClubhouseSelect {...props} mobilePresentation="auto" />;
}

export function ClubhouseSegmentedControl<T extends string>({
  values,
  active,
  onChange,
  ariaLabel = "Options",
  formatValue = defaultSegmentLabel,
  className = "",
}: {
  values: readonly T[];
  active: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  formatValue?: (value: T) => string;
  className?: string;
}) {
  return <div className={["segmented-control", "clubhouse-segmented-control", className].filter(Boolean).join(" ")} role="group" aria-label={ariaLabel}>
    {values.map((value) => <button key={value} type="button" className={value === active ? "active" : ""} aria-pressed={value === active} onClick={() => onChange(value)}>{formatValue(value)}</button>)}
  </div>;
}

export function ClubhouseOptionSheet({
  title,
  open,
  onOpenChange,
  trigger,
  children,
  className = "",
  mobilePresentation = "auto",
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  mobilePresentation?: MobilePresentation;
}) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const { position } = useOverlayPosition(triggerRef, open, 7, mobilePresentation, 168);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  return <div ref={triggerRef} className="clubhouse-option-sheet-anchor">
    {trigger}
    {open && position && <ClubhouseOverlay position={position} title={title} ariaLabel={title} className={`clubhouse-option-overlay--context ${className}`} onDismiss={close}>{children}</ClubhouseOverlay>}
  </div>;
}

function defaultSegmentLabel(value: string) {
  return value.replace(/(^|\s|[-_])\w/g, (part) => part.toUpperCase()).replace(/[-_]/g, " ");
}
