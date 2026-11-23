import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.JWT_SECRET_KEY;
if (!secretKey) {
  throw new Error("JWT_SECRET_KEY belum diatur di environment variables.");
}

const encodedKey = new TextEncoder().encode(secretKey);
export const SESSION_COOKIE_NAME = "akhi_secure_session";

export async function createSessionToken() {
  return await new SignJWT({ role: "owner", user: "Akhi" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(encodedKey);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch {
    return null;
  }
}