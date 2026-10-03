import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const scope = payload?.scope === "assessment" ? "assessment" : "application";
    const digest = typeof payload?.digest === "string" ? payload.digest.slice(0, 128) : null;
    const name = typeof payload?.name === "string" ? payload.name.slice(0, 128) : "Error";

    // Log only a narrow fingerprint, never page state or user-entered text.
    console.error("[Client error boundary]", { scope, digest, name });
  } catch {
    // Error reporting is intentionally best-effort and must never affect the UI.
  }

  return NextResponse.json({ ok: true });
}
