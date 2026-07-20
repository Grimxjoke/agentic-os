import { randomBytes } from "node:crypto";
import { constantTimeTextEqual, hashToken } from "./security.mjs";
import { cookieValue, sessionCookie } from "./http.mjs";

export function createAuth({ accessToken, store }) {
  const cookieName = "orbit_session";
  const legacyCookieName = "orbit_access";

  function createSession(req, requestedLabel = "") {
    const token = randomBytes(32).toString("base64url");
    const label = String(requestedLabel || req.headers["user-agent"] || "Orbit browser").slice(0, 120);
    const session = store.createAccessSession({ tokenHash: hashToken(token), label });
    return { session, token };
  }

  function authenticate(req) {
    const token = cookieValue(req, cookieName);
    if (token) {
      const session = store.findActiveAccessSession(hashToken(token));
      if (session) {
        store.touchAccessSession(session.id);
        return { session, legacy: false };
      }
    }
    const legacy = cookieValue(req, legacyCookieName);
    if (legacy && constantTimeTextEqual(legacy, accessToken)) return { session: null, legacy: true };
    return null;
  }

  function accessMatches(candidate) {
    return constantTimeTextEqual(candidate, accessToken);
  }

  function establish(req, options = {}) {
    const secure = req.headers["x-forwarded-proto"] === "https";
    const created = createSession(req, options.label);
    return {
      ...created,
      cookies: [
        sessionCookie(cookieName, created.token, secure),
        sessionCookie(legacyCookieName, "", secure, 0),
      ],
    };
  }

  function clearCookies(req) {
    const secure = req.headers["x-forwarded-proto"] === "https";
    return [sessionCookie(cookieName, "", secure, 0), sessionCookie(legacyCookieName, "", secure, 0)];
  }

  return { authenticate, accessMatches, establish, clearCookies, cookieName };
}
