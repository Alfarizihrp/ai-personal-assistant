import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "akhi_session";

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET_KEY belum dikonfigurasi atau kurang dari 32 karakter.");
  }
  return new TextEncoder().encode(secret);
};

export type SessionRole = "owner" | "guest";

export async function createSessionToken(role: SessionRole = "owner"): Promise<string> {
  const expiration = role === "guest" ? "30m" : "7d";
  const userName = role === "guest" ? "Recruiter Demo" : "Akhi";

  return await new SignJWT({ role, user: userName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<{ role: SessionRole; user: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      role: (payload.role as SessionRole) || "owner",
      user: (payload.user as string) || "Akhi",
    };
  } catch {
    return null;
  }
}