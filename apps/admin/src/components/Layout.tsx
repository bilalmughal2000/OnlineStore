import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Ticket,
  LayoutTemplate,
  Image as ImageIcon,
  Users,
  UserCog,
  Star,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/coupons', label: 'Coupons', icon: Ticket },
  { to: '/banners', label: 'Banners', icon: ImageIcon },
  { to: '/sections', label: 'Homepage', icon: LayoutTemplate },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/users', label: 'Users', icon: UserCog },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/pages', label: 'Pages', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-stone-200 bg-white">
        <div className="border-b border-stone-200 px-5 py-4">
          <p className="font-serif text-lg font-bold">Aabroo Admin</p>
          <p className="text-xs text-stone-500">Store management</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-brand/10 text-brand' : 'text-stone-600 hover:bg-stone-100'
                }`
              }
            >
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-stone-200 p-3">
          <div className="px-2 pb-2 text-xs text-stone-500">
            {user?.name} · {user?.role}
          </div>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="btn-outline w-full"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>
      </aside>
      <main className="app-scroll ml-60 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
