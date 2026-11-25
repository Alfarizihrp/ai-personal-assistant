import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionRole } from "@/lib/auth";

export async function getServerSession(): Promise<{ role: SessionRole; user: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function isGuestSession(): Promise<boolean> {
  const session = await getServerSession();
  return session?.role === "guest";
}
