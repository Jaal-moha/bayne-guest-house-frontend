import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ListLoad<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: T[] };

export type List<T> = {
  state: ListLoad<T>;
  rows: T[];
  reload: () => void;
  setRows: (update: (rows: T[]) => T[]) => void;
};

function errorMessage(what: string, e: unknown): string {
  if (isAxiosError(e) && e.response?.status === 403) return "You don't have access to this list";
  return `Couldn't load ${what}`;
}

// `key` refetches when it changes. `load` may close over fresh state on every render.
export function useList<T>(what: string, load: () => Promise<T[]>, key = ''): List<T> {
  const [state, setState] = useState<ListLoad<T>>({ kind: 'loading' });
  const loadRef = useRef(load);
  loadRef.current = load;
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setState((s) => (s.kind === 'ready' ? s : { kind: 'loading' }));
    try {
      const rows = await loadRef.current();
      if (request === latest.current) setState({ kind: 'ready', rows });
    } catch (e) {
      if (request === latest.current) setState({ kind: 'error', message: errorMessage(what, e) });
    }
  }, [what]);

  useEffect(() => {
    reload();
  }, [reload, key]);

  const setRows = useCallback((update: (rows: T[]) => T[]) => {
    setState((s) => (s.kind === 'ready' ? { kind: 'ready', rows: update(s.rows) } : s));
  }, []);

  return { state, rows: state.kind === 'ready' ? state.rows : [], reload, setRows };
}
