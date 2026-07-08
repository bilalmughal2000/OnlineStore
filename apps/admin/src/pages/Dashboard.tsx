import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ShoppingCart, Users, Banknote, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPKR, formatDate } from '@/lib/format';

const COLORS = ['#b45309', '#0d9488', '#6366f1', '#be123c'];

export function Dashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(setData).catch(console.error);
  }, []);

  if (!data) return <p className="text-stone-500">Loading dashboard…</p>;

  const kpis = [
    { label: 'Total Orders', value: data.kpis.totalOrders, icon: ShoppingCart },
    { label: 'Pending Orders', value: data.kpis.pendingOrders, icon: ShoppingCart },
    { label: 'Customers', value: data.kpis.totalCustomers, icon: Users },
    { label: 'Paid Revenue', value: formatPKR(data.kpis.paidRevenue), icon: Banknote },
    { label: 'Low Stock', value: data.kpis.lowStockCount, icon: AlertTriangle },
  ];

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <k.icon className="text-brand" size={20} />
            <p className="mt-2 text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-stone-500">{k.label}</p>
          </div>
        ))}
      </div>

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
                <Pie data={data.paymentBreakdown} dataKey="count" nameKey="method" outerRadius={90} label>
                  {data.paymentBreakdown.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h2 className="border-b border-stone-200 p-4 font-semibold">Recent Orders</h2>
          <table className="w-full">
            <tbody className="divide-y divide-stone-100">
              {data.recentOrders.map((o: any) => (
                <tr key={o.id}>
                  <td className="td">
                    <Link to={`/orders/${o.id}`} className="font-medium text-brand">{o.orderNumber}</Link>
                    <p className="text-xs text-stone-500">{o.user?.name}</p>
                  </td>
                  <td className="td">{o.status}</td>
                  <td className="td text-right font-medium">{formatPKR(o.total)}</td>
                  <td className="td text-right text-xs text-stone-500">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <h2 className="border-b border-stone-200 p-4 font-semibold">Top Products</h2>
          <table className="w-full">
            <tbody className="divide-y divide-stone-100">
              {data.topProducts.map((p: any) => (
                <tr key={p.title}>
                  <td className="td">{p.title}</td>
                  <td className="td text-right font-medium">{p.sold} sold</td>
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
  );
}
