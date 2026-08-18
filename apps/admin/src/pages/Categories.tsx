import { useEffect, useMemo, useState } from 'react';
import { CornerDownRight, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Select } from '@/components/Select';

interface Cat {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder?: number;
  _count?: { products?: number };
}

interface Node extends Cat {
  children: Node[];
}

/**
 * Categories nest to any depth on the storefront (the navbar opens a dropdown
 * per level and a listing page shows the branch in its sidebar), so this screen
 * lists and creates them at any depth too — not just parent + child.
 */
function buildTree(rows: Cat[]): Node[] {
  const nodes = new Map<string, Node>(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: Node[]) => {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Flatten the tree for the parent dropdown, indenting by depth. */
function flatten(nodes: Node[], depth = 0): { value: string; label: string }[] {
  return nodes.flatMap((n) => [
    { value: n.id, label: `${'  '.repeat(depth)}${depth ? '└ ' : ''}${n.name}` },
    ...flatten(n.children, depth + 1),
  ]);
}

export function Categories() {
  const [categories, setCategories] = useState<Cat[]>([]);
  const [form, setForm] = useState({ name: '', parentId: '' });
  const [error, setError] = useState('');

  const load = () => api.get<{ categories: Cat[] }>('/admin/categories').then((d) => setCategories(d.categories));
  useEffect(() => { load(); }, []);

  const tree = useMemo(() => buildTree(categories), [categories]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/categories', { name: form.name, parentId: form.parentId || null });
      setForm({ name: '', parentId: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create category');
    }
  };

  const remove = async (node: Node) => {
    const warning = node.children.length
      ? `Delete "${node.name}"? Its ${node.children.length} subcategor${node.children.length === 1 ? 'y' : 'ies'} will move to the top level.`
      : `Delete "${node.name}"?`;
    if (!confirm(warning)) return;
    await api.del(`/admin/categories/${node.id}`);
    load();
  };

  const Row = ({ node, depth }: { node: Node; depth: number }) => (
    <>
      <div
        className="flex items-center justify-between gap-3 py-2"
        style={{ paddingLeft: depth * 20 }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {depth > 0 && <CornerDownRight size={14} className="shrink-0 text-stone-300" />}
          <span className={depth === 0 ? 'truncate font-semibold' : 'truncate text-sm text-stone-600'}>
            {node.name}
          </span>
          <span
            title="Products assigned directly to this category"
            className="shrink-0 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-500"
          >
            {node._count?.products ?? 0}
          </span>
          {node.children.length > 0 && (
            <span className="shrink-0 text-[11px] text-stone-400">
              · {node.children.length} sub
            </span>
          )}
        </span>
        <button
          onClick={() => remove(node)}
          aria-label={`Delete ${node.name}`}
          className="shrink-0 text-stone-400 hover:text-red-600"
        >
          <Trash2 size={depth === 0 ? 16 : 14} />
        </button>
      </div>
      {node.children.map((c) => (
        <Row key={c.id} node={c} depth={depth + 1} />
      ))}
    </>
  );

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 font-serif text-2xl font-bold">Categories</h1>
      <p className="mb-6 text-sm text-stone-500">
        Nest as deep as you like — the storefront navbar and category sidebar follow the tree, and a
        parent category lists the products of everything below it.
      </p>

      <form onSubmit={create} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-40 flex-1">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="min-w-40 flex-1">
          <label className="label">Parent (optional)</label>
          <Select
            value={form.parentId}
            onChange={(v) => setForm({ ...form, parentId: v })}
            options={[{ value: '', label: '— Top level —' }, ...flatten(tree)]}
          />
        </div>
        <button className="btn-primary"><Plus size={16} /> Add</button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <div className="card divide-y divide-stone-100">
        {tree.length === 0 ? (
          <p className="p-5 text-sm text-stone-500">No categories yet.</p>
        ) : (
          tree.map((node) => (
            <div key={node.id} className="px-4 py-2">
              <Row node={node} depth={0} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
