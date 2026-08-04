import { ApiError } from './client-api';

/**
 * Turns an API validation failure into something a shopper can act on.
 *
 * The API already reports exactly which field failed and why — e.g.
 * `{ path: "newAddress.phone", message: "Enter a valid Pakistani mobile number" }`.
 * Showing only the top-level "Validation failed" leaves the buyer staring at a
 * full form with no idea what to change, which on a checkout page means an
 * abandoned order.
 */

/** Field path → message, first issue per field wins. */
export function fieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!(err instanceof ApiError)) return out;
  for (const issue of err.details) {
    if (issue?.path && !out[issue.path]) out[issue.path] = issue.message;
  }
  return out;
}

/**
 * A readable summary naming each bad field.
 *
 * @param labels maps an API path to the label shown on the form, so the message
 *               matches what the user is actually looking at.
 */
export function readableError(
  err: unknown,
  labels: Record<string, string> = {},
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(err instanceof ApiError)) return fallback;

  const issues = err.details.filter((i) => i?.message);
  if (issues.length === 0) return err.message || fallback;

  const parts = issues.map((i) => {
    const label = labels[i.path] ?? prettyPath(i.path);
    return label ? `${label}: ${i.message}` : i.message;
  });

  return parts.length === 1
    ? parts[0]
    : `Please fix ${parts.length} fields — ${parts.join(' · ')}`;
}

/** Last-resort label when a path isn't mapped: "newAddress.postalCode" → "Postal code". */
function prettyPath(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  const spaced = leaf.replace(/([A-Z])/g, ' $1').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
