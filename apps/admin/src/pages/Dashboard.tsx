import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ShoppingCart, Users, Banknote, AlertTriangle, PackageX } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPKR, formatDate } from '@/lib/format';

const COLORS = ['#b45309', '#0d9488', '#6366f1', '#be123c'];

export function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(setData).catch(console.error);
  }, []);

  if (!data) return <p className="text-stone-500">Loading dashboard…</p>;

  const lowStock: any[] = data.lowStock ?? [];
  const lowStockCount: number = data.kpis.lowStockCount ?? 0;
  const threshold: number = data.kpis.lowStockThreshold ?? 5;

  const kpis = [
    { label: 'Total Orders', value: data.kpis.totalOrders, icon: ShoppingCart },
    { label: 'Pending Orders', value: data.kpis.pendingOrders, icon: ShoppingCart },
    { label: 'Customers', value: data.kpis.totalCustomers, icon: Users },
    { label: 'Paid Revenue', value: formatPKR(data.kpis.paidRevenue), icon: Banknote },
    // Reads as a warning only when there's something to warn about.
    { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, alert: lowStockCount > 0 },
  ];

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className={`card p-4 ${k.alert ? 'border-amber-300 bg-amber-50' : ''}`}>
            <k.icon className={k.alert ? 'text-amber-600' : 'text-brand'} size={20} />
            {/* Revenue can run long; break rather than widen the grid column. */}
            <p className="mt-2 break-words text-xl font-bold sm:text-2xl">{k.value}</p>
            <p className="text-xs text-stone-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/*
        Sits directly under the KPIs, above the charts. The email alerts only
        fire when a sale *crosses* the threshold, which by design says nothing
        about stock that was already low or was set by hand in the admin. This
        panel is the standing answer to "what needs restocking right now".
      */}
      {lowStock.length > 0 && (
        <div className="card mt-6 overflow-hidden border-amber-300">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900">
              <PackageX size={17} />
              Needs restocking
            </h2>
            <span className="text-xs text-amber-800">
              {lowStockCount} {lowStockCount === 1 ? 'variant is' : 'variants are'} at or below {threshold}
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {lowStock.map((v: any) => {
              const out = v.stock === 0;
              return (
                <Link
                  key={v.id}
                  to={`/products/${v.productId}`}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{v.product?.title}</span>
                    {(v.size || v.color) && (
                      <span className="text-stone-500">
                        {' '}— {[v.size, v.color].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </span>
                  <span
                    className={`badge shrink-0 ${out ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
                  >
                    {out ? 'Sold out' : `${v.stock} left`}
                  </span>
                </Link>
              );
            })}
          </div>
          {lowStockCount > lowStock.length && (
            <Link
              to="/products"
              className="block border-t border-stone-100 px-4 py-2.5 text-center text-xs font-medium text-brand hover:bg-stone-50"
            >
              View all {lowStockCount} in Products
            </Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Revenue (last 30 days)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.dailyRevenue}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#b45309" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#b45309" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatPKR(v)} />
              <Area type="monotone" dataKey="total" stroke="#b45309" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Payment Methods</h2>
          {data.paymentBreakdown.length === 0 ? (
            <p className="text-sm text-stone-500">No orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                {/*
                  A percentage radius keeps the pie inside whatever width the
                  card ends up with. Labels are drawn outside the arc, so at
                  narrow widths they were being clipped by the card edge — a
                  legend below carries the same information and can't overflow.
                */}
                <Pie data={data.paymentBreakdown} dataKey="count" nameKey="method" outerRadius="75%">
                  {data.paymentBreakdown.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend verticalAlign="bottom" height={24} iconSize={10} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/*
        Recent Orders carries four columns to Top Products' two, so an even
        split starves it. It takes 2/3 here, and the pair only sits side by side
        from xl — below that the content area is too narrow for both at once.
      */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <h2 className="border-b border-stone-200 p-4 font-semibold">Recent Orders</h2>
          {data.recentOrders.length === 0 ? (
            <p className="td text-stone-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem]">
                <tbody className="divide-y divide-stone-100">
                  {data.recentOrders.map((o: any) => (
                    <tr key={o.id}>
                      <td className="td">
                        <Link to={`/orders/${o.id}`} className="font-medium text-brand">{o.orderNumber}</Link>
                        <p className="text-xs text-stone-500">{o.user?.name}</p>
                      </td>
                      <td className="td whitespace-nowrap">{o.status}</td>
                      <td className="td whitespace-nowrap text-right font-medium">{formatPKR(o.total)}</td>
                      <td className="td whitespace-nowrap text-right text-xs text-stone-500">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card overflow-hidden">
          <h2 className="border-b border-stone-200 p-4 font-semibold">Top Products</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-stone-100">
                {data.topProducts.map((p: any) => (
                  <tr key={p.title}>
                    <td className="td">{p.title}</td>
                    <td className="td whitespace-nowrap text-right font-medium">{p.sold} sold</td>
                  </tr>
                ))}
                {data.topProducts.length === 0 && (
                  <tr><td className="td text-stone-500">No sales yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
