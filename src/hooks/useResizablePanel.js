import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "orbit-discussion-panel-width";
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

function getInitialWidth() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_WIDTH;
    const parsed = Number(stored);
    if (isNaN(parsed) || parsed < MIN_WIDTH || parsed > MAX_WIDTH) return DEFAULT_WIDTH;
    return parsed;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function useResizablePanel() {
  const [width, setWidth] = useState(getInitialWidth);
  const widthRef = useRef(width);
  widthRef.current = width;

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    let currentWidth = startWidth;
    let rafId = null;

    const onMouseMove = (moveEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const delta = moveEvent.clientX - startX;
        currentWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth - delta));
        setWidth(currentWidth);
        rafId = null;
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      try {
        localStorage.setItem(STORAGE_KEY, String(currentWidth));
      } catch {
        // localStorage 쓰기 실패 무시
      }
    };

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  // unmount 시 body 스타일 복구 안전장치
  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  return { width, handleResizeStart };
}
