/* Authenticating callers.
 *
 * The inbound endpoint is a public URL that writes to the database, so an
 * unauthenticated POST must never reach the matching logic. Resend signs with
 * Svix; SendGrid's Inbound Parse does not sign at all and is protected by a
 * shared secret instead. Both paths are supported. */

const enc = new TextEncoder();

/* Compares in time independent of where the first difference falls, so a
   caller cannot learn the secret one byte at a time from response timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Fold the length difference in rather than returning early on it.
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const base64 = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const fromBase64 = (s: string): Uint8Array =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hmacSha256(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return base64(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message)));
}

export const TOLERANCE_SECONDS = 5 * 60;

/* Svix signature scheme, as used by Resend webhooks.
 *   signed content = "<id>.<timestamp>.<raw body>"
 *   header         = "v1,<sig> v1,<other sig>"   (space separated, may rotate)
 * The secret arrives as "whsec_<base64>". */
export async function verifySvix(
  secret: string,
  headers: { id: string; timestamp: string; signature: string },
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): Promise<boolean> {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  const sent = Number(headers.timestamp);
  if (!Number.isFinite(sent)) return false;
  // Rejects both replays of an old delivery and clocks skewed into the future.
  if (Math.abs(nowSeconds - sent) > TOLERANCE_SECONDS) return false;

  const key = fromBase64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  const expected = await hmacSha256(key, `${headers.id}.${headers.timestamp}.${rawBody}`);

  return headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .some((part) => {
      const value = part.startsWith("v1,") ? part.slice(3) : part;
      return constantTimeEqual(value, expected);
    });
}

/* The fallback for providers that do not sign: a secret the caller must present,
   accepted from a header or a query parameter because SendGrid's Inbound Parse
   only lets you configure a URL. */
export function verifySharedSecret(
  secret: string,
  headerValue: string | null,
  queryValue: string | null
): boolean {
  if (!secret) return false;
  const offered = headerValue?.replace(/^Bearer\s+/i, "") ?? queryValue ?? "";
  return offered !== "" && constantTimeEqual(offered, secret);
}
