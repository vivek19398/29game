import { randomInt } from "node:crypto";
export const suits = ["S", "H", "C", "D"],
  ranks = ["J", "9", "A", "10", "K", "Q", "8", "7"];
export const points = (c) => ({ J: 3, 9: 2, A: 1, 10: 1 })[c.slice(1)] || 0;
export const deck = () => suits.flatMap((s) => ranks.map((r) => s + r));
export function shuffled() {
  const d = deck();
  for (let i = d.length - 1; i > 0; i--) {
    let j = randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
const fail = (m) => {
  throw new Error(m);
};
export function fresh() {
  return {
    version: 0,
    phase: "lobby",
    players: [],
    scores: [0, 0],
    dealer: 3,
    round: 0,
    log: [],
  };
}
function log(g, m) {
  g.log = [...g.log, m].slice(-36);
}
export function deal(g, d = shuffled()) {
  g.round++;
  g.phase = "bidding";
  g.turn = (g.dealer + 1) % 4;
  g.bid = 16;
  g.bidder = null;
  g.passes = 0;
  g.dropped = [];
  g.auctionPair = [g.turn, (g.turn + 1) % 4];
  g.auctionWaiting = [(g.turn + 2) % 4, (g.turn + 3) % 4];
  g.lastBidAction = null;
  g.trump = null;
  g.trumpMode = null;
  g.seventhCard = null;
  g.trumpIndicator = null;
  g.revealed = false;
  g.trick = [];
  g.lastTrick = null;
  g.tricks = 0;
  g.taken = [0, 0];
  g.pair = null;
  g.pairWindow = null;
  g.result = null;
  g.players.forEach((p, i) => {
    p.hand = d.slice(i * 4, i * 4 + 4);
  });
  g.remaining = d.slice(16);
  log(g, `Hand ${g.round}: ${g.players[g.turn].name} opens the bidding.`);
}
export function winner(trick, trump) {
  let best = trick[0];
  for (const p of trick.slice(1)) {
    const a = p.card[0],
      b = best.card[0];
    if (
      (a === b &&
        ranks.indexOf(p.card.slice(1)) < ranks.indexOf(best.card.slice(1))) ||
      (a === trump && b !== trump)
    )
      best = p;
  }
  return best.seat;
}
export function canReveal(g, seat) {
  if (
    g.phase !== "playing" ||
    g.turn !== seat ||
    g.revealed ||
    g.trumpMode !== "seventh" ||
    seat !== g.bidder
  )
    return false;
  const lead = g.trick[0]?.card[0],
    h = g.players[seat].hand;
  return lead ? !h.some((c) => c[0] === lead) : h.length === 0;
}
function reveal(g) {
  g.revealed = true;
  if (g.seventhCard) {
    g.players[g.bidder].hand.push(g.seventhCard);
    g.seventhCard = null;
  }
  log(
    g,
    g.trump === "N"
      ? "Joker opened: no trump. Led suit wins in normal rank order."
      : "Trump is revealed.",
  );
}
export function legal(g, seat) {
  if (g.phase !== "playing" || g.turn !== seat) return [];
  const h = g.players[seat].hand,
    lead = g.trick[0]?.card[0];
  if (lead && h.some((c) => c[0] === lead))
    return h.filter((c) => c[0] === lead);
  if (
    g.seventhCard &&
    seat === g.bidder &&
    !g.revealed &&
    (lead || h.length === 0)
  )
    return [...h, g.seventhCard];
  return h;
}
export function canPair(g, seat) {
  const h = g.players[seat]?.hand || [];
  return (
    g.phase === "playing" &&
    g.revealed &&
    suits.includes(g.trump) &&
    !g.pair &&
    g.pairWindow === seat % 2 &&
    h.includes(g.trump + "K") &&
    h.includes(g.trump + "Q")
  );
}
export function apply(g, seat, cmd) {
  if (!g.players[seat]) fail("Join the table first.");
  if (cmd.type === "start") {
    if (seat !== 0) fail("Only the host can deal.");
    if (g.phase !== "lobby" || g.players.length !== 4)
      fail("Four players must be seated.");
    deal(g);
    return;
  }
  if (cmd.type === "next") {
    if (seat !== 0 || g.phase !== "result") fail("Wait for the host to deal.");
    g.dealer = (g.dealer + 1) % 4;
    deal(g);
    return;
  }
  if (cmd.type === "rematch") {
    if (seat !== 0 || g.phase !== "finished")
      fail("Only the host can start a rematch.");
    g.scores = [0, 0];
    g.round = 0;
    g.dealer = 3;
    deal(g);
    return;
  }
  if (cmd.type === "pair") {
    if (!canPair(g, seat))
      fail(
        "Royals requires both trump K and Q, after your team wins a revealed-trump trick.",
      );
    g.pair = { seat };
    const own = seat % 2 === g.bidder % 2;
    g.target = Math.min(28, Math.max(17, g.bid + (own ? -4 : 4)));
    log(g, `${g.players[seat].name} declares Royals. Target is ${g.target}.`);
    return;
  }
  if (seat !== g.turn) fail("It is another player’s turn.");
  if (g.phase === "bidding") {
    // A dropped player is out for this auction; equal calls cannot follow one another.
    g.dropped ??= [];
    if (!g.auctionPair) {
      const available = Array.from(
        { length: 4 },
        (_, i) => (g.dealer + 1 + i) % 4,
      ).filter((i) => !g.dropped.includes(i));
      g.auctionPair = available.slice(0, 2);
      g.auctionWaiting = available.slice(2);
    }
    if (!g.auctionPair.includes(seat))
      fail("Wait until one of the two active bidders drops.");
    if (g.dropped.includes(seat)) fail("You have dropped out of this auction.");
    if (cmd.type === "bid") {
      if (
        !Number.isInteger(cmd.value) ||
        cmd.value < 17 ||
        cmd.value <= g.bid ||
        cmd.value > 28
      )
        fail("Increase the bid to a whole number between 17 and 28.");
      g.bid = cmd.value;
      g.bidder = seat;
      g.lastBidAction = "bid";
      log(g, `${g.players[seat].name} bids ${cmd.value}.`);
    } else if (cmd.type === "stay") {
      if (g.bidder === null || g.bidder === seat || g.lastBidAction === "stay")
        fail("Stay can match a raised bid. After Stay, increase or drop.");
      g.bidder = seat;
      g.lastBidAction = "stay";
      log(g, `${g.players[seat].name} stays at ${g.bid}.`);
    } else if (cmd.type === "drop" || cmd.type === "pass") {
      g.dropped.push(seat);
      const slot = g.auctionPair.indexOf(seat);
      if (g.auctionWaiting.length)
        g.auctionPair[slot] = g.auctionWaiting.shift();
      else g.auctionPair.splice(slot, 1);
      log(g, `${g.players[seat].name} drops out.`);
    } else fail("Increase, stay, or drop.");
    g.passes = g.dropped.length;
    if (g.dropped.length === 3 || g.bid === 28) {
      if (g.bidder === null) {
        g.bidder = g.players.findIndex((_, i) => !g.dropped.includes(i));
        g.bid = 17;
        log(g, `${g.players[g.bidder].name} must bid 17.`);
      }
      g.phase = "trump";
      g.turn = g.bidder;
      g.target = g.bid;
    } else {
      if (cmd.type === "drop" || cmd.type === "pass") {
        // A newcomer challenges the surviving bidder; before an opening bid, the survivor speaks first.
        if (g.bidder !== null)
          g.turn = g.auctionPair.find((i) => i !== g.bidder);
        if (g.bidder === null) {
          const start = (seat + 1) % 4;
          g.turn = Array.from({ length: 4 }, (_, i) => (start + i) % 4).find(
            (i) => g.auctionPair.includes(i),
          );
        }
      } else g.turn = g.auctionPair.find((i) => i !== seat);
    }
    return;
  }
  if (g.phase === "trump") {
    if (cmd.type !== "trump" || ![...suits, "N", "7"].includes(cmd.suit))
      fail("Choose a suit, Joker, or seventh patti.");
    // The seventh dealt card is the third of the bidder's second batch, never a chosen hand card.
    g.trumpMode =
      cmd.suit === "7" ? "seventh" : cmd.suit === "N" ? "joker" : "suit";
    g.trump = cmd.suit === "7" ? g.remaining[g.bidder * 4 + 2][0] : cmd.suit;
    g.trumpIndicator =
      cmd.suit === "7" ? g.remaining[g.bidder * 4 + 2] : cmd.suit;
    g.players.forEach((p, i) =>
      p.hand.push(...g.remaining.slice(i * 4, i * 4 + 4)),
    );
    if (cmd.suit === "7") {
      g.seventhCard = g.players[g.bidder].hand.splice(6, 1)[0];
      log(g, `${g.players[g.bidder].name} places the seventh patti face down.`);
    }
    delete g.remaining;
    g.phase = "playing";
    g.turn = (g.dealer + 1) % 4;
    log(g, "Trump is sealed. Eight cards each; play begins.");
    return;
  }
  if (cmd.type === "reveal") {
    if (!canReveal(g, seat))
      fail(
        "You can open seventh patti only when you cannot follow suit, or it is your last card.",
      );
    reveal(g);
    return;
  }
  if (g.phase !== "playing" || cmd.type !== "play")
    fail("That action is unavailable.");
  if (!legal(g, seat).includes(cmd.card))
    fail(
      "Follow the led suit when you can; the seventh patti stays sealed until it can be opened.",
    );
  const lead = g.trick[0]?.card[0];
  if (cmd.card === g.seventhCard && seat === g.bidder && !g.revealed) reveal(g);
  else if (lead && cmd.card[0] !== lead && !g.revealed) {
    // Seventh-patti bidder may discard without opening; other void players still reveal automatically.
    if (!(g.trumpMode === "seventh" && seat === g.bidder)) reveal(g);
  }
  g.pairWindow = null;
  g.players[seat].hand.splice(g.players[seat].hand.indexOf(cmd.card), 1);
  g.trick.push({ seat, card: cmd.card });
  if (g.trick.length < 4) {
    g.turn = (seat + 1) % 4;
    return;
  }
  const win = winner(g.trick, g.revealed ? g.trump : null),
    value = g.trick.reduce((n, p) => n + points(p.card), 0);
  g.taken[win % 2] += value;
  g.tricks++;
  g.lastTrick = {
    cards: g.trick,
    winner: win,
    points: value,
    number: g.tricks,
    completedAt: Date.now(),
  };
  g.trick = [];
  g.turn = win;
  if (g.revealed) g.pairWindow = win % 2;
  log(g, `${g.players[win].name} wins trick ${g.tricks} · ${value} points.`);
  if (g.tricks === 8) {
    const team = g.bidder % 2,
      success = g.taken[team] >= g.target;
    g.scores[team] += success ? 1 : -1;
    g.result = { team, success, target: g.target, points: g.taken[team] };
    g.phase = g.scores.some((s) => Math.abs(s) >= 6) ? "finished" : "result";
    if (g.phase === "finished")
      g.matchWinner = g.scores[team] >= 6 ? team : 1 - team;
    log(
      g,
      `${success ? "Contract made" : "Contract missed"}: ${g.taken[team]} / ${g.target}.`,
    );
  }
}
export function view(g, seat) {
  const v = structuredClone(g);
  delete v.remaining;
  v.players = v.players.map((p, i) => ({
    name: p.name,
    count: (p.hand?.length || 0) + (i === g.bidder && g.seventhCard ? 1 : 0),
    hand: i === seat ? p.hand : undefined,
  }));
  if (!v.revealed && seat !== g.bidder) {
    v.trump = null;
    delete v.seventhCard;
    delete v.trumpIndicator;
    if (v.trumpMode !== "seventh") v.trumpMode = "sealed";
  }
  v.seat = seat;
  v.legal = legal(g, seat);
  v.canPair = canPair(g, seat);
  v.canReveal = canReveal(g, seat);
  return v;
}
