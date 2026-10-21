import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../api/game.mjs";
import { createLocalDatabase, advanceComputers } from "../lib/local-test.mjs";
test("local test mode signs in with 1234 and completes a hand with three computer players", async () => {
  const handler = createHandler({
    getConfig: () => ({
      password: "1234",
      secret: "test-secret-that-is-at-least-32-characters",
    }),
    database: createLocalDatabase(),
    localTest: true,
    advanceComputers,
  });
  let cookie = "";
  async function call(body) {
    let status, result;
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
        end: (s) => (result = JSON.parse(s)),
      },
    );
    assert.equal(status, 200, result.error);
    return result;
  }
  await call({ action: "unlock", password: "1234" });
  assert.equal((await call({ action: "session" })).localTest, true);
  const room = await call({ action: "create", name: "Test player" });
  let g = room.game;
  const session = { code: room.code, token: room.token };
  assert.equal(g.players.length, 4);
  assert.equal(g.localTest, true);
  async function move(command) {
    g = (
      await call({ action: "move", ...session, version: g.version, command })
    ).game;
  }
  await move({ type: "start" });
  await move({ type: "bid", value: 17 });
  assert.equal(g.bid, 18);
  assert.equal(g.turn, 0);
  await move({ type: "stay" });
  assert.equal(g.bid, 19);
  await move({ type: "bid", value: 21 });
  assert.equal(g.phase, "trump");
  await move({ type: "trump", suit: "H" });
  let n = 0;
  while (g.phase === "playing" && n++ < 40) {
    assert.equal(g.turn, 0);
    await move({ type: "play", card: g.legal[0] });
  }
  assert.equal(g.phase, "result");
  assert.equal(g.taken[0] + g.taken[1], 28);
});

test("paced computer turns run one at a time and retain a completed trick before the next lead", async () => {
  const scheduled = [];
  const database = createLocalDatabase({
    paced: true,
    schedule: (callback, delay) => {
      const task = { callback, delay, cancelled: false };
      scheduled.push(task);
      return () => (task.cancelled = true);
    },
  });
  const { fresh, deal, apply } = await import("../lib/engine.mjs");
  const g = fresh();
  g.players = ["You", "B", "C", "D"].map((name) => ({ name, hand: [] }));
  deal(g);
  apply(g, 0, { type: "bid", value: 17 });
  await database({}, "twenty_nine_rooms", "POST", { code: "TEST", state: g });
  let row = (await database({}, "twenty_nine_rooms?code=eq.TEST"))[0];
  assert.equal(row.state.turn, 1);
  assert.equal(scheduled[0].delay, 2500);
  scheduled[0].callback();
  row = (await database({}, "twenty_nine_rooms?code=eq.TEST"))[0];
  assert.equal(row.state.turn, 0);
  assert.equal(row.version, 1);
  assert.equal(row.state.bid, 18);
  apply(row.state, 0, { type: "bid", value: 19 });
  await database({}, "twenty_nine_rooms?code=eq.TEST&version=eq.1", "PATCH", {
    state: row.state,
    version: 2,
  });
  const next = scheduled.at(-1);
  assert.equal(next.delay, 2500);
  next.callback();
  row = (await database({}, "twenty_nine_rooms?code=eq.TEST"))[0];
  assert.equal(row.state.turn, 0);
  assert.equal(row.version, 3);
  row.state.phase = "playing";
  row.state.trick = [];
  row.state.tricks = 1;
  row.state.turn = 1;
  await database({}, "twenty_nine_rooms?code=eq.TEST&version=eq.3", "PATCH", {
    state: row.state,
    version: 3,
  });
  assert.equal(scheduled.at(-1).delay, 4500);
});
