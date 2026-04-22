/**
 * Client-side CSRF token utilities.
 *
 * The middleware sets a `csrf-token` cookie (httpOnly: false) on every
 * authenticated page load. These helpers read that cookie value so it
 * can be echoed back as the `X-CSRF-Token` request header on mutations.
 */

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Read the CSRF token from the `csrf-token` cookie.
 * Returns an empty string when running on the server (SSR) or when the
 * cookie is not present.
 */
export function getCSRFToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Return a plain object containing the `X-CSRF-Token` header.
 * Useful for spreading into fetch `headers` on state-changing requests.
 *
 * ```ts
 * fetch('/api/foo', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export function csrfHeaders(): Record<string, string> {
  const token = getCSRFToken();
  if (!token) return {};
  return { [CSRF_HEADER_NAME]: token };
}
