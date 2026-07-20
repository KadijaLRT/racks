/**
 * Basic SSRF guard for any route that fetches a URL supplied by the
 * client (e.g. product-link import). Rejects non-http(s) schemes and
 * obvious private/loopback/link-local/metadata-endpoint targets before
 * the server ever issues the fetch. This is a defense-in-depth check,
 * not a full DNS-rebinding-proof sandbox, but it stops the common,
 * cheap SSRF attempts (localhost, 169.254.169.254, internal IP ranges).
 */
export function isSafeExternalUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return false;
  }

  // Cloud metadata endpoint, a classic SSRF target.
  if (hostname === "169.254.169.254") return false;

  // Reject numeric IPs in private/loopback/link-local ranges.
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
    if (a === 127) return false; // loopback
    if (a === 10) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 169 && b === 254) return false; // link-local
    if (a === 0) return false;
  }

  if (hostname === "::1" || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) {
    return false; // IPv6 loopback / link-local / unique-local
  }

  return true;
}
