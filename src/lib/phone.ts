// Nigerian phone numbers in, E.164 out: "0803 000 0000" -> "+2348030000000".
// Returns null if the number doesn't look valid.
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) digits = "234" + digits.slice(1);
  if (digits.startsWith("234") && digits.length === 13) return "+" + digits;
  // Other countries: accept a plausible international number given with a leading +.
  if (input.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return "+" + digits;
  return null;
}

// Nannies sign in with phone + PIN; Supabase Auth sees a synthetic email.
export function nannyEmail(e164: string) {
  return `${e164.replace(/\D/g, "")}@nanny.prep.app`;
}

export function isPin(pin: string) {
  return /^\d{6}$/.test(pin);
}
