'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string;
  label?: string;       // 표시 텍스트 (없으면 value 사용)
  className?: string;   // 글자 색 등 (bg/border 권장 안 함 — 텍스트 위주)
  /** 앞에 표시할 점(dot). color 는 dot 자체 클래스(채움 또는 border bg-white), pingColor 는 ping ring 색 */
  dot?: { color: string; pingColor?: string; animated?: boolean };
  /** 구분선 — 선택 불가, 위/아래 옵션 그룹을 시각적으로 분리 */
  divider?: boolean;
  /** 섹션 헤더 — 선택 불가, 작은 회색 라벨 */
  header?: boolean;
}

interface PortalDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
  size?: 'sm' | 'md';
  /** 트리거 추가 className (래퍼) */
  className?: string;
  /** 메뉴 모드: 트리거에 항상 이 라벨 표시 (선택 상태 미반영). 액션 메뉴용. */
  triggerLabel?: string;
}

/**
 * Portal로 body에 렌더 + fixed positioning + 스마트 위/아래 결정.
 * 부모 overflow에 영향 받지 않음.
 */
export default function PortalDropdown({
  value,
  onChange,
  options,
  disabled = false,
  size = 'md',
  className = '',
  triggerLabel,
}: PortalDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number | null; bottom: number | null; right: number; minWidth: number }>({
    top: null, bottom: null, right: 0, minWidth: 120,
  });
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal SSR hydration 가드 (mount 후 1회만 설정)
  useEffect(() => { setMounted(true); }, []);

  // 클릭 외부 + Esc → 닫기
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  // 위치 계산
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const compute = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownEst = options.length * 38 + 16;
      const openUp = spaceBelow < dropdownEst && rect.top > spaceBelow;
      // 모바일 좌측 클리핑 방지 — 트리거 우측에 정렬하되 패널이 화면 밖으로 안 나가게
      const minPanelWidth = Math.max(rect.width, 140);
      const safeRight = Math.max(8, window.innerWidth - rect.right);
      const wouldClipLeft = window.innerWidth - safeRight - minPanelWidth < 8;
      const right = wouldClipLeft ? Math.max(8, window.innerWidth - minPanelWidth - 8) : safeRight;
      if (openUp) {
        setPos({ top: null, bottom: window.innerHeight - rect.top + 6, right, minWidth: minPanelWidth });
      } else {
        setPos({ top: rect.bottom + 6, bottom: null, right, minWidth: minPanelWidth });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, options.length]);

  const current = options.find(o => o.value === value);
  const triggerStyle = current?.className ?? 'text-gray-700';
  // 모바일에서는 sm 사이즈도 lg 미만 화면에서 더 큰 터치 타겟 보장 (≥44px)
  const padding = size === 'sm'
    ? 'px-2.5 py-2 text-xs lg:py-1 lg:text-xs'
    : 'px-3 py-2 text-sm lg:py-1.5';

  const renderDot = (dot: NonNullable<DropdownOption['dot']>) => (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0 mr-1.5" aria-hidden>
      {dot.animated && (
        <span className={`absolute inset-0 rounded-full opacity-60 animate-ping ${dot.pingColor ?? dot.color}`} />
      )}
      <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${dot.color}`} />
    </span>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`${padding} font-medium rounded-md cursor-pointer disabled:cursor-default disabled:opacity-80 inline-flex items-center justify-between gap-1 hover:bg-gray-100 transition-colors ${triggerStyle} ${className}`}
      >
        <span className="inline-flex items-center">
          {!triggerLabel && current?.dot && renderDot(current.dot)}
          {triggerLabel ?? current?.label ?? value}
        </span>
        {!disabled && (
          <svg
            className={`shrink-0 text-gray-400 transition-transform ${size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {mounted && open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: pos.top ?? undefined,
            bottom: pos.bottom ?? undefined,
            right: pos.right,
            zIndex: 1000,
            minWidth: pos.minWidth,
            maxHeight: 'min(60vh, 320px)',
          }}
          className="bg-white border border-gray-200 rounded-xl shadow-lg p-1.5 flex flex-col gap-1 overflow-y-auto"
        >
          {options.map((opt, idx) => {
            if (opt.divider) {
              return <div key={`divider-${idx}`} className="my-1 border-t border-gray-100" aria-hidden />;
            }
            if (opt.header) {
              return (
                <div key={`header-${idx}`} className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {opt.label ?? opt.value}
                </div>
              );
            }
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between gap-3 font-medium ${
                  selected ? 'bg-gray-100' : 'hover:bg-gray-100'
                } ${opt.className ?? 'text-gray-700'}`}
              >
                <span className="inline-flex items-center">
                  {opt.dot && renderDot(opt.dot)}
                  {opt.label ?? opt.value}
                </span>
                {selected && (
                  <svg className="w-4 h-4 shrink-0 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
