import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Ticket,
  LayoutTemplate,
  Users,
  Star,
  FileText,
  Settings,
  Mail,
  History,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// `adminOnly` mirrors the server's RBAC (apps/api/src/modules/admin/index.ts).
// Hiding a link is a courtesy, not a control — the API refuses these routes for
// STAFF regardless of what the sidebar shows.
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: FolderTree },
  { to: '/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/coupons', label: 'Coupons', icon: Ticket, adminOnly: true },
  { to: '/sections', label: 'Homepage', icon: LayoutTemplate },
  { to: '/users', label: 'Customers & Users', icon: Users, adminOnly: true },
  { to: '/reviews', label: 'Reviews', icon: Star },
  { to: '/pages', label: 'Pages', icon: FileText },
  { to: '/emails', label: 'Emails', icon: Mail, adminOnly: true },
  { to: '/activity', label: 'Activity Log', icon: History, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

/**
 * Admin shell.
 *
 * The sidebar is 240px of permanently-reserved width, which is why content used
 * to be squeezed long before the viewport looked narrow: a `lg:` breakpoint
 * fires at a 1024px *viewport*, but the content area is only 784px by then.
 * Below `lg` the sidebar becomes an overlay drawer instead, so narrow screens
 * get the full width rather than a 240px tax on it.
 */
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Navigating on mobile should dismiss the drawer, otherwise it covers the
  // page the user just asked for.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const links = NAV.filter((n) => !n.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="h-screen overflow-hidden">
      {/* Mobile top bar — the only way to reach the nav below lg. */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-stone-200 bg-white px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-md p-2 text-stone-600 hover:bg-stone-100"
        >
          <Menu size={20} />
        </button>
        <p className="font-serif text-base font-bold">Aabroo Admin</p>
      </header>

      {/* Backdrop. Only mounted while open so it can never eat clicks on desktop. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-stone-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <p className="font-serif text-lg font-bold">Aabroo Admin</p>
            <p className="text-xs text-stone-500">Store management</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="-mr-2 rounded-md p-1 text-stone-500 hover:bg-stone-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {links.map((n) => (
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
              <n.icon size={18} className="shrink-0" /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-stone-200 p-3">
          <div className="truncate px-2 pb-2 text-xs text-stone-500">
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

      {/* pt-14 clears the mobile top bar; lg:ml-60 clears the docked sidebar. */}
      <main className="app-scroll h-full p-4 pt-[4.5rem] sm:p-6 sm:pt-[4.5rem] lg:ml-60 lg:pt-6">
        <Outlet />
      </main>
    </div>
  );
}
