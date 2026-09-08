import crypto from "crypto";

// Crockford-style alphabet: no O/0, I/1, S/5 so codes read cleanly off a
// lecture hall projector and are hard to mistype.
const ALPHABET = "ABCDEFGHJKLMNPQRTUVWXY2346789";
const CODE_LENGTH = 6;

export function generateCode(length = CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

/**
 * Generates a code that passes `isTaken`, retrying on collision. The unique
 * index stays the real guarantee; this just avoids surfacing a 500 to the user.
 */
export async function generateUniqueCode(
  isTaken: (code: string) => Promise<boolean>,
  attempts = 10
): Promise<string> {
  for (let i = 0; i < attempts; i += 1) {
    const code = generateCode();
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Could not generate an unused code after multiple attempts");
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
