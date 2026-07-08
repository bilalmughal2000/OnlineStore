import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Upload } from 'lucide-react';
import { api, ApiError, uploadImage } from '@/lib/api';

interface VariantRow {
  id?: string;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
}

const blank = {
  title: '',
  description: '',
  basePrice: 0,
  salePrice: '' as number | '',
  brand: '',
  fabric: '',
  categoryId: '',
  status: 'DRAFT',
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
};

export function ProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [images, setImages] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState('');
  const [sizeChartImage, setSizeChartImage] = useState('');
  const [chartHeaders, setChartHeaders] = useState<string[]>(['Size', 'Chest', 'Waist', 'Length']);
  const [chartRows, setChartRows] = useState<string[][]>([
    ['S', '36', '30', '26'],
    ['M', '38', '32', '27'],
    ['L', '40', '34', '28'],
  ]);
  const [variants, setVariants] = useState<VariantRow[]>([{ size: 'M', color: 'Black', colorHex: '#111111', stock: 10 }]);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (
    file: File | undefined,
    folder: 'products' | 'size-charts',
    onDone: (url: string) => void,
  ) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onDone(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    api.get<{ categories: any[] }>('/admin/categories').then((d) => setCategories(d.categories));
    if (!isNew) {
      api.get<{ product: any }>(`/admin/products/${id}`).then(({ product }) => {
        setForm({
          title: product.title,
          description: product.description,
          basePrice: product.basePrice,
          salePrice: product.salePrice ?? '',
          brand: product.brand ?? '',
          fabric: product.fabric ?? '',
          categoryId: product.categoryId ?? '',
          status: product.status,
          isFeatured: product.isFeatured,
          seoTitle: product.seoTitle ?? '',
          seoDescription: product.seoDescription ?? '',
        });
        setImages(product.images.map((i: any) => i.url));
        setSizeChartImage(product.sizeChartImage ?? '');
        if (product.sizeChartTable?.headers) {
          setChartHeaders(product.sizeChartTable.headers);
          setChartRows(product.sizeChartTable.rows ?? []);
        }
        setVariants(
          product.variants.map((v: any) => ({
            id: v.id,
            size: v.size ?? '',
            color: v.color ?? '',
            colorHex: v.colorHex ?? '#000000',
            stock: v.stock,
          })),
        );
      });
    }
  }, [id, isNew]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      ...form,
      basePrice: Number(form.basePrice),
      salePrice: form.salePrice === '' ? null : Number(form.salePrice),
      categoryId: form.categoryId || null,
      sizeChartImage: sizeChartImage || null,
      // Only send a table if it has at least one header and one data row.
      sizeChartTable:
        chartHeaders.length && chartRows.length
          ? { headers: chartHeaders, rows: chartRows.map((r) => chartHeaders.map((_, ci) => r[ci] ?? '')) }
          : null,
      images: images.map((url, i) => ({ url, isPrimary: i === 0 })),
      variants: variants.map((v) => ({
        id: v.id,
        size: v.size || undefined,
        color: v.color || undefined,
        colorHex: v.colorHex || undefined,
        stock: Number(v.stock),
      })),
    };
    try {
      if (isNew) await api.post('/admin/products', payload);
      else await api.put(`/admin/products/${id}`, payload);
      navigate('/products');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <form onSubmit={save} className="max-w-4xl">
      <button type="button" onClick={() => navigate('/products')} className="mb-4 flex items-center gap-1 text-sm text-stone-500">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="mb-6 font-serif text-2xl font-bold">{isNew ? 'New Product' : 'Edit Product'}</h1>

      {error && <p className="mb-4 rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="card space-y-4 p-5">
            <div><label className="label">Title</label><input className="input" value={form.title} onChange={set('title')} required /></div>
            <div><label className="label">Description</label><textarea className="input h-28" value={form.description} onChange={set('description')} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Base Price (PKR)</label><input type="number" className="input" value={form.basePrice} onChange={set('basePrice')} required /></div>
              <div><label className="label">Sale Price (optional)</label><input type="number" className="input" value={form.salePrice} onChange={set('salePrice')} /></div>
              <div><label className="label">Brand</label><input className="input" value={form.brand} onChange={set('brand')} /></div>
              <div><label className="label">Fabric</label><input className="input" value={form.fabric} onChange={set('fabric')} /></div>
            </div>
          </div>

          {/* Images */}
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Images</h2>
            <div className="flex gap-2">
              <input className="input" placeholder="Paste image URL, or upload →" value={imageInput} onChange={(e) => setImageInput(e.target.value)} />
              <button type="button" className="btn-outline" onClick={() => { if (imageInput) { setImages([...images, imageInput]); setImageInput(''); } }}>
                <Plus size={16} /> Add
              </button>
              <label className="btn-primary cursor-pointer whitespace-nowrap">
                <Upload size={16} /> Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach((f) => handleUpload(f, 'products', (url) => setImages((prev) => [...prev, url])));
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {uploading && <p className="text-xs text-stone-500">Uploading…</p>}
            <div className="flex flex-wrap gap-3">
              {images.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="h-20 w-16 rounded object-cover" />
                  {i === 0 && <span className="badge absolute left-1 top-1 bg-brand text-white">Main</span>}
                  <button type="button" onClick={() => setImages(images.filter((_, x) => x !== i))} className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div className="card space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Variants (size / color / stock)</h2>
              <button type="button" className="btn-outline" onClick={() => setVariants([...variants, { size: '', color: '', colorHex: '#000000', stock: 0 }])}>
                <Plus size={16} /> Add Variant
              </button>
            </div>
            {variants.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input" placeholder="Size" value={v.size} onChange={(e) => setVariants(variants.map((x, xi) => xi === i ? { ...x, size: e.target.value } : x))} />
                <input className="input" placeholder="Color" value={v.color} onChange={(e) => setVariants(variants.map((x, xi) => xi === i ? { ...x, color: e.target.value } : x))} />
                <input type="color" className="h-10 w-12 rounded border border-stone-300" value={v.colorHex} onChange={(e) => setVariants(variants.map((x, xi) => xi === i ? { ...x, colorHex: e.target.value } : x))} />
                <input type="number" className="input w-24" placeholder="Stock" value={v.stock} onChange={(e) => setVariants(variants.map((x, xi) => xi === i ? { ...x, stock: Number(e.target.value) } : x))} />
                <button type="button" onClick={() => setVariants(variants.filter((_, x) => x !== i))} className="text-stone-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          {/* Size chart */}
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">Size Chart</h2>
            <p className="text-xs text-stone-500">Upload a chart image and/or build a measurements table. Either or both are shown to customers.</p>

            <div>
              <label className="label">Chart image (upload or paste URL — optional)</label>
              <div className="flex items-center gap-3">
                <input className="input" placeholder="https://… size chart image" value={sizeChartImage} onChange={(e) => setSizeChartImage(e.target.value)} />
                <label className="btn-outline cursor-pointer whitespace-nowrap">
                  <Upload size={16} /> Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { handleUpload(e.target.files?.[0], 'size-charts', setSizeChartImage); e.target.value = ''; }}
                  />
                </label>
                {sizeChartImage && <img src={sizeChartImage} alt="Size chart" className="h-16 rounded border border-stone-200 object-contain" />}
              </div>
            </div>

            <div>
              <label className="label">Measurements table (optional)</label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {chartHeaders.map((h, ci) => (
                        <th key={ci} className="p-1">
                          <input
                            className="input px-2 py-1 font-semibold"
                            value={h}
                            onChange={(e) => setChartHeaders(chartHeaders.map((x, xi) => (xi === ci ? e.target.value : x)))}
                          />
                        </th>
                      ))}
                      <th className="p-1 text-right">
                        <button type="button" title="Remove last column" onClick={() => { if (chartHeaders.length > 1) { setChartHeaders(chartHeaders.slice(0, -1)); setChartRows(chartRows.map((r) => r.slice(0, -1))); } }} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartRows.map((row, ri) => (
                      <tr key={ri}>
                        {chartHeaders.map((_, ci) => (
                          <td key={ci} className="p-1">
                            <input
                              className="input px-2 py-1"
                              value={row[ci] ?? ''}
                              onChange={(e) => setChartRows(chartRows.map((r, xi) => (xi === ri ? r.map((c, cci) => (cci === ci ? e.target.value : c)) : r)))}
                            />
                          </td>
                        ))}
                        <td className="p-1 text-right">
                          <button type="button" onClick={() => setChartRows(chartRows.filter((_, xi) => xi !== ri))} className="text-stone-400 hover:text-red-600"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-outline text-xs" onClick={() => setChartRows([...chartRows, chartHeaders.map(() => '')])}><Plus size={14} /> Add row</button>
                <button type="button" className="btn-outline text-xs" onClick={() => { setChartHeaders([...chartHeaders, 'Column']); setChartRows(chartRows.map((r) => [...r, ''])); }}><Plus size={14} /> Add column</button>
                <button type="button" className="btn-outline text-xs" onClick={() => setChartRows([])}>Clear table</button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="card space-y-4 p-5">
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div><label className="label">Category</label>
              <select className="input" value={form.categoryId} onChange={set('categoryId')}>
                <option value="">Uncategorised</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.parent ? `${c.parent.name} › ` : ''}{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isFeatured} onChange={set('isFeatured')} /> Featured product
            </label>
          </div>
          <div className="card space-y-4 p-5">
            <h2 className="font-semibold">SEO</h2>
            <div><label className="label">Meta Title</label><input className="input" value={form.seoTitle} onChange={set('seoTitle')} /></div>
            <div><label className="label">Meta Description</label><textarea className="input h-20" value={form.seoDescription} onChange={set('seoDescription')} /></div>
          </div>
          <button disabled={busy} className="btn-primary w-full">{busy ? 'Saving…' : 'Save Product'}</button>
        </div>
      </div>
    </form>
  );
}
