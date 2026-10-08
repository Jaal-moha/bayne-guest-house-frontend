import { isAxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ListLoad<T> =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: T[]; updating: boolean };

export type List<T> = {
  state: ListLoad<T>;
  rows: T[];
  reload: () => void;
  setRows: (update: (rows: T[]) => T[]) => void;
};

export function loadFailure(what: string, e: unknown): ListLoad<never> {
  if (isAxiosError(e) && e.response?.status === 403) return { kind: 'forbidden' };
  return { kind: 'error', message: `Couldn't load ${what}` };
}

export function refetching<T>(s: ListLoad<T>): ListLoad<T> {
  return s.kind === 'ready' ? { ...s, updating: true } : { kind: 'loading' };
}

export function useList<T>(what: string, load: () => Promise<T[]>, refetchKey = ''): List<T> {
  const [state, setState] = useState<ListLoad<T>>({ kind: 'loading' });
  const latestLoad = useRef(load);
  latestLoad.current = load;
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    setState(refetching);
    try {
      const rows = await latestLoad.current();
      if (request === latestRequest.current) setState({ kind: 'ready', rows, updating: false });
    } catch (e) {
      if (request === latestRequest.current) setState(loadFailure(what, e));
    }
  }, [what]);

  useEffect(() => {
    reload();
  }, [reload, refetchKey]);

  const setRows = useCallback((update: (rows: T[]) => T[]) => {
    setState((s) => (s.kind === 'ready' ? { ...s, rows: update(s.rows) } : s));
  }, []);

  return { state, rows: state.kind === 'ready' ? state.rows : [], reload, setRows };
}
