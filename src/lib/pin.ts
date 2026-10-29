import "server-only";
import { createHmac } from "node:crypto";

// The Supabase password for a nanny is never the PIN itself: it is
// HMAC-SHA256(NANNY_PIN_SECRET, phone + PIN). Without the server secret, guessing
// PINs directly against Supabase Auth is useless, so every guess has to go through
// our sign-in action and its per-phone lockout.
//
// Changing or losing NANNY_PIN_SECRET invalidates every nanny's login; each nanny
// then needs a new setup link.
export function pinPassword(e164: string, pin: string) {
  const secret = process.env.NANNY_PIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("NANNY_PIN_SECRET is missing or shorter than 32 characters");
  }
  return createHmac("sha256", secret).update(`${e164}:${pin}`).digest("base64url");
}
