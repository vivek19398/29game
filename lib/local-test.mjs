import { apply, legal, canPair, points, suits } from "./engine.mjs";

// Used only by dev.mjs. Production always uses Supabase.
export function createLocalDatabase({
  paced = false,
  delayMs = 2500,
  schedule = (callback, delay) => {
    const timer = setTimeout(callback, delay);
    timer.unref?.();
    return () => clearTimeout(timer);
  },
} = {}) {
  const rooms = new Map(),
    limits = new Map();
  const pending = new Map();
  function queue(code) {
    pending.get(code)?.();
    pending.delete(code);
    const row = rooms.get(code),
      g = row?.state;
    if (
      !paced ||
      !g ||
      !["bidding", "trump", "playing"].includes(g.phase) ||
      g.turn === 0
    )
      return;
    const delay =
      g.phase === "playing" && g.trick.length === 0 && g.tricks > 0
        ? delayMs + 2000
        : delayMs;
    const cancel = schedule(() => {
      pending.delete(code);
      const current = rooms.get(code);
      if (!current) return;
      advanceComputers(current.state, { maxActions: 1 });
      current.version++;
      current.state.version = current.version;
      queue(code);
    }, delay);
    pending.set(code, cancel);
  }
  return async function database(_config, path, method = "GET", body) {
    if (path === "rpc/twenty_nine_rate_limit") {
      let entry = limits.get(body.p_key);
      if (!entry || Date.now() - entry.start >= body.p_seconds * 1000)
        entry = { start: Date.now(), count: 0 };
      entry.count++;
      limits.set(body.p_key, entry);
      return entry.count <= body.p_max;
    }
    const url = new URL(path, "http://local.test/");
    if (url.pathname !== "/twenty_nine_rooms")
      throw Error("Unknown local table");
    if (method === "POST") {
      if (rooms.has(body.code)) throw Error("Room already exists");
      const row = { ...structuredClone(body), version: 0 };
      rooms.set(body.code, row);
      queue(body.code);
      return [structuredClone(row)];
    }
    const code = url.searchParams.get("code")?.slice(3),
      row = rooms.get(code);
    if (!row) return [];
    if (method === "PATCH") {
      if (row.version !== Number(url.searchParams.get("version")?.slice(3)))
        return [];
      Object.assign(row, structuredClone(body));
      queue(code);
    }
    return [structuredClone(row)];
  };
}
export function advanceComputers(g, { maxActions = 100 } = {}) {
  let guard = 0;
  while (
    ["bidding", "trump", "playing"].includes(g.phase) &&
    g.turn !== 0 &&
    guard++ < maxActions
  ) {
    const seat = g.turn;
    if (g.phase === "bidding") {
      apply(
        g,
        seat,
        seat === 1 && g.bid < 20
          ? { type: "bid", value: Math.max(17, g.bid + 1) }
          : { type: "drop" },
      );
    } else if (g.phase === "trump") {
      const suit = suits
        .slice()
        .sort((a, b) => suitStrength(g, seat, b) - suitStrength(g, seat, a))[0];
      apply(g, seat, { type: "trump", suit });
    } else {
      if (canPair(g, seat)) apply(g, seat, { type: "pair" });
      const cards = legal(g, seat);
      apply(g, seat, { type: "play", card: cards[0] });
    }
  }
}
function suitStrength(g, seat, suit) {
  return g.players[seat].hand
    .filter((c) => c[0] === suit)
    .reduce((n, c) => n + 2 + points(c), 0);
}
