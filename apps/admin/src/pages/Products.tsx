import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPKR } from '@/lib/format';

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: 'bg-green-100 text-green-700',
  DRAFT: 'bg-stone-200 text-stone-600',
  ARCHIVED: 'bg-red-100 text-red-700',
};

export function Products() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get<{ items: any[] }>(`/admin/products?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`)
      .then((d) => setItems(d.items))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const remove = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await api.del(`/admin/products/${id}`);
    load();
  };

  const bulk = async (action: string) => {
    if (selected.size === 0) return;
    await api.post('/admin/products/bulk', { ids: [...selected], action });
    setSelected(new Set());
    load();
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Products</h1>
        <Link to="/products/new" className="btn-primary">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {selected.size > 0 && (
          <>
            <span className="text-sm text-stone-500">{selected.size} selected</span>
            <button onClick={() => bulk('publish')} className="btn-outline">Publish</button>
            <button onClick={() => bulk('archive')} className="btn-outline">Archive</button>
            <button onClick={() => bulk('feature')} className="btn-outline">Feature</button>
          </>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr>
              <th className="th w-10"></th>
              <th className="th">Product</th>
              <th className="th">Price</th>
              <th className="th">Stock</th>
              <th className="th">Status</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr><td className="td text-stone-500" colSpan={6}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="td text-stone-500" colSpan={6}>No products found.</td></tr>
            ) : (
              items.map((p) => {
                const stock = p.variants.reduce((s: number, v: any) => s + v.stock, 0);
                return (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td className="td">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    </td>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        {p.images[0] && <img src={p.images[0].url} alt="" className="h-10 w-10 rounded object-cover" />}
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-stone-500">{p.category?.name ?? 'Uncategorised'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      {formatPKR(p.salePrice ?? p.basePrice)}
                      {p.salePrice && <span className="ml-1 text-xs text-stone-400 line-through">{formatPKR(p.basePrice)}</span>}
                    </td>
                    <td className="td">{stock}</td>
                    <td className="td"><span className={`badge ${STATUS_BADGE[p.status]}`}>{p.status}</span></td>
                    <td className="td">
                      <div className="flex justify-end gap-2">
                        <Link to={`/products/${p.id}`} className="text-stone-500 hover:text-brand"><Pencil size={16} /></Link>
                        <button onClick={() => remove(p.id)} className="text-stone-500 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
