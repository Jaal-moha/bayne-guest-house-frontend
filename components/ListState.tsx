import type { List } from '@/lib/useList';

export default function ListState<T>({
  list, empty, children,
}: {
  list: List<T>;
  empty: string;
  children: React.ReactNode;
}) {
  const { state } = list;
  switch (state.kind) {
    case 'loading':
      return <div className="p-6 text-gray-600">Loading…</div>;
    case 'error':
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-6 text-red-700">
          <span>{state.message}</span>
          <button onClick={list.reload} className="rounded border border-red-300 px-3 py-1 text-sm hover:bg-red-50">
            Retry
          </button>
        </div>
      );
    case 'ready':
      return state.rows.length === 0 ? <div className="p-6 text-gray-500">{empty}</div> : <>{children}</>;
  }
}
