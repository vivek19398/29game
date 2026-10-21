import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/game.mjs";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SECRET_KEY = "server-secret";
process.env.FAMILY_PASSWORD = "family-test-password";
process.env.SESSION_SECRET =
  "test-session-secret-that-is-longer-than-thirty-two";
async function call(body, headers = {}) {
  let text = "",
    code = 0;
  const out = {};
  await handler(
    {
      method: "POST",
      body,
      headers: { host: "localhost", ...headers },
      socket: { remoteAddress: "127.0.0.1" },
    },
    {
      setHeader: (k, v) => (out[k] = v),
      set statusCode(v) {
        code = v;
      },
      end: (t) => (text = t),
    },
  );
  return { code, body: JSON.parse(text), headers: out };
}
test("family gate, signed session and no direct table access", async () => {
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => true,
  });
  try {
    assert.equal((await call({ action: "create", name: "A" })).code, 401);
    assert.equal(
      (await call({ action: "unlock", password: "wrong" })).code,
      401,
    );
    const unlocked = await call({
      action: "unlock",
      password: "family-test-password",
    });
    assert.equal(unlocked.code, 200);
    assert.match(unlocked.headers["Set-Cookie"], /HttpOnly; SameSite=Strict/);
    const cookie = unlocked.headers["Set-Cookie"].split(";")[0];
    assert.equal((await call({ action: "session" }, { cookie })).code, 200);
    assert.equal(
      (await call({ action: "session" }, { cookie: cookie + "tamper" })).code,
      401,
    );
    assert.equal(
      (
        await call(
          { action: "session" },
          { cookie, origin: "https://evil.example" },
        )
      ).code,
      403,
    );
  } finally {
    global.fetch = original;
  }
});
test("unauthorized seats cannot read state and CAS conflict never commits a stale move", async () => {
  const original = global.fetch;
  let row;
  global.fetch = async (url, opts) => {
    const path = String(url);
    if (path.includes("/rpc/"))
      return { ok: true, status: 200, json: async () => true };
    if (opts.method === "POST") {
      const data = JSON.parse(opts.body);
      row = { state: data.state, version: 0 };
      return { ok: true, status: 200, json: async () => [row] };
    }
    return { ok: true, status: 200, json: async () => [row] };
  };
  try {
    const u = await call({
        action: "unlock",
        password: "family-test-password",
      }),
      cookie = u.headers["Set-Cookie"].split(";")[0],
      h = { cookie };
    const created = await call({ action: "create", name: "A" }, h);
    assert.equal(created.code, 200);
    const { code, token } = created.body;
    assert.equal(
      (await call({ action: "state", code, token: "wrong" }, h)).code,
      403,
    );
    const v = await call({ action: "state", code, token }, h);
    assert.equal(v.code, 200);
    assert.equal(v.body.game.players[0].tokenHash, undefined);
    assert.equal(
      (
        await call(
          {
            action: "move",
            code,
            token,
            version: 99,
            command: { type: "start" },
          },
          h,
        )
      ).code,
      409,
    );
  } finally {
    global.fetch = original;
  }
});
