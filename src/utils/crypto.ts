import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * Verify WooCommerce webhook HMAC-SHA256 signature.
 * WooCommerce signs the raw body with the webhook secret and sends
 * the base64-encoded result in the x-wc-webhook-signature header.
 */
export function verifyWooCommerceSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  const computed = createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(computed, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * Generate a random hex string for tokens/secrets.
 */
export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
