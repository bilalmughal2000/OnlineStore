import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

/**
 * Wraps routes the API only serves to ADMIN.
 *
 * A STAFF user who types one of these URLs would otherwise land on a page that
 * fires a request, gets a 403, and renders empty — which reads as a broken app
 * rather than a permission boundary. This says so plainly instead.
 *
 * Purely cosmetic: the real enforcement is server-side.
 */
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <>{children}</>;

  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <ShieldAlert className="mx-auto mb-4 text-stone-400" size={40} />
      <h1 className="mb-2 font-serif text-xl font-bold">Owner access only</h1>
      <p className="mb-6 text-sm text-stone-500">
        This section is limited to store owners. Ask an administrator if you need it.
      </p>
      <Link to="/" className="btn-outline inline-flex">
        Back to dashboard
      </Link>
    </div>
  );
}
