import { redirect } from 'next/navigation';

// The wishlist moved to /wishlist: it works without an account, and keeping it
// under /account implied a login was needed. This keeps old links working.
export default function AccountWishlistRedirect() {
  redirect('/wishlist');
}
