"use client";
import { useCallback, useEffect, useState } from "react";
export const SCROLL_EDGE_THRESHOLD = 3;

type ScrollEdges = {
  canScrollUp: boolean;
  canScrollDown: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

function measureScrollEdges(element: HTMLElement | null): ScrollEdges {
  if (!element) {
    return { canScrollUp: false, canScrollDown: false, canScrollLeft: false, canScrollRight: false };
  }
  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  return {
    canScrollUp: element.scrollTop > SCROLL_EDGE_THRESHOLD,
    canScrollDown: element.scrollTop < maxScrollTop - SCROLL_EDGE_THRESHOLD,
    canScrollLeft: element.scrollLeft > SCROLL_EDGE_THRESHOLD,
    canScrollRight: element.scrollLeft < maxScrollLeft - SCROLL_EDGE_THRESHOLD,
  };
}

function sameScrollEdges(left: ScrollEdges, right: ScrollEdges) {
  return left.canScrollUp === right.canScrollUp
    && left.canScrollDown === right.canScrollDown
    && left.canScrollLeft === right.canScrollLeft
    && left.canScrollRight === right.canScrollRight;
}

export function useScrollEdges<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  watchKey?: unknown,
) {
  const [edges, setEdges] = useState<ScrollEdges>(() => measureScrollEdges(null));

  const updateScrollEdges = useCallback(() => {
    const nextEdges = measureScrollEdges(ref.current);
    setEdges((current) => (sameScrollEdges(current, nextEdges) ? current : nextEdges));
  }, [ref]);

  useEffect(() => {
    updateScrollEdges();
    const element = ref.current;
    if (!element || typeof window === "undefined") return;

    const handleScroll = () => updateScrollEdges();
    element.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateScrollEdges);
    window.addEventListener("orientationchange", updateScrollEdges);

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScrollEdges) : null;
    resizeObserver?.observe(element);
    Array.from(element.children).forEach((child) => resizeObserver?.observe(child));

    const mutationObserver = typeof MutationObserver !== "undefined"
      ? new MutationObserver(() => {
        Array.from(element.children).forEach((child) => resizeObserver?.observe(child));
        updateScrollEdges();
      })
      : null;
    mutationObserver?.observe(element, { childList: true, subtree: true, characterData: true });

    const animationFrame = window.requestAnimationFrame(updateScrollEdges);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      element.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollEdges);
      window.removeEventListener("orientationchange", updateScrollEdges);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [ref, updateScrollEdges, watchKey]);

  return { edges, updateScrollEdges };
}
