import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  deal,
  deck,
  apply,
  legal,
  view,
  canPair,
  canReveal,
  winner,
} from "../lib/engine.mjs";
function chosen(mode, ordered) {
  const g = fresh();
  g.players = ["A", "B", "C", "D"].map((name) => ({
    name,
    hand: [],
    tokenHash: "private",
  }));
  deal(g, ordered);
  apply(g, 0, { type: "bid", value: 28 });
  apply(g, 0, { type: "trump", suit: mode });
  return g;
}
test("Joker is a hidden no-trump indicator, not a 33rd dealt card", () => {
  const g = chosen("N");
  assert.equal(g.trumpMode, "joker");
  assert.equal(g.players.flatMap((p) => p.hand).length, 32);
  assert.equal(view(g, 1).trump, null);
  assert.equal(view(g, 1).trumpMode, "sealed");
  assert.equal(view(g, 1).trumpIndicator, undefined);
  assert.equal(view(g, 0).trump, "N");
  assert.equal(
    winner(
      [
        { seat: 0, card: "SJ" },
        { seat: 1, card: "S9" },
        { seat: 2, card: "H7" },
        { seat: 3, card: "SA" },
      ],
      "N",
    ),
    0,
  );
  Object.assign(g, { revealed: true, pairWindow: 0 });
  g.players[0].hand = ["HK", "HQ"];
  assert.equal(canPair(g, 0), false);
});
test("seventh patti is exact seventh dealt card and hidden from other seats", () => {
  const d = deck(),
    expected = d[18],
    g = chosen("7", d);
  assert.equal(g.seventhCard, expected);
  assert.equal(g.trump, expected[0]);
  assert.equal(g.players[0].hand.length, 7);
  assert.equal(g.players[0].hand.includes(expected), false);
  assert.equal(view(g, 0).seventhCard, expected);
  assert.equal(view(g, 0).players[0].count, 8);
  assert.equal(view(g, 1).players[0].count, 8);
  assert.equal(view(g, 1).seventhCard, undefined);
  assert.equal(view(g, 1).trumpIndicator, undefined);
  assert.equal(view(g, 1).trump, null);
  assert.equal(legal(g, 0).includes(expected), false);
  assert.throws(() => apply(g, 0, { type: "play", card: expected }));
  assert.throws(() => apply(g, 0, { type: "reveal" }));
});
test("seventh-patti bidder may discard while void without revealing", () => {
  const g = chosen("7");
  g.turn = 0;
  g.trick = [{ seat: 3, card: "S7" }];
  g.players[0].hand = ["H7", "C7"];
  g.seventhCard = "D9";
  g.trump = "D";
  g.trumpIndicator = "D9";
  assert.equal(canReveal(g, 0), true);
  apply(g, 0, { type: "play", card: "H7" });
  assert.equal(g.revealed, false);
  assert.equal(g.seventhCard, "D9");
});
test("opening seventh patti returns it to hand and enforces following its suit", () => {
  const g = chosen("7");
  Object.assign(g, {
    turn: 0,
    trick: [{ seat: 3, card: "D7" }],
    seventhCard: "D9",
    trump: "D",
    trumpIndicator: "D9",
  });
  g.players[0].hand = ["H7", "C7"];
  assert.deepEqual(legal(g, 0), ["H7", "C7", "D9"]);
  apply(g, 0, { type: "reveal" });
  assert.equal(g.revealed, true);
  assert.equal(g.seventhCard, null);
  assert.deepEqual(legal(g, 0), ["D9"]);
  assert.throws(() => apply(g, 0, { type: "play", card: "C7" }));
  apply(g, 0, { type: "play", card: "D9" });
});
test("a void opponent opens color and releases the bidder’s reserved card", () => {
  const g = chosen("7");
  Object.assign(g, {
    turn: 1,
    trick: [{ seat: 0, card: "S7" }],
    seventhCard: "D9",
    trump: "D",
    trumpIndicator: "D9",
  });
  g.players[1].hand = ["C7"];
  apply(g, 1, { type: "play", card: "C7" });
  assert.equal(g.revealed, true);
  assert.equal(g.seventhCard, null);
  assert.ok(g.players[0].hand.includes("D9"));
  assert.equal(view(g, 2).trumpIndicator, "D9");
});
test("reserved seventh patti can lead only when it is the final card", () => {
  const g = chosen("7");
  g.players[0].hand = [];
  assert.equal(canReveal(g, 0), true);
  const c = g.seventhCard;
  assert.deepEqual(legal(g, 0), [c]);
  apply(g, 0, { type: "play", card: c });
  assert.equal(g.revealed, true);
  assert.equal(g.players[0].hand.length, 0);
  assert.equal(g.trick[0].card, c);
});
test("visible led-suit cards prevent opening or playing the reserved patti", () => {
  const g = chosen("7");
  Object.assign(g, {
    turn: 0,
    trick: [{ seat: 3, card: "H7" }],
    seventhCard: "HJ",
    trump: "H",
  });
  g.players[0].hand = ["H9", "C7"];
  assert.equal(canReveal(g, 0), false);
  assert.deepEqual(legal(g, 0), ["H9"]);
  assert.throws(() => apply(g, 0, { type: "reveal" }));
  assert.throws(() => apply(g, 0, { type: "play", card: "HJ" }));
});
test("400 variant hands finish with all 32 cards and exactly 28 points accounted for", () => {
  for (const mode of ["N", "7"])
    for (let k = 0; k < 200; k++) {
      const g = chosen(mode);
      let n = 0;
      while (g.phase === "playing" && n++ < 40) {
        const seat = g.turn;
        apply(g, seat, { type: "play", card: legal(g, seat)[0] });
      }
      assert.equal(g.phase, "result");
      assert.equal(g.tricks, 8);
      assert.equal(g.taken[0] + g.taken[1], 28);
      assert.equal(g.players.flatMap((p) => p.hand).length, 0);
      assert.equal(g.seventhCard, null);
    }
});
