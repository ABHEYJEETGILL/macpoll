import { randomBytes } from "crypto";

// Excludes I, O, 0, 1 so codes read aloud in a lecture hall are unambiguous.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Cryptographically random code over an unambiguous alphabet. */
export function generateCode(length = 6): string {
  // Rejection-sample so every letter is equally likely (256 % 32 === 0 here,
  // so a plain modulo is already uniform, but keep it explicit).
  const max = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= max) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/**
 * Generates a code that is not already taken, retrying on collision. Returns
 * null if the space is too crowded to find one, so callers surface a real error
 * rather than writing a duplicate.
 */
export async function generateUniqueCode(
  exists: (code: string) => Promise<boolean>,
  length = 6,
  attempts = 10
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode(length);
    if (!(await exists(code))) return code;
  }
  return null;
}
