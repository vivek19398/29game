import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/game.mjs";
import { createLocalDatabase } from "../lib/local-test.mjs";
test("API enforces two-player bidding and blocks waiting and dropped players", async () => {
  const handler = createHandler({
    getConfig: () => ({
      password: "1234",
      secret: "a-test-session-secret-longer-than-32-characters",
    }),
    database: createLocalDatabase(),
  });
  let cookie = "";
  async function call(body) {
    let status, data;
    await handler(
      {
        method: "POST",
        body,
        headers: { host: "localhost", cookie },
        socket: { remoteAddress: "127.0.0.1" },
      },
      {
        setHeader: (k, v) => {
          if (k === "Set-Cookie") cookie = v.split(";")[0];
        },
        set statusCode(s) {
          status = s;
        },
        end: (s) => (data = JSON.parse(s)),
      },
    );
    return { status, ...data };
  }
  assert.equal(
    (await call({ action: "unlock", password: "1234" })).status,
    200,
  );
  const created = await call({ action: "create", name: "A" }),
    code = created.code,
    tokens = [created.token];
  for (const name of ["B", "C", "D"])
    tokens.push((await call({ action: "join", code, name })).token);
  let g = (await call({ action: "state", code, token: tokens[0] })).game;
  async function move(seat, command, status = 200) {
    const r = await call({
      action: "move",
      code,
      token: tokens[seat],
      version: g.version,
      command,
    });
    assert.equal(r.status, status, r.error);
    if (r.game) g = r.game;
    return r;
  }
  await move(0, { type: "start" });
  await move(0, { type: "bid", value: 17 });
  await move(1, { type: "bid", value: 18 });
  assert.equal(g.turn, 0);
  await move(2, { type: "bid", value: 21 }, 400);
  await move(0, { type: "stay" });
  assert.equal(g.bidder, 0);
  await move(1, { type: "stay" }, 400);
  await move(1, { type: "bid", value: 19 });
  await move(0, { type: "drop" });
  assert.equal(g.turn, 2);
  await move(0, { type: "bid", value: 21 }, 400);
  await move(3, { type: "bid", value: 21 }, 400);
  await move(2, { type: "bid", value: 21 });
  assert.equal(g.turn, 1);
  await move(1, { type: "drop" });
  assert.equal(g.turn, 3);
  await move(3, { type: "drop" });
  assert.equal(g.phase, "trump");
  assert.equal(g.bidder, 2);
});
