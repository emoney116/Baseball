"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useScrollEdges } from "./useScrollEdges";
export type ChoiceOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
};
type ChoiceSelectMobilePresentation = "auto" | "popover" | "sheet";

export function ChoiceSelect({
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
  "aria-label": ariaLabel,
}: {
  label?: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  showSelectedDescription?: boolean;
  placeholder?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mobilePresentation?: ChoiceSelectMobilePresentation;
  "aria-label"?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "top" | "bottom" | "sheet";
  } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const didInitialSelectedScrollRef = useRef(false);
  const selected = options.find((option) => option.value === value);
  const reactId = useId();
  const listboxId = `choice-select-${reactId.replace(/[^a-z0-9_-]/gi, "")}`;
  const open = controlledOpen ?? internalOpen;
  const { edges: menuEdges } = useScrollEdges(menuRef, `${open}-${menuPosition?.top ?? 0}-${menuPosition?.maxHeight ?? 0}-${options.length}-${value}`);
  const setSelectOpen = useCallback((nextOpen: boolean | ((current: boolean) => boolean)) => {
    const resolved = typeof nextOpen === "function" ? nextOpen(open) : nextOpen;
    if (controlledOpen === undefined) setInternalOpen(resolved);
    onOpenChange?.(resolved);
  }, [controlledOpen, onOpenChange, open]);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 6;
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const optionHeight = 44;
    const desiredHeight = Math.min(320, Math.max(96, options.length * optionHeight + 16));
    const availableBelow = Math.max(0, viewportBottom - rect.bottom - viewportPadding - gap);
    const availableAbove = Math.max(0, rect.top - viewportTop - viewportPadding - gap);
    const bestAvailable = Math.max(availableBelow, availableAbove);
    const shouldUseSheet = mobilePresentation === "sheet" || (
      mobilePresentation === "auto" && (viewportWidth <= 640 || (viewportWidth <= 900 && viewportHeight <= 540) || bestAvailable < 132)
    );
    if (shouldUseSheet) {
      const maxHeight = Math.min(320, Math.max(196, viewportHeight - viewportPadding * 2));
      setMenuPosition({
        top: viewportTop + Math.max(viewportPadding, viewportHeight - maxHeight - viewportPadding),
        left: viewportLeft + 8,
        width: viewportWidth - 16,
        maxHeight,
        placement: "sheet",
      });
      return;
    }

    const canFitBelow = availableBelow >= desiredHeight;
    const canFitAbove = availableAbove >= desiredHeight;
    const placement = canFitBelow || (!canFitAbove && availableBelow >= availableAbove) ? "bottom" : "top";
    const availableHeight = placement === "top" ? availableAbove : availableBelow;
    const maxHeight = Math.max(96, Math.min(320, availableHeight));
    const menuHeight = Math.min(desiredHeight, maxHeight);
    const widestOption = Math.min(320, Math.max(180, ...options.map((option) => (option.label.length + (option.description?.length ?? 0) * 0.45) * 7.5 + 42)));
    const width = Math.min(Math.max(rect.width, widestOption), viewportWidth - viewportPadding * 2);
    const left = Math.min(Math.max(rect.left, viewportLeft + viewportPadding), viewportRight - width - viewportPadding);
    const unclampedTop = placement === "top"
      ? rect.top - gap - menuHeight
      : rect.bottom + gap;
    const top = Math.min(
      Math.max(unclampedTop, viewportTop + viewportPadding),
      viewportBottom - menuHeight - viewportPadding,
    );
    setMenuPosition({ top, left, width, maxHeight, placement });
  }, [mobilePresentation, options]);

  const focusOption = useCallback((index?: number) => {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    if (!buttons.length) return;
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const targetIndex = Math.max(0, Math.min(buttons.length - 1, index ?? selectedIndex));
    buttons[targetIndex]?.focus();
    buttons[targetIndex]?.scrollIntoView({ block: "nearest" });
  }, [options, value]);

  const closeMenu = useCallback((returnFocus = false) => {
    setSelectOpen(false);
    if (returnFocus) window.setTimeout(() => buttonRef.current?.focus(), 0);
  }, [setSelectOpen]);

  useEffect(() => {
    if (!open) didInitialSelectedScrollRef.current = false;
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    if (!buttons.length) return;
    const currentIndex = Math.max(0, buttons.findIndex((button) => button === document.activeElement));
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(Math.min(buttons.length - 1, currentIndex + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(Math.max(0, currentIndex - 1));
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      focusOption(buttons.length - 1);
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const currentOption = options[currentIndex];
      if (!currentOption) return;
      onChange(currentOption.value);
      closeMenu(true);
    }
  };

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const animationFrame = window.requestAnimationFrame(updateMenuPosition);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (
        target &&
        (rootRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (
        target &&
        (rootRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }
      closeMenu();
    };
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("orientationchange", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("orientationchange", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [closeMenu, open, updateMenuPosition]);

  useEffect(() => {
    if (!open || !menuPosition || didInitialSelectedScrollRef.current) return;
    didInitialSelectedScrollRef.current = true;
    const animationFrame = window.requestAnimationFrame(() => {
      const selectedButton = menuRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      selectedButton?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [menuPosition, open]);

  const menu = open && !disabled && menuPosition && typeof document !== "undefined"
    ? createPortal(
      <>
        {menuPosition.placement === "sheet" && <div className="choice-select__sheet-scrim" aria-hidden="true" />}
        <div
          ref={menuRef}
          id={listboxId}
          className={[
            "choice-select__menu",
            "choice-select__menu--portal",
            menuEdges.canScrollUp ? "has-scroll-up" : "",
            menuEdges.canScrollDown ? "has-scroll-down" : "",
            className,
          ].filter(Boolean).join(" ")}
          data-placement={menuPosition.placement}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel ?? label}
          onKeyDown={handleMenuKeyDown}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          <span className="choice-select__menu-edge choice-select__menu-edge--top" aria-hidden="true">
            <ChevronUp size={13} aria-hidden="true" />
          </span>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "active" : ""}
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                closeMenu(true);
              }}
            >
              {option.icon && <span className="choice-select__icon">{option.icon}</span>}
              <span>
                {option.label}
                {option.description && <small>{option.description}</small>}
              </span>
            </button>
          ))}
          <span className="choice-select__menu-edge choice-select__menu-edge--bottom" aria-hidden="true">
            <ChevronDown size={13} aria-hidden="true" />
          </span>
        </div>
      </>,
      document.body,
    )
    : null;

  return (
    <div
      ref={rootRef}
      className={["choice-select", open ? "open" : "", className].filter(Boolean).join(" ")}
      data-label={ariaLabel ?? label}
      data-empty={!selected ? "true" : undefined}
    >
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
        onClick={() => {
          updateMenuPosition();
          setSelectOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            updateMenuPosition();
            setSelectOpen(true);
            didInitialSelectedScrollRef.current = true;
            window.setTimeout(() => focusOption(event.key === "ArrowUp" ? options.length - 1 : undefined), 0);
          }
        }}
      >
        {selected?.icon && <span className="choice-select__icon">{selected.icon}</span>}
        <strong>
          {selected?.label ?? placeholder}
          {showSelectedDescription && selected?.description && <small>{selected.description}</small>}
        </strong>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}
