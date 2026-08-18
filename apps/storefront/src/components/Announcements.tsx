'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Sparkles, X } from 'lucide-react';
import type { Announcement } from '@/lib/types';

/*
 * Event announcements — a sale, a holiday, a store notice.
 *
 * The rule this component is built around: never be annoying.
 *   · The modal shows once per announcement per browser. Dismiss it and it's
 *     gone; the ribbon carries the message from then on.
 *   · Editing an announcement in the admin makes it eligible again (the dismiss
 *     key includes updatedAt), so a genuinely new message isn't silenced by an
 *     old dismissal.
 *   · It never opens on the cart, checkout or order-confirmation pages —
 *     interrupting someone who is paying is the worst possible moment.
 *   · It waits a beat after load rather than slamming in over a half-drawn page,
 *     and closes on the backdrop, the X, or Escape.
 *
 * With more than one announcement live at once (an Eid sale *and* a shipping
 * notice, say), priority is the admin's sortOrder and the two placements behave
 * differently on purpose:
 *   · The ribbon ROTATES through all of them, a few seconds each, so every
 *     message gets seen. One live announcement means no rotation at all.
 *   · The popup shows exactly ONE per visit — the highest-priority one not yet
 *     dismissed. Dismissing it does not promote the next one into a second
 *     popup; that one waits for a later visit. Back-to-back popups are the
 *     fastest way to make a shopper leave.
 */

const DISMISS_PREFIX = 'store_ann_dismissed:';

function dismissKey(a: Announcement, kind: 'modal' | 'ribbon') {
  return `${DISMISS_PREFIX}${kind}:${a.id}:${a.updatedAt}`;
}

function isDismissed(a: Announcement, kind: 'modal' | 'ribbon') {
  try {
    return localStorage.getItem(dismissKey(a, kind)) === '1';
  } catch {
    return false;
  }
}

function markDismissed(a: Announcement, kind: 'modal' | 'ribbon') {
  try {
    localStorage.setItem(dismissKey(a, kind), '1');
  } catch {
    /* private mode — it'll show again next visit, which is acceptable */
  }
}

/** Never interrupt these journeys. */
const QUIET_PATHS = ['/cart', '/checkout', '/order-confirmation'];

/** One popup per browsing session, however many announcements are live. */
const SESSION_MODAL_KEY = 'store_ann_modal_shown';

/** How long each message holds the ribbon before the next one slides in. */
const ROTATE_MS = 6000;

function useCountdown(endDate?: string | null): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!endDate) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [endDate]);

  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function CouponChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="group inline-flex items-center gap-2 rounded-xl border border-dashed border-accent/40 bg-accent/5 px-3 py-2 text-sm font-semibold tracking-wide text-accent transition-colors hover:bg-accent/10"
    >
      {code}
      {copied ? <Check size={14} /> : <Copy size={14} className="opacity-60 group-hover:opacity-100" />}
      <span className="sr-only">Copy discount code</span>
    </button>
  );
}

export function Announcements({ announcements }: { announcements: Announcement[] }) {
  const pathname = usePathname();
  const quiet = QUIET_PATHS.some((p) => pathname.startsWith(p));

  // Rendering is gated on mount so the server never disagrees with what a
  // browser holding a dismissal shows.
  const [ready, setReady] = useState(false);
  const [modalFor, setModalFor] = useState<Announcement | null>(null);
  // Every ribbon-eligible announcement the shopper hasn't dismissed, in priority
  // order — the strip rotates through them.
  const [ribbonQueue, setRibbonQueue] = useState<Announcement[]>([]);
  const [ribbonIndex, setRibbonIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const forModal = useMemo(
    () => announcements.filter((a) => a.placement === 'modal' || a.placement === 'both'),
    [announcements],
  );
  const forRibbon = useMemo(
    () => announcements.filter((a) => a.placement === 'ribbon' || a.placement === 'both'),
    [announcements],
  );

  // Dismissal state lives in localStorage, so the queue can only be built once
  // mounted — before that the server and the browser would disagree.
  useEffect(() => {
    setRibbonQueue(forRibbon.filter((a) => !isDismissed(a, 'ribbon')));
    setRibbonIndex(0);
    setReady(true);
  }, [forRibbon]);

  const ribbonFor = ribbonQueue[ribbonIndex] ?? null;

  // Rotate the strip. A single message doesn't rotate, and hovering holds the
  // current one so it can actually be read and clicked.
  useEffect(() => {
    if (ribbonQueue.length < 2 || paused) return;
    const t = setInterval(() => setRibbonIndex((i) => (i + 1) % ribbonQueue.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [ribbonQueue.length, paused]);

  useEffect(() => {
    if (quiet) return;
    // One popup per visit: the top-priority announcement still undismissed.
    // Without the session guard, dismissing one would immediately promote the
    // next into a second popup.
    try {
      if (sessionStorage.getItem(SESSION_MODAL_KEY) === '1') return;
    } catch {
      /* private mode — fall through, the per-announcement dismissal still applies */
    }
    const next = forModal.find((a) => !isDismissed(a, 'modal'));
    if (!next) return;

    // Let the page paint first.
    const t = setTimeout(() => {
      setModalFor(next);
      try {
        sessionStorage.setItem(SESSION_MODAL_KEY, '1');
      } catch {
        /* ignore */
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [quiet, forModal]);

  const closeModal = useCallback(() => {
    if (modalFor) markDismissed(modalFor, 'modal');
    setModalFor(null);
  }, [modalFor]);

  /** X on the strip clears every message currently in rotation, not just this one. */
  const dismissRibbon = useCallback(() => {
    ribbonQueue.forEach((a) => markDismissed(a, 'ribbon'));
    setRibbonQueue([]);
    setRibbonIndex(0);
  }, [ribbonQueue]);

  useEffect(() => {
    if (!modalFor) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeModal();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalFor, closeModal]);

  const modalCountdown = useCountdown(modalFor?.showCountdown ? modalFor.endDate : null);
  const ribbonCountdown = useCountdown(ribbonFor?.showCountdown ? ribbonFor.endDate : null);

  if (!ready || !announcements.length) return null;

  return (
    <>
      {/* ── Ribbon: quiet, persistent, one line, rotating when several are live ── */}
      {ribbonFor && !quiet && (
        <div
          className="relative z-30 border-b border-black/5 bg-gradient-to-r from-accent/[0.12] via-accent/[0.07] to-accent/[0.12]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          aria-live="polite"
        >
          {/* keyed so each message fades in as it takes its turn */}
          <div key={ribbonFor.id} className="container-x ribbon-in flex items-center gap-3 py-2">
            <Sparkles size={14} className="hidden shrink-0 text-accent sm:block" />
            {ribbonFor.badge && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                {ribbonFor.badge}
              </span>
            )}
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
              {ribbonFor.title}
              {ribbonFor.message && <span className="hidden text-ink/60 sm:inline"> — {ribbonFor.message}</span>}
            </p>
            {ribbonCountdown && (
              <span className="hidden shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-accent sm:block">
                Ends in {ribbonCountdown}
              </span>
            )}
            {ribbonFor.ctaUrl && (
              <Link
                href={ribbonFor.ctaUrl}
                className="group hidden shrink-0 items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-accent hover:text-accent-dark sm:flex"
              >
                {ribbonFor.ctaLabel || 'Shop now'}
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            {/* Dots: which of several messages this is, and a way to jump. */}
            {ribbonQueue.length > 1 && (
              <span className="hidden shrink-0 items-center gap-1 sm:flex">
                {ribbonQueue.map((a, i) => (
                  <button
                    key={a.id}
                    onClick={() => setRibbonIndex(i)}
                    aria-label={`Show announcement ${i + 1} of ${ribbonQueue.length}`}
                    aria-current={i === ribbonIndex}
                    className={`h-1.5 rounded-full transition-all ${
                      i === ribbonIndex ? 'w-4 bg-accent' : 'w-1.5 bg-accent/30 hover:bg-accent/60'
                    }`}
                  />
                ))}
              </span>
            )}
            <button
              onClick={dismissRibbon}
              aria-label={
                ribbonQueue.length > 1 ? `Dismiss all ${ribbonQueue.length} announcements` : 'Dismiss announcement'
              }
              className="shrink-0 rounded-full p-1 text-ink/40 transition-colors hover:bg-black/5 hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal: once per announcement, then never again ── */}
      {modalFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={modalFor.title}
          className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
        >
          <button
            aria-label="Close"
            onClick={closeModal}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <div className="ann-pop relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream shadow-2xl sm:rounded-3xl">
            <button
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1.5 text-ink/60 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-ink"
            >
              <X size={16} />
            </button>

            {modalFor.imageUrl && (
              <div className="relative h-40 w-full shrink-0 sm:h-48">
                <Image
                  src={modalFor.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                  className="object-cover"
                  priority
                />
                <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cream to-transparent" />
              </div>
            )}

            <div className={`px-6 pb-6 text-center ${modalFor.imageUrl ? 'pt-1' : 'pt-8'}`}>
              {modalFor.badge && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-accent">
                  <Sparkles size={12} />
                  {modalFor.badge}
                </span>
              )}
              <h2 className="mt-3 font-serif text-2xl font-bold leading-tight text-ink sm:text-3xl">
                {modalFor.title}
              </h2>
              {modalFor.message && (
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink/60">{modalFor.message}</p>
              )}

              {modalCountdown && (
                <p className="mt-4 text-[13px] font-semibold text-ink">
                  Ends in <span className="tabular-nums text-accent">{modalCountdown}</span>
                </p>
              )}

              {modalFor.couponCode && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-ink/40">Use code</p>
                  <CouponChip code={modalFor.couponCode} />
                </div>
              )}

              <div className="mt-6 flex flex-col items-center gap-2">
                {modalFor.ctaUrl && (
                  <Link href={modalFor.ctaUrl} onClick={closeModal} className="btn-primary w-full sm:w-auto sm:px-8">
                    {modalFor.ctaLabel || 'Shop the sale'}
                    <ArrowRight size={16} />
                  </Link>
                )}
                <button onClick={closeModal} className="text-[13px] text-ink/45 transition-colors hover:text-ink">
                  {modalFor.ctaUrl ? 'Maybe later' : 'Got it'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
