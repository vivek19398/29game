const $ = (s) => document.querySelector(s),
  app = $("#app");
const symbols = { S: "♠", H: "♥", C: "♣", D: "♦" },
  suitNames = { S: "Spades", H: "Hearts", C: "Clubs", D: "Diamonds" };
let reviewTrick = null,
  reviewUntil = 0,
  reviewTimer = null,
  animatedCard = null;
let localTest = false;
let deckOpen = false,
  deckExpanded = false,
  deckColor = "emerald";
const deckColors = {
  emerald: { name: "Emerald", value: "#184e40" },
  royal: { name: "Royal blue", value: "#263d73" },
  ruby: { name: "Ruby", value: "#862e40" },
  midnight: { name: "Midnight", value: "#252b39" },
};
try {
  const saved = localStorage.getItem("family29-deck-color");
  if (deckColors[saved]) deckColor = saved;
} catch {}
let session;
try {
  session = JSON.parse(localStorage.getItem("family29-seat") || "null");
} catch {}
let game = null,
  unlocked = false,
  tab = "create",
  help = false,
  busy = false,
  online = true;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function notify(s) {
  $("#notice").textContent = s;
  $("#notice").style.display = "block";
  clearTimeout(window.toast);
  window.toast = setTimeout(() => ($("#notice").style.display = "none"), 6000);
}
async function api(body) {
  const r = await fetch("/api/game", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let d;
  try {
    d = await r.json();
  } catch {
    throw Error("Could not reach the game server.");
  }
  if (!r.ok) {
    if (d.locked) {
      unlocked = false;
      render();
    }
    throw Error(d.error || "Please try again.");
  }
  online = true;
  if (d.localTest !== undefined) localTest = d.localTest;
  return d;
}
const pipLayouts = {
  7: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
    [0, 4],
    [2, 4],
  ],
  8: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
    [1, 3],
    [0, 4],
    [2, 4],
  ],
  9: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [1, 2],
    [0, 3],
    [2, 3],
    [0, 4],
    [2, 4],
  ],
  10: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 1.4],
    [2, 1.4],
    [0, 2.6],
    [2, 2.6],
    [1, 3],
    [0, 4],
    [2, 4],
  ],
};
function card(c, attrs = "") {
  const rank = c.slice(1),
    suit = c[0],
    tag = attrs ? "button" : "div";
  const court = ["J", "Q", "K"].includes(rank);
  const face = court
    ? `<span class="court-art" style="background-position:${(["S", "H", "C", "D"].indexOf(suit) * 100) / 3}% ${["J", "Q", "K"].indexOf(rank) * 50}%" aria-hidden="true"></span>`
    : rank === "A"
      ? `<span class="ace-emblem" aria-hidden="true">${symbols[suit]}</span>`
      : `<span class="pip-field" aria-hidden="true">${pipLayouts[rank].map(([x, y]) => `<i style="left:${x * 37 + 13}%;top:${y * 21 + 8}%;${y > 2 ? "transform:translate(-50%,-50%) rotate(180deg)" : ""}">${symbols[suit]}</i>`).join("")}</span>`;
  const index = `<b>${rank}</b><i>${symbols[suit]}</i>`;
  const faceRank = ["K", "Q", "A", "J"].includes(rank)
    ? `<span class="face-rank" aria-hidden="true">${rank}</span>`
    : "";
  return `<${tag} class="card ${"HD".includes(suit) ? "red" : ""} ${court ? "court" : ""}" ${attrs}><span class="card-index top-index" aria-hidden="true">${index}</span>${faceRank}${face}<span class="card-index bottom-index" aria-hidden="true">${index}</span><small class="card-points">${{ J: 3, 9: 2, A: 1, 10: 1 }[rank] || 0} pts</small></${tag}>`;
}
function header() {
  return `<header><div class="brand"><span class="mark">29</span><strong>THE FAMILY TABLE</strong></div><div class="header-right"><span class="family-badge"><i class="dot"></i> ${localTest ? "Local test · 3 computer players" : "Invitation only"}</span><button class="ghost" data-action="deck">Deck & colors</button><button class="ghost" data-action="help">${help ? "Back to table" : "How to play"}</button>${unlocked ? '<button class="ghost" data-action="lock">Lock</button>' : ""}</div></header>`;
}
function home() {
  return `<main class="hero"><section><div class="eyebrow">A little rivalry. A lot of family.</div><h1>Same family.<br>New <em>game night.</em></h1><p class="intro">Pull up a chair for Twenty-Nine. Two teams, four familiar faces, and one very good reason to play another hand.</p><div class="chips"><span>♧ Four players</span><span>♤ Two partnerships</span><span>♡ Your private table</span></div><div class="suit-art">${["SJ", "H9", "CA", "D10"].map((c, i) => `<div class="art-card" style="--i:${i}">${card(c)}</div>`).join("")}</div></section><section class="entry"><div class="eyebrow">${unlocked ? "Make yourself at home" : "Just between us"}</div><h2>${unlocked ? "Your seat is waiting." : "Welcome to the family table."}</h2><p>${unlocked ? (localTest ? "Create a test table to play with three computer players. No Supabase connection needed." : "Start a table or join the family with an invite code. Partners sit opposite each other.") : "Enter the family password to come in. Ask your host if you haven’t received it yet."}</p>${unlocked ? `<div class="tabs"><button data-tab="create" class="${tab === "create" ? "active" : ""}">Create a table</button><button data-tab="join" class="${tab === "join" ? "active" : ""}">Join a table</button></div><form id="enter"><label>Your name<input name="name" maxlength="24" required placeholder="What does the family call you?" autocomplete="nickname"></label>${tab === "join" ? '<label>Table code<input name="code" required maxlength="8" minlength="8" pattern="[A-Fa-f0-9]{8}" placeholder="8-character invite code" style="text-transform:uppercase" autocomplete="off"></label>' : ""}<button ${busy ? "disabled" : ""}>${tab === "create" ? "Set the table →" : "Take your seat →"}</button></form><p class="fine">${localTest ? "Three computer players join automatically. Test rooms reset when the server restarts." : "You’ll need four family members to deal. Keep this browser to return to your seat."}</p>` : `<form id="unlock"><label>Family password<input name="password" type="password" required autocomplete="current-password" placeholder="Your family’s secret"></label><button ${busy ? "disabled" : ""}>Come on in →</button></form><p class="fine">Private rooms. Hidden hands. No public matchmaking.</p>`}</section></main><footer class="bottom-note">J · 9 · A · 10 · K · Q · 8 · 7 &nbsp; — &nbsp; A CLASSIC, SHARED WITH YOUR PEOPLE.</footer>`;
}
function trumpChoices(enabled = true) {
  return `<div class="trump-choices contract-choices">${Object.entries(symbols)
    .map(
      ([id, symbol]) =>
        `<button class="suit-button ${"HD".includes(id) ? "red" : ""}" data-trump="${id}" ${enabled ? "" : "disabled"} aria-label="Choose ${suitNames[id]} as trump">${symbol}<small>${suitNames[id]}</small></button>`,
    )
    .join(
      "",
    )}<button class="suit-button joker-option" data-trump="N" ${enabled ? "" : "disabled"} aria-label="Choose Joker, no trump"><b>★</b><small>Joker</small><small>No trump</small></button><button class="suit-button seventh-option" data-trump="7" ${enabled ? "" : "disabled"} aria-label="Choose seventh patti"><b>7</b><small>7th patti</small><small>Dealt card</small></button></div>`;
}
function trumpLabel(g) {
  return g.trump === "N"
    ? "★ Joker · No trump"
    : g.trump
      ? symbols[g.trump] + " " + suitNames[g.trump]
      : g.phase === "lobby"
        ? "—"
        : "Sealed";
}
function indicatorPanel(g) {
  if (!["playing", "result", "finished"].includes(g.phase)) return "";
  const face = g.revealed
    ? g.trumpMode === "seventh"
      ? card(g.trumpIndicator)
      : g.trump === "N"
        ? '<div class="card joker-indicator"><b>★</b><strong>JOKER</strong><small>NO TRUMP</small></div>'
        : `<div class="card suit-indicator"><b>${symbols[g.trump]}</b><small>${suitNames[g.trump]}</small></div>`
    : '<div class="card-back"><span>♧</span><b>29</b><small>SEALED COLOR</small></div>';
  return `<section class="panel indicator-panel"><div class="eyebrow">${g.trumpMode === "seventh" ? "7th patti · indicator" : "Color indicator"}</div><div class="indicator-content">${face}<div><strong>${g.revealed ? trumpLabel(g) : "Color is sealed"}</strong><p class="fine">${g.trumpMode === "seventh" ? "The seventh dealt card determines color." : "Joker means no trump; normal rank order."}</p>${g.canReveal ? '<button data-move="reveal">Open color</button>' : ""}</div></div>${g.seventhCard && g.seat === g.bidder ? `<div class="reserved-card"><span class="fine">Your seventh patti · kept outside your hand until color opens</span>${card(g.seventhCard, `data-card="${g.seventhCard}" aria-label="Play your seventh patti" ${g.legal.includes(g.seventhCard) && !busy ? "" : "disabled"}`)}</div>` : ""}</section>`;
}
function playedCards(cards, g, review = false) {
  return cards
    .map(
      (p, i) =>
        `<div class="played p${(p.seat - g.seat + 4) % 4} ${animatedCard === `${g.round}:${g.tricks}:${p.seat}:${p.card}` || (review && i === 3) ? "card-arriving" : ""}" style="--seat-x:${[0, 180, 0, -180][(p.seat - g.seat + 4) % 4]}px;--seat-y:${[120, 0, -120, 0][(p.seat - g.seat + 4) % 4]}px"><span class="played-name">${esc(g.players[p.seat].name)}</span>${card(p.card)}${review && p.seat === reviewTrick.winner ? '<span class="trick-winner-label">Winner</span>' : ""}</div>`,
    )
    .join("");
}
function reviewing() {
  return reviewTrick && Date.now() < reviewUntil;
}
function acceptGame(next) {
  if (
    game &&
    next.round === game.round &&
    next.tricks > game.tricks &&
    next.lastTrick
  ) {
    reviewTrick = next.lastTrick;
    reviewUntil = Date.now() + 2500;
    clearTimeout(reviewTimer);
    reviewTimer = setTimeout(() => {
      reviewTrick = null;
      render();
    }, 2550);
  }
  const p = next.trick?.at(-1);
  if (p) {
    const key = `${next.round}:${next.tricks}:${p.seat}:${p.card}`;
    const old = game?.trick?.at(-1);
    animatedCard =
      !old || old.card !== p.card || old.seat !== p.seat ? key : null;
  } else animatedCard = null;
  game = next;
}
function controls() {
  const g = game,
    me = g.seat,
    myTurn = g.turn === me;
  if (reviewing())
    return `<div class="eyebrow">Trick ${reviewTrick.number || g.tricks} complete</div><div class="trick review-trick">${playedCards(reviewTrick.cards, g, true)}</div><div class="trick-result" role="status"><strong>${esc(g.players[reviewTrick.winner].name)} wins</strong><span>+${reviewTrick.points} points · collecting cards…</span></div>`;
  if (g.phase === "lobby")
    return `<div class="eyebrow">The gathering</div><h2>${g.players.length === 4 ? "Everyone’s here." : "A chair for everyone."}</h2><p>${g.players.length}/4 family members seated.<br>Share the code and let the stories begin.</p><button data-action="invite" class="ghost" style="color:#e5ebda">Copy invite</button>${me === 0 ? `<div class="actions"><button data-move="start" ${g.players.length < 4 ? "disabled" : ""}>Deal the first hand</button></div>` : "<p>Waiting for the host to deal.</p>"}`;
  if (["result", "finished"].includes(g.phase))
    return `<div class="eyebrow">${g.phase === "finished" ? "A match to remember" : "Hand complete"}</div><h2>${g.phase === "finished" ? `Team ${g.matchWinner === 0 ? "Fern" : "Gold"} wins!` : g.result.success ? "Contract made." : "So close. Next hand?"}</h2><p>${esc(g.players[g.bidder].name)}’s team collected ${g.result.points} of ${g.result.target} required points.</p>${me === 0 ? `<button data-move="${g.phase === "finished" ? "rematch" : "next"}">${g.phase === "finished" ? "Play a new match" : "Deal next hand"} →</button>` : "<p>Waiting for the host.</p>"}`;
  if (g.phase === "bidding") {
    const duel = (g.auctionPair || [])
      .map((i) => esc(g.players[i].name))
      .join(" vs ");
    const waiting = (g.auctionWaiting || [])
      .map((i) => esc(g.players[i].name))
      .join(", ");
    const next = Math.max(17, g.bid + 1);
    const canStay =
      g.bidder !== null && g.bidder !== me && g.lastBidAction !== "stay";
    return `<div class="eyebrow">The auction · ${g.dropped?.length || 0} dropped</div><h2>${myTurn ? "What’s your call?" : esc(g.players[g.turn].name) + " is bidding."}</h2><div class="auction-duel">${duel}${waiting ? `<small>Waiting: ${waiting}</small>` : ""}</div><p>${g.bidder === null ? "Opening bid: 17" : `Highest bid: ${g.bid} · ${esc(g.players[g.bidder].name)}`}<br>${g.lastBidAction === "stay" ? "Stay was called. Increase or drop." : "Raise the call, match it, or drop."}</p>${myTurn ? `<div class="bid-actions"><button class="increase" data-action="increase" ${busy ? "disabled" : ""}>${g.bidder === null ? "Open" : "Increase to"} ${next}</button><button class="ghost" style="color:#e4eada" data-move="stay" ${!canStay || busy ? "disabled" : ""}>Stay${g.bidder !== null ? " at " + g.bid : ""}</button><button class="drop-bid ghost" style="color:#e4eada" data-move="drop" ${busy ? "disabled" : ""}>Drop out</button><button class="custom-toggle" data-action="custom" aria-expanded="false" aria-controls="custom-bid">Custom bid · choose your number</button></div><form id="custom-bid" class="custom-bid" hidden><input id="bid" name="bid" type="number" min="${next}" max="28" step="1" value="${Math.max(next, 21)}" required aria-label="Custom bid, ${next} to 28"><button>Bid →</button></form><p class="bid-hint">Stay matches the call. The next caller must increase or drop.</p>` : ""}`;
  }
  if (g.phase === "trump")
    return `<div class="eyebrow">Choose your color</div><h2>${myTurn ? "Suit, Joker, or 7th patti?" : "Color is being chosen."}</h2><p>${myTurn ? "Joker: no trump. Seventh patti: your seventh dealt card decides the suit." : esc(g.players[g.bidder].name) + " won the auction at " + g.bid + "."}</p>${myTurn ? trumpChoices() : ""}`;
  return `<div class="eyebrow">Trick ${g.tricks + 1} of 8 · ${myTurn ? "Your turn" : esc(g.players[g.turn].name) + "’s turn"}</div><div class="trick">${playedCards(g.trick, g)}${!g.trick.length ? '<div style="padding:65px 10px;color:#96b69b;font:italic 26px Georgia">29</div>' : ""}</div><p>${myTurn ? (g.trick.length ? "Follow suit if you can." : "Your lead. Choose a card.") : "Waiting for a card…"}</p>${g.canPair ? '<button data-move="pair">Declare Royals · K + Q</button>' : ""}`;
}
function table() {
  const g = game,
    me = g.seat;
  return `<main class="room-layout"><section><div class="table-top"><div><div class="eyebrow">Your private table</div><h1>A good hand. Better company.</h1></div><button class="ghost code" data-action="invite" title="Copy invitation">${esc(session.code)} ↗</button></div><div class="table phase-${g.phase}">${Array.from(
    { length: 4 },
    (_, i) => {
      const p = g.players[i],
        pos = (i - me + 4) % 4;
      return `<div class="seat s${pos} ${g.turn === i && !["lobby", "result", "finished"].includes(g.phase) ? "active" : ""}"><span class="avatar">${p ? esc(p.name[0].toUpperCase()) : "+"}</span><div><strong>${p ? esc(p.name) + (i === me ? " · You" : "") : "Empty chair"}</strong><small>${p ? (i % 2 === me % 2 ? "Your team" : "Opponents") + " · " + p.count + " cards" : "Waiting for family"}</small></div></div>`;
    },
  ).join(
    "",
  )}<div class="table-center">${controls()}</div></div><div class="hand-section"><div class="hand-label">YOUR HAND <span class="muted">${g.players[me].count} CARDS</span></div><div class="hand" data-phase="${g.phase}">${g.players[me].hand.length ? g.players[me].hand.map((c) => card(c, `data-card="${c}" aria-label="${esc(c.slice(1))} of ${suitNames[c[0]]}" ${g.legal.includes(c) && !busy && !reviewing() ? "" : "disabled"}`)).join("") : '<div class="empty-hand">Your cards will find you when the host deals.</div>'}</div><div class="status-line">${online ? "● Connected · Hands are visible only to their owners" : "Reconnecting… Your seat is saved."}</div></div></section><aside class="side"><section class="panel"><div class="eyebrow">First to +6 · −6 loses</div><h3 style="margin-top:9px">A friendly rivalry</h3>${[
    0, 1,
  ]
    .map(
      (t) =>
        `<div class="score-row"><div><span>${t === 0 ? "♧" : "♢"} Team ${t === 0 ? "Fern" : "Gold"} ${t === me % 2 ? "· You" : ""}</span><small>${
          g.players
            .filter((_, i) => i % 2 === t)
            .map((p) => esc(p.name))
            .join(" & ") || "Waiting for players"
        }</small></div><strong>${g.scores[t] > 0 ? "+" : ""}${g.scores[t]}</strong></div>`,
    )
    .join(
      "",
    )}<div class="divider"></div><div class="stat"><span class="muted">Hand</span><strong>${g.round || "—"}</strong></div><div class="stat"><span class="muted">Contract</span><strong>${g.target || "—"} ${g.pair ? "(Royals)" : ""}</strong></div><div class="stat"><span class="muted">Trump</span><strong>${g.trump ? trumpLabel(g) + (!g.revealed ? " · Secret" : "") : g.phase === "lobby" ? "—" : "Sealed"}</strong></div><div class="stat"><span class="muted">Hand points</span><strong>${g.taken ? g.taken[0] + " : " + g.taken[1] : "—"}</strong></div></section>${indicatorPanel(g)}<section class="panel"><div class="eyebrow">A little reminder</div><div class="rankline">J 9 A 10 K Q 8 7</div><div class="fine">Highest → lowest, in every suit.<br>J = 3 · 9 = 2 · A, 10 = 1 point.</div>${g.lastTrick ? `<div class="divider"></div><div class="fine" style="margin-bottom:12px">Last trick · ${esc(g.players[g.lastTrick.winner].name)} +${g.lastTrick.points}</div><div class="last-trick">${g.lastTrick.cards.map((p) => card(p.card)).join("")}</div>` : ""}</section><section class="panel activity"><div class="eyebrow">Around the table</div><div class="log">${
    g.log.length
      ? g.log
          .slice()
          .reverse()
          .map((l) => `<p>${esc(l)}</p>`)
          .join("")
      : "<p>The best part is about to begin.</p>"
  }</div></section></aside></main>`;
}
function deckPanel() {
  const canChoose =
    unlocked && game?.phase === "trump" && game.turn === game.seat;
  return `<main class="deck-page"><div class="deck-heading"><div><div class="eyebrow">The heirloom collection</div><h1>Your deck. Your colors.</h1><p>32 cards · Four suits · J, 9, A, 10, K, Q, 8, 7</p></div><button class="ghost" data-action="close-deck">Back to table</button></div><section class="deck-settings"><div class="deck-box"><button class="card-back deck-stack" data-action="expand-deck" aria-label="Open the deck"><span>♧</span><b>29</b><small>THE FAMILY TABLE</small></button><div><h2>Open the deck</h2><p>Browse every face in the collection.</p><button data-action="expand-deck" aria-expanded="${deckExpanded}">${deckExpanded ? "Close deck" : "Open all 32 cards"} →</button></div></div><div class="deck-options"><h2>Color means the game’s trump</h2><p>Choose ♠ Spades, ♥ Hearts, ♣ Clubs, or ♦ Diamonds after you win the auction.</p><p><strong>Joker:</strong> no trump; normal rank order.<br><strong>7th patti:</strong> the seventh card dealt to you chooses the suit.</p></div></section><section class="trump-picker"><div><div class="eyebrow">Game color · Trump suit</div><h2>${canChoose ? "Choose your secret trump" : "Select trump after winning the bid"}</h2><p>${canChoose ? "Choose a suit, Joker for no trump, or seventh patti to use your actual seventh dealt card." : "The highest bidder chooses a suit, Joker (no trump), or seventh patti. This choice stays sealed until color is opened."}</p></div>${trumpChoices(canChoose)}</section>${
    deckExpanded
      ? `<section class="deck-gallery" aria-label="All 32 card faces">${Object.entries(
          symbols,
        )
          .map(
            ([id, symbol]) =>
              `<section><h2 class="${"HD".includes(id) ? "red" : ""}">${symbol} ${suitNames[id]}</h2><div class="deck-row">${["J", "9", "A", "10", "K", "Q", "8", "7"].map((rank) => `<div aria-label="${rank} of ${suitNames[id]}">${card(id + rank)}</div>`).join("")}</div></section>`,
          )
          .join("")}</section>`
      : ""
  }</main>`;
}
function rules() {
  return `<main class="help"><div class="eyebrow">The house rules</div><h1>Welcome to Twenty-Nine.</h1><p>Four people, two partnerships. Seats 1 & 3 are Team Fern; seats 2 & 4 are Team Gold. Join in that order to sit opposite your partner.</p><h2>Make your call</h2><p>Each player starts with four cards. Beginning to the dealer’s left, bidding starts at 17 and can go up to 28. Increase raises by one; Custom lets you jump to a higher whole number, such as 21. Stay matches the current call and makes you the highest bidder. The next caller must increase or drop; consecutive Stay calls are not allowed. Drop removes you from this auction. The first two players bid against each other. They alternate calls until one drops; only then does the next waiting player challenge the survivor. Waiting players cannot bid early. The auction ends when three players have dropped. If the first three Drop before a bid, the dealer must bid 17. The winner selects a suit, Joker (no trump), or seventh patti, then everyone receives four more cards.</p><h2>Play your hand</h2><p>Play clockwise, starting to the dealer’s left. Follow the led suit whenever possible. The first player unable to follow automatically reveals trump when they play. There is no obligation to play a trump. Before the reveal, the highest card in the led suit wins; from the reveal trick onward, the highest trump wins, otherwise the highest led-suit card wins. The winner leads next.</p><h2>Remember the order</h2><p>J, 9, A, 10, K, Q, 8, 7 — high to low in every suit. Jacks score 3, nines 2, aces and tens 1 each. Other cards score 0. There are 28 points per hand; this version gives no last-trick bonus.</p><h2>Joker and seventh patti</h2><p>Joker is a color indicator for no trump, not a 33rd playing card. The highest card of the led suit wins, using J, 9, A, 10, K, Q, 8, 7. There are no Royals in no-trump play. Reverse ranking is a different regional variant and is not enabled.</p><p>Choose seventh patti before the second deal. Your actual seventh dealt card is placed face down under the indicator deck, outside your playable hand. Its suit becomes trump. Only you can inspect it before color opens. You must follow suit using your other cards whenever possible. When you cannot, you may discard without opening, or open color and return the seventh card to your hand; normal follow-suit rules then apply. Other players unable to follow open color automatically. The sealed card cannot lead unless it is your last card.</p><h2>A royal advantage</h2><p>After trumps are revealed and your side wins a trick, you may declare Royals if you still hold both the trump King and Queen. Declare before the next card is played. The bidding team’s Royals lowers its target by 4 (minimum 17); opponents’ Royals raises it by 4 (maximum 28).</p><h2>A match to six</h2><p>Take eight tricks. The bidding team earns one match point for meeting its target, or loses one for missing it. Opponents’ match score stays unchanged. Reach +6 to win; reaching −6 loses. The dealer rotates clockwise after each hand.</p><p class="fine">Based on <a href="https://www.pagat.com/jass/29.html" target="_blank" rel="noreferrer">Pagat’s Twenty-Nine rules</a>. Family rules: opening bid and Royals floor of 17, with Increase / Stay / Drop / Custom controls. Clockwise play; Joker/no-trump and seventh patti enabled. No reverse ranking, doubles, single-hand, or regional cancellation rules.</p><button data-action="help">Back to the table</button></main>`;
}
function render() {
  app.innerHTML =
    header() +
    (deckOpen
      ? deckPanel()
      : help
        ? rules()
        : unlocked && game
          ? table()
          : home());
  document.documentElement.style.setProperty(
    "--deck-color",
    deckColors[deckColor].value,
  );
  if (invite && !game) {
    const input = $("input[name=code]");
    if (input) input.value = invite;
  }
}
async function move(command) {
  if (busy || reviewing()) return;
  busy = true;
  animatedCard = null;
  render();
  try {
    const d = await api({
      action: "move",
      ...session,
      version: game.version,
      command,
    });
    acceptGame(d.game);
  } catch (e) {
    notify(e.message);
    await refresh();
  } finally {
    busy = false;
    render();
  }
}
async function refresh() {
  if (!session || !unlocked) return;
  try {
    const d = await api({ action: "state", ...session });
    if (!game || d.game.version >= game.version) {
      const changed = !game || d.game.version !== game.version;
      acceptGame(d.game);
      if (changed) render();
    }
  } catch (e) {
    online = false;
    if (game) {
      const s = $(".status-line");
      if (s) s.textContent = "Reconnecting… Your seat is saved.";
    }
  }
}
app.addEventListener("click", async (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.tab) {
    tab = el.dataset.tab;
    render();
  }
  if (el.dataset.action === "deck") {
    deckOpen = true;
    help = false;
    render();
  }
  if (el.dataset.action === "close-deck") {
    deckOpen = false;
    render();
  }
  if (el.dataset.action === "expand-deck") {
    deckExpanded = !deckExpanded;
    render();
  }
  if (el.dataset.deckColor && deckColors[el.dataset.deckColor]) {
    deckColor = el.dataset.deckColor;
    try {
      localStorage.setItem("family29-deck-color", deckColor);
    } catch {}
    render();
  }
  if (el.dataset.action === "help") {
    deckOpen = false;
    help = !help;
    render();
  }
  if (el.dataset.action === "lock") {
    try {
      await api({ action: "logout" });
      unlocked = false;
      game = null;
      render();
    } catch (e) {
      notify(e.message);
    }
  }
  if (el.dataset.action === "invite") {
    const url = new URL(location.href);
    url.searchParams.set("table", session.code);
    try {
      await navigator.clipboard.writeText(url.href);
      notify("Invite copied. Share it and your family password privately.");
    } catch {
      notify("Share table code: " + session.code);
    }
  }
  if (el.dataset.action === "increase")
    move({ type: "bid", value: Math.max(17, game.bid + 1) });
  if (el.dataset.action === "custom") {
    const form = $("#custom-bid");
    form.hidden = !form.hidden;
    el.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) $("#bid").focus();
  }
  if (el.dataset.move) move({ type: el.dataset.move });
  if (el.dataset.trump) {
    deckOpen = false;
    move({ type: "trump", suit: el.dataset.trump });
  }
  if (el.dataset.card) move({ type: "play", card: el.dataset.card });
});
app.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const f = e.target,
    data = new FormData(f);
  if (f.id === "custom-bid") {
    const value = Number(data.get("bid"));
    if (
      !Number.isInteger(value) ||
      value < Math.max(17, game.bid + 1) ||
      value > 28
    ) {
      notify("Choose a whole-number bid above the current bid, up to 28.");
      return;
    }
    await move({ type: "bid", value });
    return;
  }
  busy = true;
  const submit = f.querySelector("button");
  submit.disabled = true;
  try {
    if (f.id === "unlock") {
      await api({ action: "unlock", password: data.get("password") });
      unlocked = true;
      await refresh();
    } else if (f.id === "enter") {
      const d = await api({
        action: tab,
        name: data.get("name"),
        code: String(data.get("code") || "")
          .trim()
          .toUpperCase(),
      });
      session = { code: d.code, token: d.token };
      localStorage.setItem("family29-seat", JSON.stringify(session));
      acceptGame(d.game);
    }
  } catch (e) {
    notify(e.message);
  } finally {
    busy = false;
    render();
  }
});
const invite = new URLSearchParams(location.search).get("table");
if (invite && /^[A-F0-9]{8}$/.test(invite)) tab = "join";
render();
api({ action: "session" })
  .then(async () => {
    unlocked = true;
    await refresh();
    render();
    if (invite && !game) {
      const input = $("input[name=code]");
      if (input) input.value = invite;
    }
  })
  .catch(() => {});
async function pollTable() {
  if (!busy && !document.hidden) await refresh();
  setTimeout(pollTable, localTest ? 700 : 1800);
}
setTimeout(pollTable, 700);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
