import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Products } from '@/pages/Products';
import { ProductEditor } from '@/pages/ProductEditor';
import { Categories } from '@/pages/Categories';
import { Orders } from '@/pages/Orders';
import { OrderDetail } from '@/pages/OrderDetail';
import { Coupons } from '@/pages/Coupons';
import { Sections } from '@/pages/Sections';
import { Banners } from '@/pages/Banners';
import { Customers } from '@/pages/Customers';
import { Users } from '@/pages/Users';
import { Reviews } from '@/pages/Reviews';
import { Pages } from '@/pages/Pages';
import { Settings } from '@/pages/Settings';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="grid min-h-screen place-items-center text-stone-500">Loading…</div>;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductEditor />} />
        <Route path="products/:id" element={<ProductEditor />} />
        <Route path="categories" element={<Categories />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="coupons" element={<Coupons />} />
        <Route path="banners" element={<Banners />} />
        <Route path="sections" element={<Sections />} />
        <Route path="customers" element={<Customers />} />
        <Route path="users" element={<Users />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="pages" element={<Pages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
