import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
import type { List } from '@/lib/useList';
import Button from '@/components/Button';

export default function ListState<T>({
  list, empty, children,
}: {
  list: List<T>;
  empty?: string;
  children: React.ReactNode;
}) {
  const { state } = list;
  switch (state.kind) {
    case 'loading':
      return <div className="flex items-center gap-2 p-6 text-muted"><CircleNotch aria-hidden size={18} className="animate-spin" />Loading…</div>;
    case 'forbidden':
      return <div role="alert" className="flex items-center gap-2 p-6 text-danger"><WarningCircle aria-hidden size={20} />You don&apos;t have access to this list</div>;
    case 'error':
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-6 text-danger">
          <WarningCircle aria-hidden size={20} />
          <span>{state.message}</span>
          <Button variant="quiet" size="sm" onClick={list.reload}>
            Retry
          </Button>
        </div>
      );
    case 'ready':
      return (
        <>
          {state.updating && <div role="status" className="px-6 pt-4 text-sm text-muted">Updating…</div>}
          {state.rows.length === 0 && empty ? <div className="p-6 text-muted">{empty}</div> : children}
        </>
      );
  }
}
