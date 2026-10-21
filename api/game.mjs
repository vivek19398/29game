import {
  randomBytes,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { fresh, apply, view } from "../lib/engine.mjs";
const hash = (s) => createHash("sha256").update(s).digest("hex");
const equal = (a, b) =>
  timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
function config() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, FAMILY_PASSWORD, SESSION_SECRET } =
    process.env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_SECRET_KEY ||
    !FAMILY_PASSWORD ||
    FAMILY_PASSWORD.length < 4 ||
    !SESSION_SECRET ||
    SESSION_SECRET.length < 32
  )
    throw Error("SETUP");
  return {
    url: SUPABASE_URL.replace(/\/$/, ""),
    key: SUPABASE_SECRET_KEY,
    password: FAMILY_PASSWORD,
    secret: SESSION_SECRET,
  };
}
async function db(c, path, method = "GET", body) {
  const r = await fetch(c.url + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: c.key,
      ...(c.key.startsWith("sb_") ? {} : { Authorization: "Bearer " + c.key }),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw Error("DATABASE");
  return r.status === 204 ? null : r.json();
}
const sign = (s, c) => createHmac("sha256", c.secret).update(s).digest("hex");
function authenticated(req, c) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("family29="))
    ?.slice(9);
  if (!cookie) return false;
  const [exp, sig] = cookie.split(".");
  return (
    /^\d+$/.test(exp) &&
    Number(exp) > Date.now() &&
    equal(sig || "", sign(exp, c))
  );
}
export function createHandler({
  getConfig = config,
  database = db,
  localTest = false,
  advanceComputers = () => {},
} = {}) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Vary", "Cookie");
    const send = (s, b) => {
      res.statusCode = s;
      res.end(JSON.stringify(b));
    };
    try {
      if (req.method !== "POST") return send(405, { error: "Use POST." });
      // Reject cross-origin browser requests; cookies are also SameSite=Strict.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host)
        return send(403, { error: "Open this game directly." });
      const c = getConfig();
      let b = req.body;
      if (b === undefined) {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 5000)
            return send(413, { error: "Request too large." });
        }
        b = JSON.parse(raw);
      }
      if (typeof b === "string") b = JSON.parse(b);
      if (!b || typeof b !== "object")
        return send(400, { error: "Invalid request." });
      const ip = String(
        req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      )
        .split(",")[0]
        .trim();
      if (b.action === "unlock") {
        const ok = await database(c, "rpc/twenty_nine_rate_limit", "POST", {
          p_key: "login:" + hash(ip),
          p_max: 10,
          p_seconds: 900,
        });
        if (!ok)
          return send(429, {
            error: "Too many attempts. Try again in 15 minutes.",
          });
        if (typeof b.password !== "string" || !equal(b.password, c.password))
          return send(401, { error: "That family password is incorrect." });
        const exp = String(Date.now() + 30 * 86400000);
        res.setHeader(
          "Set-Cookie",
          `family29=${exp}.${sign(exp, c)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${process.env.VERCEL ? "; Secure" : ""}`,
        );
        return send(200, { ok: true, localTest });
      }
      if (!authenticated(req, c))
        return send(401, {
          error: "Enter your family password.",
          locked: true,
        });
      if (b.action === "session") return send(200, { ok: true, localTest });
      if (b.action === "logout") {
        res.setHeader(
          "Set-Cookie",
          "family29=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return send(200, { ok: true, localTest });
      }
      const limited = await database(c, "rpc/twenty_nine_rate_limit", "POST", {
        p_key: "api:" + hash(ip),
        p_max: 240,
        p_seconds: 60,
      });
      if (!limited)
        return send(429, { error: "Please slow down for a moment." });
      if (b.action === "create") {
        const allowed = await database(
          c,
          "rpc/twenty_nine_rate_limit",
          "POST",
          {
            p_key: "create:" + hash(ip),
            p_max: 12,
            p_seconds: 3600,
          },
        );
        if (!allowed)
          return send(429, {
            error: "Room limit reached. Join an existing table.",
          });
        const g = fresh(),
          token = randomBytes(32).toString("hex"),
          code = randomBytes(4).toString("hex").toUpperCase();
        const name = validName(b.name);
        g.players.push({ name, tokenHash: hash(token), hand: [] });
        if (localTest) {
          g.localTest = true;
          for (const name of [
            "Mina · Computer",
            "Ravi · Computer",
            "Tara · Computer",
          ])
            g.players.push({
              name,
              tokenHash: hash(randomBytes(32).toString("hex")),
              hand: [],
            });
        }
        await database(c, "twenty_nine_rooms", "POST", { code, state: g });
        return send(200, { code, token, game: view(g, 0) });
      }
      if (typeof b.code !== "string" || !/^[A-F0-9]{8}$/.test(b.code))
        return send(400, { error: "Enter an eight-character table code." });
      const path = "twenty_nine_rooms?code=eq." + b.code;
      const rows = await database(c, path + "&select=state,version");
      if (!rows.length) return send(404, { error: "Table not found." });
      const { state: g, version } = rows[0];
      g.version = version;
      const seat =
        typeof b.token === "string"
          ? g.players.findIndex((p) => p.tokenHash === hash(b.token))
          : -1;
      if (b.action === "join" && seat === -1) {
        if (g.phase !== "lobby" || g.players.length === 4)
          return send(409, { error: "This table is full or has started." });
        const name = validName(b.name);
        if (g.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
          return send(400, { error: "Choose a different name at this table." });
        const token = randomBytes(32).toString("hex");
        g.players.push({ name, tokenHash: hash(token), hand: [] });
        const result = await database(
          c,
          path + "&version=eq." + version,
          "PATCH",
          {
            state: g,
            version: version + 1,
            updated_at: new Date().toISOString(),
          },
        );
        if (!result.length)
          return send(409, { error: "The table changed. Please join again." });
        g.version++;
        return send(200, {
          code: b.code,
          token,
          game: view(g, g.players.length - 1),
        });
      }
      if (seat < 0)
        return send(403, {
          error: "Your saved seat is unavailable. Join the table again.",
        });
      if (b.action === "state" || b.action === "join")
        return send(200, { game: view(g, seat) });
      if (b.action !== "move" || !b.command || typeof b.command !== "object")
        return send(400, { error: "Unknown request." });
      if (b.version !== version)
        return send(409, { error: "The table changed. Try your move again." });
      try {
        apply(g, seat, b.command);
        if (localTest) advanceComputers(g);
      } catch (e) {
        return send(400, { error: e.message });
      }
      g.version++;
      const result = await database(
        c,
        path + "&version=eq." + version,
        "PATCH",
        {
          state: g,
          version: g.version,
          updated_at: new Date().toISOString(),
        },
      );
      if (!result.length)
        return send(409, { error: "The table changed. Try your move again." });
      return send(200, { game: view(g, seat) });
    } catch (e) {
      if (e instanceof SyntaxError)
        return send(400, { error: "Invalid request." });
      console.error(
        "[twenty-nine]",
        e.message === "SETUP"
          ? "Missing environment configuration"
          : e.message === "DATABASE"
            ? "Supabase operation failed"
            : "Request failed",
      );
      return send(503, {
        error:
          e.message === "SETUP"
            ? "Configure Supabase, FAMILY_PASSWORD (4+ characters) and SESSION_SECRET (32+ characters) in Vercel."
            : "Game service unavailable. Check Supabase setup and try again.",
      });
    }
  };
}
export default createHandler();
function validName(s) {
  if (typeof s !== "string" || !s.trim() || s.trim().length > 24)
    throw new SyntaxError("Name required");
  return s.trim();
}
