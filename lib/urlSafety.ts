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

  // Reject numeric IPs in private/loopback/link-local ranges. Also
  // reject alternate IP encodings (decimal, hex, octal) that a plain
  // dotted-quad regex would miss entirely, letting them fall through
  // as "safe" (e.g. 2130706433 or 0x7f000001 both mean 127.0.0.1) —
  // Node's own resolver still accepts these, so the regex check alone
  // was not actually a complete guard.
  if (/^0x[0-9a-f]+$/.test(hostname) || /^0[0-7]+$/.test(hostname) || /^\d+$/.test(hostname)) {
    return false;
  }

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = [ipv4[1], ipv4[2], ipv4[3], ipv4[4]].map((s) => parseInt(s, 10));
    if (octets.some((n) => n > 255)) return false; // malformed, reject rather than let it slide through
    const [a, b] = octets;
    if (a === 127) return false; // loopback
    if (a === 10) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 169 && b === 254) return false; // link-local
    if (a === 0) return false;
  } else if (/^[0-9a-f.]+$/.test(hostname) && hostname.split(".").some((part) => /^0[0-7]*$/.test(part) && part !== "0")) {
    // Octal-per-octet form (e.g. 0177.0.0.1), also a known bypass for
    // naive dotted-quad regexes.
    return false;
  }

  // WHATWG's URL.hostname includes the brackets for IPv6 literals
  // (e.g. "[::1]", not "::1"); comparing against the unbracketed form
  // meant every IPv6 check here previously never matched real input.
  const ipv6 = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (
    ipv6 === "::1" ||
    ipv6 === "::" ||
    ipv6.startsWith("fe80:") ||
    ipv6.startsWith("fc") ||
    ipv6.startsWith("fd") ||
    ipv6.startsWith("::ffff:127.") // IPv4-mapped loopback
  ) {
    return false;
  }

  return true;
}
