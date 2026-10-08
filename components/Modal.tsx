import { ReactNode, useEffect, useId, useRef } from 'react';

const WIDTH = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
} as const;

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const openStack: HTMLElement[] = [];

export default function Modal({
  open, onClose, title, size = 'lg', children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: keyof typeof WIDTH;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const opener = document.activeElement as HTMLElement | null;
    openStack.push(panel);
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    (bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();

    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== panel) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!first) {
        e.preventDefault();
        panel.focus();
      } else if (!panel.contains(active) || (!e.shiftKey && active === last)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openStack.splice(openStack.indexOf(panel), 1);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-lg outline-none ${WIDTH[size]}`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        <div ref={bodyRef}>{children}</div>
      </div>
    </div>
  );
}
