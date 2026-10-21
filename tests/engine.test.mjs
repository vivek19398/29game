import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deck,
  fresh,
  deal,
  apply,
  view,
  legal,
  winner,
  points,
  canPair,
  shuffled,
} from "../lib/engine.mjs";
const game = () => {
  const g = fresh();
  g.players = ["A", "B", "C", "D"].map((name) => ({
    name,
    tokenHash: "secret-" + name,
    hand: [],
  }));
  return g;
};
function playGame(g) {
  let n = 0;
  while (g.phase === "playing" && n++ < 100) {
    const s = g.turn;
    if (canPair(g, s)) apply(g, s, { type: "pair" });
    apply(g, s, { type: "play", card: legal(g, s)[0] });
  }
  return g;
}
test("32 unique cards and 28 points", () => {
  assert.equal(new Set(deck()).size, 32);
  assert.equal(
    deck().reduce((n, c) => n + points(c), 0),
    28,
  );
  assert.equal(new Set(shuffled()).size, 32);
});
test("forced dealer bid after three opening drops", () => {
  const g = game();
  deal(g, deck());
  for (let i = 0; i < 3; i++) apply(g, g.turn, { type: "drop" });
  assert.equal(g.bid, 17);
  assert.equal(g.bidder, g.dealer);
  assert.equal(g.phase, "trump");
});
test("two bidders alternate until a drop, then the next waiting player enters", () => {
  const g = game();
  deal(g);
  assert.deepEqual(g.auctionPair, [0, 1]);
  assert.deepEqual(g.auctionWaiting, [2, 3]);
  apply(g, 0, { type: "bid", value: 17 });
  apply(g, 1, { type: "bid", value: 18 });
  assert.equal(g.turn, 0);
  assert.throws(() => apply(g, 2, { type: "bid", value: 21 }));
  apply(g, 0, { type: "stay" });
  assert.equal(g.bidder, 0);
  assert.equal(g.turn, 1);
  assert.throws(() => apply(g, 1, { type: "stay" }));
  apply(g, 1, { type: "bid", value: 19 });
  assert.equal(g.turn, 0);
  apply(g, 0, { type: "drop" });
  assert.equal(g.turn, 2);
  assert.deepEqual(g.auctionPair, [2, 1]);
  assert.throws(() => apply(g, 0, { type: "bid", value: 21 }));
  assert.throws(() => apply(g, 3, { type: "bid", value: 21 }));
  apply(g, 2, { type: "bid", value: 21 });
  assert.equal(g.turn, 1);
  apply(g, 1, { type: "stay" });
  assert.equal(g.turn, 2);
  apply(g, 2, { type: "drop" });
  assert.equal(g.turn, 3);
  assert.equal(g.bidder, 1);
  apply(g, 3, { type: "drop" });
  assert.equal(g.phase, "trump");
  assert.equal(g.bidder, 1);
  assert.equal(g.target, 21);
});
test("drop advances to the next challenger without interrupting the surviving bidder", () => {
  const g = game();
  deal(g);
  apply(g, 0, { type: "bid", value: 17 });
  apply(g, 1, { type: "drop" });
  assert.equal(g.turn, 2);
  apply(g, 2, { type: "bid", value: 18 });
  assert.equal(g.turn, 0);
  apply(g, 0, { type: "bid", value: 19 });
  assert.equal(g.turn, 2);
  apply(g, 2, { type: "drop" });
  assert.equal(g.turn, 3);
  apply(g, 3, { type: "drop" });
  assert.equal(g.bidder, 0);
  assert.equal(g.phase, "trump");
});
test("head-to-head pairs and waiting order rotate with the dealer", () => {
  const g = game();
  g.dealer = 0;
  deal(g);
  assert.deepEqual(g.auctionPair, [1, 2]);
  assert.deepEqual(g.auctionWaiting, [3, 0]);
  apply(g, 1, { type: "drop" });
  assert.equal(g.turn, 2);
  apply(g, 2, { type: "bid", value: 17 });
  assert.equal(g.turn, 3);
  apply(g, 3, { type: "drop" });
  assert.equal(g.turn, 0);
  apply(g, 0, { type: "drop" });
  assert.equal(g.bidder, 2);
});
test("all opening bids below 17 are rejected", () => {
  const g = game();
  deal(g);
  for (const value of [14, 15, 16, 17.5, 29])
    assert.throws(() => apply(g, 0, { type: "bid", value }));
});
test("rejects wrong turn, invalid bid, and trump suit", () => {
  const g = game();
  deal(g);
  assert.throws(() => apply(g, 1, { type: "bid", value: 16 }));
  assert.throws(() => apply(g, 0, { type: "bid", value: 14 }));
  assert.throws(() => apply(g, 0, { type: "bid", value: 15.5 }));
  apply(g, 0, { type: "bid", value: 28 });
  assert.equal(g.phase, "trump");
  assert.throws(() => apply(g, 0, { type: "trump", suit: "x" }));
});
test("views remove other hands, tokens, undealt cards and hidden trump", () => {
  const g = game();
  deal(g);
  const v = view(g, 1);
  assert.equal(v.players[0].hand, undefined);
  assert.equal(v.players[1].hand.length, 4);
  assert.equal(v.players[0].tokenHash, undefined);
  assert.equal(v.remaining, undefined);
  apply(g, 0, { type: "bid", value: 28 });
  apply(g, 0, { type: "trump", suit: "H" });
  assert.equal(view(g, 1).trump, null);
  assert.equal(view(g, 0).trump, "H");
  assert.equal(view(g, 0).players[0].hand.length, 8);
});
test("follow suit is compulsory; failure to follow reveals trump without forced trumping", () => {
  const g = game();
  deal(g);
  g.phase = "playing";
  g.trump = "H";
  g.turn = 0;
  g.trick = [{ seat: 3, card: "SJ" }];
  g.players[0].hand = ["S7", "HJ", "C7"];
  assert.deepEqual(legal(g, 0), ["S7"]);
  assert.throws(() => apply(g, 0, { type: "play", card: "HJ" }));
  g.players[0].hand = ["HJ", "C7"];
  apply(g, 0, { type: "play", card: "C7" });
  assert.equal(g.revealed, true);
  assert.equal(g.trick[1].card, "C7");
});
test("trump overrides led suit only when revealed; J outranks nine and ace", () => {
  const t = [
    { seat: 0, card: "SA" },
    { seat: 1, card: "S9" },
    { seat: 2, card: "SJ" },
    { seat: 3, card: "H7" },
  ];
  assert.equal(winner(t, null), 2);
  assert.equal(winner(t, "H"), 3);
});
test("Royals requires winning side window, held pair, and applies target caps", () => {
  const g = game();
  deal(g);
  Object.assign(g, {
    phase: "playing",
    trump: "H",
    revealed: true,
    bidder: 0,
    bid: 17,
    target: 17,
    pairWindow: 0,
  });
  g.players[0].hand = ["HK", "HQ"];
  assert.equal(canPair(g, 0), true);
  apply(g, 0, { type: "pair" });
  assert.equal(g.target, 17);
  assert.equal(canPair(g, 0), false);
  g.pair = null;
  g.pairWindow = 1;
  g.bid = 27;
  g.players[1].hand = ["HK", "HQ"];
  apply(g, 1, { type: "pair" });
  assert.equal(g.target, 28);
});
test("next played card closes Royals window", () => {
  const g = game();
  deal(g);
  Object.assign(g, {
    phase: "playing",
    turn: 0,
    trump: "H",
    revealed: true,
    bidder: 0,
    bid: 20,
    target: 20,
    pairWindow: 0,
  });
  g.players[0].hand = ["HK", "HQ", "S7"];
  apply(g, 0, { type: "play", card: "S7" });
  assert.equal(canPair(g, 0), false);
});
test("200 hands preserve cards, award all points and alter only bidders score", () => {
  for (let k = 0; k < 200; k++) {
    const g = game();
    deal(g);
    apply(g, 0, { type: "bid", value: 28 });
    apply(g, 0, { type: "trump", suit: "H" });
    playGame(g);
    assert.ok(["result", "finished"].includes(g.phase));
    assert.equal(g.tricks, 8);
    assert.equal(g.taken[0] + g.taken[1], 28);
    assert.equal(
      g.players.reduce((n, p) => n + p.hand.length, 0),
      0,
    );
    assert.equal(g.scores[1], 0);
    assert.equal(Math.abs(g.scores[0]), 1);
  }
});
test("match ends at minus six and next dealer rotates", () => {
  const g = game();
  deal(g);
  g.scores = [-5, 0];
  apply(g, 0, { type: "bid", value: 28 });
  apply(g, 0, { type: "trump", suit: "H" });
  g.target = 29;
  playGame(g);
  assert.equal(g.phase, "finished");
  assert.equal(g.matchWinner, 1);
  apply(g, 0, { type: "rematch" });
  assert.deepEqual(g.scores, [0, 0]);
  assert.equal(g.round, 1);
  g.phase = "result";
  apply(g, 0, { type: "next" });
  assert.equal(g.dealer, 0);
  assert.equal(g.turn, 1);
});
