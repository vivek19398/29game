import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/game.mjs";
process.env.SUPABASE_URL = "https://fixture.supabase.co";
process.env.SUPABASE_SECRET_KEY = "sb_secret_fixture";
process.env.FAMILY_PASSWORD = "fixture-password-only";
process.env.SESSION_SECRET = "fixture-secret-0000000000000000000000000";
async function call(body, cookie = "") {
  let status,
    reply,
    headers = {};
  await handler(
    {
      method: "POST",
      body,
      headers: { host: "localhost", cookie },
      socket: { remoteAddress: "127.0.0.1" },
    },
    {
      setHeader: (k, v) => (headers[k] = v),
      set statusCode(s) {
        status = s;
      },
      end: (s) => (reply = JSON.parse(s)),
    },
  );
  return { status, ...reply, headers };
}
test("four authenticated seats complete a hand through the API, survive reconnect and reject duplicate moves", async () => {
  let rooms = new Map(),
    original = global.fetch;
  global.fetch = async (url, opts) => {
    assert.equal(
      opts.headers.Authorization,
      undefined,
      "new secret key must not be a JWT bearer",
    );
    const u = new URL(url),
      path = u.pathname;
    let data;
    if (path.includes("/rpc/")) data = true;
    else if (opts.method === "POST") {
      const b = JSON.parse(opts.body);
      b.version ??= 0;
      rooms.set(b.code, structuredClone(b));
      data = [b];
    } else {
      const code = u.searchParams.get("code")?.slice(3),
        r = rooms.get(code);
      if (opts.method === "PATCH") {
        const v = Number(u.searchParams.get("version")?.slice(3));
        if (!r || r.version !== v) data = [];
        else {
          Object.assign(r, JSON.parse(opts.body));
          data = [r];
        }
      } else data = r ? [r] : [];
    }
    return { ok: true, status: 200, json: async () => structuredClone(data) };
  };
  try {
    const u = await call({
        action: "unlock",
        password: "fixture-password-only",
      }),
      cookie = u.headers["Set-Cookie"].split(";")[0];
    let a = await call({ action: "create", name: "A" }, cookie);
    assert.equal(a.status, 200);
    const code = a.code,
      sessions = [{ code, token: a.token }];
    for (const name of ["B", "C", "D"]) {
      const p = await call({ action: "join", code, name }, cookie);
      assert.equal(p.status, 200);
      sessions.push({ code, token: p.token });
    }
    assert.equal(
      (await call({ action: "join", code, name: "Fifth" }, cookie)).status,
      409,
    );
    let g = (await call({ action: "state", ...sessions[0] }, cookie)).game;
    async function move(seat, command) {
      const payload = {
        action: "move",
        ...sessions[seat],
        version: g.version,
        command,
      };
      const r = await call(payload, cookie);
      assert.equal(r.status, 200, r.error);
      g = r.game;
      const duplicate = await call(payload, cookie);
      assert.equal(duplicate.status, 409);
      return g;
    }
    await move(0, { type: "start" });
    await move(0, { type: "bid", value: 28 });
    await move(0, { type: "trump", suit: "S" });
    let n = 0;
    while (g.phase === "playing" && n++ < 40) {
      const seat = g.turn;
      const r = await call({ action: "state", ...sessions[seat] }, cookie);
      g = r.game;
      for (let i = 0; i < 4; i++)
        assert.equal(g.players[i].hand === undefined, i !== seat);
      await move(seat, { type: "play", card: g.legal[0] });
    }
    assert.equal(g.phase, "result");
    assert.equal(
      g.taken.reduce((a, b) => a + b),
      28,
    );
    const restored = await call(
      { action: "join", ...sessions[0], name: "A" },
      cookie,
    );
    assert.equal(restored.game.seat, 0);
    await move(0, { type: "next" });
    assert.equal(g.round, 2);
    assert.equal(g.turn, 1);
  } finally {
    global.fetch = original;
  }
});
