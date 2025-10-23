import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import RequireAuth from '@/components/RequireAuth';
import axios from '@/utils/axiosInstance';
import Link from 'next/link';

type Item = {
  id: number;
  name: string;
  category: string;
  unit?: string | null;   // 'pcs' | 'kg' | 'L'
  sku?: string | null;
  quantity: number;
  minThreshold?: number;
  updatedAt: string;
};

type Movement = {
  id: number;
  type: 'IN' | 'OUT' | 'ADJUST' | string;
  quantity: number;
  reason?: string | null;
  createdAt: string;
};

function Badge({ children, color }: { children: any; color: 'amber' | 'emerald' | 'gray' | 'red'; }) {
  const map: any = {
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    gray: 'bg-gray-100 text-gray-800',
    red: 'bg-red-100 text-red-800',
  };
  return <span className={`rounded px-2 py-0.5 text-xs ${map[color]}`}>{children}</span>;
}

/* ---------- Modals ---------- */

function NewItemModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (it: Item) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState<'pcs' | 'kg' | 'L'>('pcs'); // ← dropdown value
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [minThreshold, setMinThreshold] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setCategory('');
    setUnit('pcs'); // default
    setSku('');
    setQuantity('');
    setMinThreshold('');
    setErr('');
  }, [open]);

  const submit = async () => {
    setErr('');
    if (!name.trim()) return setErr('Name is required');
    if (!category.trim()) return setErr('Category is required');
    try {
      setLoading(true);
      const res = await axios.post('/inventory', {
        name: name.trim(),
        category: category.trim(),
        unit, // from dropdown: 'pcs' | 'kg' | 'L'
        sku: sku.trim() || undefined,
        quantity: typeof quantity === 'number' ? quantity : undefined,
        minThreshold: typeof minThreshold === 'number' ? minThreshold : undefined,
      });
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">New Item</h3>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
            <input className="w-full rounded border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Grocery, Bar, Housekeeping" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'pcs' | 'kg' | 'L')}
            >
              <option value="pcs">pcs</option>
              <option value="kg">kg</option>
              <option value="L">L</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">SKU (optional)</label>
            <input className="w-full rounded border px-3 py-2" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Initial Quantity (optional)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded border px-3 py-2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Min Threshold (optional)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded border px-3 py-2"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {loading ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockModal({
  open, onClose, onDone, item, kind,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (it: Item) => void;
  item: Item | null;
  kind: 'in' | 'out' | 'adjust';
}) {
  const [qty, setQty] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty(''); setReason(''); setErr('');
  }, [open]);

  if (!open || !item) return null;

  const title = kind === 'in' ? `Receive Stock — ${item.name}` : kind === 'out' ? `Issue Stock — ${item.name}` : `Adjust Stock — ${item.name}`;

  const submit = async () => {
    setErr('');
    if (qty === '' || qty === null) return setErr('Enter quantity');
    if (kind !== 'adjust' && qty <= 0) return setErr('Quantity must be > 0');
    if (kind === 'out' && qty > item.quantity) return setErr('Insufficient stock');

    try {
      setLoading(true);
      // Unified backend endpoint: POST /inventory/:id/movements { type, quantity, reason? }
      const type = kind === 'in' ? 'IN' : kind === 'out' ? 'OUT' : 'ADJUST';
      const res = await axios.post(`/inventory/${item.id}/movements`, {
        type,
        quantity: qty,
        reason: reason || undefined,
      });
      onDone(res.data);
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-2 text-sm text-gray-600">
          Current: {item.quantity} {item.unit || ''}
        </div>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Quantity {item.unit ? `(${item.unit})` : ''}
            </label>
            <input
              type="number"
              min={kind === 'adjust' ? 0 : 1}
              className="w-full rounded border px-3 py-2"
              value={qty}
              onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={kind === 'adjust' ? 'Set absolute quantity' : 'Enter amount to add/remove'}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason (optional)</label>
            <textarea className="w-full rounded border px-3 py-2" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-4 py-2">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {loading ? 'Processing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({
  open, onClose, item,
}: {
  open: boolean;
  onClose: () => void;
  item: Item | null;
}) {
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!open || !item) return;
      setLoading(true);
      try {
        const res = await axios.get(`/inventory/${item.id}/movements?limit=200`);
        setRows(Array.isArray(res.data) ? res.data : res.data.movements ?? res.data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [open, item]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">History — {item.name}</h3>
        <div className="mt-4 overflow-x-auto rounded border">
          {loading ? (
            <div className="p-4 text-gray-600">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-gray-600">No movements.</div>
          ) : (
            <table className="min-w-full table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Quantity</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="px-3 py-2">
                      {m.type === 'IN' && <Badge color="emerald">In</Badge>}
                      {m.type === 'OUT' && <Badge color="red">Out</Badge>}
                      {m.type === 'ADJUST' && <Badge color="gray">Adjust</Badge>}
                    </td>
                    <td className="px-3 py-2">{m.quantity} {item.unit || ''}</td>
                    <td className="px-3 py-2">{m.reason || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">{new Date(m.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded border px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  );
}

// Add: Row actions modal
function ItemActionsModal({
  open,
  onClose,
  item,
  onAdd,
  onSubtract,
  onAdjust,
  onHistory,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  item: Item | null;
  onAdd: () => void;
  onSubtract: () => void;
  onAdjust: () => void;
  onHistory: () => void;
  onRemove: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!open || !item) return null;

  const doRemove = async () => {
    setErr('');
    try {
      setLoading(true);
      await onRemove();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Remove failed');
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{item.name}</h3>
        <div className="mt-2 text-sm text-gray-600">
          <div>Category: {item.category}</div>
          <div>SKU: {item.sku || '—'}</div>
          <div>Quantity: {item.quantity} {item.unit || ''}</div>
          <div>Min: {item.minThreshold ?? 0}</div>
          <div>Updated: {new Date(item.updatedAt).toLocaleString()}</div>
        </div>
        {err && <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        {!confirming ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button className="rounded bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700" onClick={onAdd}>Add</button>
            <button className="rounded bg-orange-600 px-3 py-2 text-white hover:bg-orange-700" onClick={onSubtract}>Subtract</button>
            <button className="rounded bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700" onClick={onAdjust}>Adjust</button>
            <button className="rounded border px-3 py-2 hover:bg-gray-50" onClick={onHistory}>History</button>
            <button className="col-span-2 rounded border border-red-300 px-3 py-2 text-red-700 hover:bg-red-50" onClick={() => setConfirming(true)}>Remove Item</button>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-sm font-medium text-red-800">Confirm removal</div>
            <div className="mt-1 text-sm text-red-700">This will permanently delete “{item.name}”.</div>
            <div className="mt-3 flex gap-2">
              <button className="rounded bg-red-600 px-3 py-2 text-white hover:bg-red-700 disabled:opacity-60" disabled={loading} onClick={doRemove}>
                {loading ? 'Removing…' : 'Confirm Remove'}
              </button>
              <button className="rounded border px-3 py-2" disabled={loading} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button className="rounded border px-4 py-2" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

function InventoryInner() {
  const [rows, setRows] = useState<Item[]>([]);
  const [q, setQ] = useState(''); const [category, setCategory] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newOpen, setNewOpen] = useState(false);
  const [stockItem, setStockItem] = useState<Item | null>(null);
  const [stockKind, setStockKind] = useState<'in' | 'out' | 'adjust'>('in');
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  // Add: actions item state
  const [actionsItem, setActionsItem] = useState<Item | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory', {
        params: {
          q: q || undefined,
          category: category || undefined,
          low: onlyLow ? 'true' : undefined,
        }
      });
      const arr = Array.isArray(res.data) ? res.data : res.data.inventory ?? res.data;
      setRows(arr.map((r: Item) => ({ ...r, minThreshold: r.minThreshold ?? 0 })));
    } finally {
      setLoading(false);
    }
  }, [q, category, onlyLow]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return rows
      .filter(r => (category ? r.category === category : true))
      .filter(r => [r.name, r.category, r.sku || '', String(r.quantity)].some(v => (v || '').toLowerCase().includes(t)));
  }, [rows, q, category]);

  const low = (r: Item) => (r.quantity <= (r.minThreshold ?? 0));

  // Add: remove handler
  const removeItem = async (id: number) => {
    await axios.delete(`/inventory/${id}`);
    setRows(prev => prev.filter(p => p.id !== id));
    setActionsItem(null);
  };

  return (
    <Layout>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Inventory</h1>
        {/* Always show Dashboard button */}
        <Link
          href="/dashboard"
          className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          Dashboard
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            className="w-64 rounded border px-3 py-2"
            placeholder="Search name, SKU, category…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="rounded border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
            Low stock only
          </label>
          <button className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white" onClick={() => setNewOpen(true)}>
            New Item
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded bg-white shadow">
        {loading ? (
          <div className="p-6 text-gray-600">Loading…</div>
        ) : (
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Quantity</th>
                <th className="px-4 py-3 text-left">Min</th>
                <th className="px-4 py-3 text-left">Updated</th>
                {/* Removed Actions column */}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr
                  key={r.id}
                  className="border-t cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100"
                  onClick={() => setActionsItem(r)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setActionsItem(r); }}
                  tabIndex={0}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.unit || ''}</div>
                  </td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3">{r.sku || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{r.quantity} {r.unit || ''}</span>
                      {low(r) && <Badge color="amber">Low</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.minThreshold ?? 0}</td>
                  <td className="px-4 py-3">{new Date(r.updatedAt).toLocaleString()}</td>
                  {/* Removed inline Actions cell */}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="px-4 py-6 text-gray-500" colSpan={6}>No items.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <NewItemModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(it) => setRows(prev => [it, ...prev])}
      />
      <StockModal
        open={!!stockItem}
        onClose={() => setStockItem(null)}
        onDone={(it) => setRows(prev => prev.map(p => p.id === it.id ? it : p))}
        item={stockItem}
        kind={stockKind}
      />
      <HistoryModal
        open={!!historyItem}
        onClose={() => setHistoryItem(null)}
        item={historyItem}
      />
      {/* Add: actions modal */}
      <ItemActionsModal
        open={!!actionsItem}
        onClose={() => setActionsItem(null)}
        item={actionsItem}
        onAdd={() => { if (actionsItem) { setStockItem(actionsItem); setStockKind('in'); setActionsItem(null); } }}
        onSubtract={() => { if (actionsItem) { setStockItem(actionsItem); setStockKind('out'); setActionsItem(null); } }}
        onAdjust={() => { if (actionsItem) { setStockItem(actionsItem); setStockKind('adjust'); setActionsItem(null); } }}
        onHistory={() => { if (actionsItem) { setHistoryItem(actionsItem); setActionsItem(null); } }}
        onRemove={async () => { if (actionsItem) await removeItem(actionsItem.id); }}
      />
    </Layout>
  );
}

export default function InventoryPage() {
  return (
    <RequireAuth roles={['admin', 'manager', 'store', 'barista', 'reception']}>
      <InventoryInner />
    </RequireAuth>
  );
}
