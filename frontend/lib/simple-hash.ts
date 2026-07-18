/**
 * NOT cryptography. This is a simple, fast, non-cryptographic hash (a
 * standard djb2 variant) used only so a 4-digit PIN doesn't sit in
 * localStorage as plaintext during casual devtools inspection. It offers
 * no real resistance to anyone who actually wants to bypass it — do not
 * describe the PIN lock feature as "secure" anywhere in the product copy
 * because of this. A real family/child-safety PIN needs server-side
 * enforcement, which needs the auth system that's still Phase 3+.
 */
export function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
