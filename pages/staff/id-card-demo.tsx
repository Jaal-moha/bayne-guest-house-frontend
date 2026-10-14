// Temporary client demo of ID card options. Delete with lib/idCardDemo.ts and public/demo/ once the client picks.
import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import ListState from '@/components/ListState';
import Field from '@/components/Field';
import { useToast } from '@/components/Toast';
import axios from '@/utils/axiosInstance';
import { useList } from '@/lib/useList';
import {
  BACK_GROUP,
  DEFAULT_ID_CARD_OPTIONS,
  PER_PAGE_GROUP,
  PHOTO_GROUP,
  STAFF_MAX,
  WORDMARK_MAX,
  demoQuery,
  summaryLine,
  type ChoiceGroup,
  type IdCardOptions,
} from '@/lib/idCardDemo';

type StaffLite = { id: number; name: string; barcode: string };

const STYLE_CAPTIONS = ['Sign red (chosen so far)', 'Night', 'Ledger', 'Welcome'];

function ChoiceFieldset<K extends 'photo' | 'back' | 'perPage'>({
  group,
  value,
  onChange,
}: {
  group: ChoiceGroup<K>;
  value: IdCardOptions[K];
  onChange: (value: IdCardOptions[K]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold text-gray-800">{group.label}</legend>
      {group.choices.map((choice) => {
        const id = `demo-${group.key}-${choice.value}`;
        return (
          <div key={id} className="flex items-start gap-2 rounded-md border bg-white p-2">
            <input
              type="radio"
              id={id}
              name={group.key}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              aria-describedby={`${id}-tradeoff`}
              className="mt-1"
            />
            <div>
              <label htmlFor={id} className="text-sm font-medium text-gray-800">{choice.label}</label>
              <p id={`${id}-tradeoff`} className="text-xs text-gray-600">{choice.tradeoff}</p>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

async function errorMessage(e: unknown): Promise<string> {
  const data = isAxiosError(e) ? e.response?.data : undefined;
  if (data instanceof Blob) {
    try {
      const msg = JSON.parse(await data.text())?.message;
      if (msg) return Array.isArray(msg) ? msg.join(', ') : msg;
    } catch {}
  }
  return (e instanceof Error && e.message) || 'Failed to load the preview';
}

// Same approach as the ID card dialog on /staff: print the blob from a hidden frame.
function printPdf(url: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  frame.onload = () => {
    try {
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => frame.remove(), 60_000);
  };
  frame.src = url;
  document.body.appendChild(frame);
}

function usePdfPreview(query: string | null) {
  const [url, setUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const latest = useRef<string | undefined>(undefined);

  useEffect(() => () => {
    if (latest.current) URL.revokeObjectURL(latest.current);
  }, []);

  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/staff/id-card-demo?${query}`, { responseType: 'blob', signal: ctrl.signal });
        const next = URL.createObjectURL(res.data as Blob);
        if (latest.current) URL.revokeObjectURL(latest.current);
        latest.current = next;
        setUrl(next);
        setError(undefined);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(await errorMessage(e));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  return { url, loading, error };
}

function IdCardDemoInner() {
  const staffList = useList<StaffLite>('staff', async () => {
    const res = await axios.get('/staff');
    return Array.isArray(res.data) ? res.data : res.data?.staff ?? [];
  });
  const staff = staffList.rows;
  const { push } = useToast();
  const [options, setOptions] = useState<IdCardOptions>(DEFAULT_ID_CARD_OPTIONS);
  const [picked, setPicked] = useState<number[] | null>(null);

  const ids = picked ?? staff.slice(0, 3).map((s) => s.id);
  const preview = usePdfPreview(ids.length ? demoQuery(options, ids) : null);
  const summary = summaryLine(options);

  const set = <K extends keyof IdCardOptions>(key: K) => (value: IdCardOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  const toggle = (id: number) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    if (!next.length) return;
    setPicked(staff.filter((s) => next.includes(s.id)).map((s) => s.id));
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      push('Copied the client\'s choice', 'success');
    } catch {
      push('Could not copy. Select the line and copy it by hand.', 'error');
    }
  };

  return (
    <Layout>
      <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        Demo: ID card options. Pick with the client, then this page goes away.
      </div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">ID card options</h1>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-5">
          <ChoiceFieldset group={PHOTO_GROUP} value={options.photo} onChange={set('photo')} />
          <ChoiceFieldset group={BACK_GROUP} value={options.back} onChange={set('back')} />
          <ChoiceFieldset group={PER_PAGE_GROUP} value={options.perPage} onChange={set('perPage')} />
          <Field label="Wordmark">
            {(id) => (
              <input
                id={id}
                value={options.wordmark}
                maxLength={WORDMARK_MAX}
                onChange={(e) => set('wordmark')(e.target.value)}
                className="w-full rounded-md border px-3 py-2"
              />
            )}
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-gray-800">Staff</legend>
            <p className="mb-2 text-xs text-gray-600">One to twelve. With 3 per page, cards fill pages in this order.</p>
            <ListState list={staffList} empty="No staff yet.">
              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-white p-2">
                {staff.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={ids.includes(s.id)}
                        disabled={ids.includes(s.id) ? ids.length === 1 : ids.length >= STAFF_MAX}
                        onChange={() => toggle(s.id)}
                      />
                      <span className="text-gray-800">{s.name}</span>
                      <span className="font-mono text-xs text-gray-500">{s.barcode}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </ListState>
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col lg:sticky lg:top-0 lg:self-start">
          <div className="flex items-center justify-end gap-2">
            {preview.loading && <span className="mr-auto text-sm text-gray-500">Updating…</span>}
            {preview.url && (
              <a
                href={preview.url}
                download="id-card-demo.pdf"
                className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Download
              </a>
            )}
            {preview.url && (
              <button
                onClick={() => printPdf(preview.url!)}
                className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
              >
                Print
              </button>
            )}
          </div>
          <div className="mt-3 h-[75vh]">
            {preview.error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{preview.error}</div>
            ) : preview.url ? (
              <iframe src={preview.url} title="ID card options PDF" className="h-full w-full rounded border" />
            ) : (
              <div className="grid h-full place-items-center text-gray-600">Preparing preview…</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border bg-white px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">Client&apos;s choice</span>
        <output data-testid="demo-summary" className="font-mono text-sm text-gray-900">{summary}</output>
        <button onClick={copySummary} className="ml-auto rounded border px-3 py-1 text-sm">Copy</button>
      </div>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold text-gray-800">Earlier style directions (mockups, no photo)</h2>
        <p className="mb-3 text-sm text-gray-600">{STYLE_CAPTIONS.join(' · ')}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo/id-card-styles.webp"
          alt={`Four earlier ID card mockups, top to bottom: ${STYLE_CAPTIONS.join(', ')}`}
          className="w-full max-w-3xl rounded-md"
        />
      </section>
    </Layout>
  );
}

export default function IdCardDemoPage() {
  return (
    <RequireAuth>
      <IdCardDemoInner />
    </RequireAuth>
  );
}
