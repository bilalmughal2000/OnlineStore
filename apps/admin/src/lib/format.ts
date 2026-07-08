export const formatPKR = (n: number) =>
  new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
