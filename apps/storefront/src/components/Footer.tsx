import Link from 'next/link';
import { SOCIAL_NETWORKS, type SocialSettings } from '@store/shared-types';
import { FooterColumn } from '@/components/FooterColumn';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Music2,
  RotateCcw,
  ShieldCheck,
  Truck,
  Twitter,
  Youtube,
} from 'lucide-react';

interface MenuLink {
  id: string;
  label: string;
  url: string;
}

/* The network list is shared with the admin (see @store/shared-types); only the
   icon for each one is a storefront concern. */
const SOCIAL_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  twitter: Twitter,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  email: Mail,
};

const TRUST = [
  { icon: Banknote, t: 'Cash on Delivery' },
  { icon: Truck, t: 'Delivery in 3–5 days' },
  { icon: RotateCcw, t: '7-day returns' },
  { icon: ShieldCheck, t: 'Secure payments' },
];

/** An email or bare phone number needs a scheme before it's a usable link. */
function href(id: string, url: string): string {
  const value = url.trim();
  if (id === 'email') return value.startsWith('mailto:') ? value : `mailto:${value}`;
  if (id === 'whatsapp' && !/^https?:/i.test(value)) return `https://wa.me/${value.replace(/[^\d]/g, '')}`;
  return /^https?:/i.test(value) ? value : `https://${value}`;
}

/*
 * Footer.
 *
 * Deliberately dense: a slim promise bar, one row of link columns, a thin legal
 * strip. Dark ground so it closes the page instead of competing with the product
 * grid above it, and it stays under ~300px on a laptop — it scrolls with the
 * content, so every extra row is height a shopper has to travel past.
 */
export function Footer({
  links,
  categories = [],
  storeName,
  social = {},
}: {
  /** Managed footer menu items (static pages). */
  links: MenuLink[];
  /** Top-level categories, so the footer offers real shopping routes. */
  categories?: MenuLink[];
  storeName: string;
  social?: SocialSettings;
}) {
  // Only networks the admin filled in *and* left switched on.
  const socials = SOCIAL_NETWORKS.filter((n) => {
    const entry = social[n.id];
    return entry?.enabled && entry.url?.trim();
  }).map((n) => ({ ...n, Icon: SOCIAL_ICONS[n.id] ?? Mail }));

  return (
    <footer className="mt-14 bg-ink text-cream">
      {/* Accent hairline: closes the page on a brand note instead of a hard edge. */}
      <div className="h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />

      {/* Promise bar — one line, four short claims. */}
      <div className="border-b border-white/[0.08]">
        <ul className="container-x grid grid-cols-2 gap-y-2 py-3 sm:grid-cols-4">
          {TRUST.map(({ icon: Icon, t }) => (
            <li key={t} className="flex items-center gap-2 text-[12px] text-cream/70">
              <Icon size={14} className="shrink-0 text-accent-light" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Brand + link columns. Two-up on phones so the stack stays short. */}
      <div className="container-x grid gap-x-10 gap-y-1 py-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:gap-y-6 md:py-8">
        <div className="mb-3 md:mb-0">
          <p className="font-serif text-lg font-bold leading-none">{storeName}</p>
          <p className="mt-1.5 max-w-[34ch] text-[12.5px] leading-snug text-cream/50 md:mt-2 md:text-[13px] md:leading-relaxed">
            Modern Pakistani fashion, delivered nationwide with Cash on Delivery.
          </p>

          {socials.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5 md:mt-4">
              {socials.map(({ id, label, Icon }) => (
                <li key={id}>
                  <a
                    href={href(id, social[id]!.url!)}
                    target={id === 'email' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.07] text-cream/70 transition-colors hover:bg-accent hover:text-white"
                  >
                    <Icon size={15} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FooterColumn title="Shop">
          {categories.slice(0, 5).map((c) => (
            <FooterLink key={c.id} href={c.url}>
              {c.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Help">
          {links.map((l) => (
            <FooterLink key={l.id} href={l.url}>
              {l.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="Account">
          <FooterLink href="/account/orders">My orders</FooterLink>
          <FooterLink href="/order-lookup">Track order</FooterLink>
          <FooterLink href="/wishlist">Wishlist</FooterLink>
          <FooterLink href="/cart">Cart</FooterLink>
        </FooterColumn>
      </div>

      {/* Legal strip — copyright only, centred. */}
      <div className="border-t border-white/[0.08]">
        <p className="container-x py-3.5 text-center text-[11px] text-cream/35">
          © {new Date().getFullYear()} {storeName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterLink({ href: to, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={to} className="text-[13px] text-cream/60 transition-colors hover:text-accent-light">
        {children}
      </Link>
    </li>
  );
}
