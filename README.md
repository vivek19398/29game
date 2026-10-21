# Twenty-Nine · The family table

A four-player family game for **Vercel + Supabase**, with a local test mode and three computer players. Zero runtime packages: the frontend uses browser APIs; the Vercel API uses Node’s crypto and fetch.

## Deploy

1. Create a Supabase project (or use your existing one). Run `supabase/setup.sql` in its SQL Editor. These prefixed tables do not modify Monopoly Deal tables.
2. Import this repository into a **new Vercel project**. Keep **Root Directory** at the repository root (`.`), framework preset **Other**, build command `npm run build`, output `dist`, and Node.js 22 or 24.
3. Add all four environment variables from `.env.example` in Vercel. `SUPABASE_SECRET_KEY` is the server-only secret/service_role key; never use a public anon key here. Set a private `FAMILY_PASSWORD` of at least 4 characters and a random `SESSION_SECRET` of at least 32 characters. Generate the latter with `openssl rand -hex 32`.
4. Deploy. Open the URL, enter the password, create a table, and copy its invite. Share the password privately with family. Do not put secrets in Git or in `VITE_` variables. Changing `SESSION_SECRET` signs all browsers out; rotate it if the family password leaks.
5. Four people join using separate browsers/devices. Join order sets partnerships: seats 1 & 3 vs 2 & 4. The first player is host and deals. All players see the same game; each sees only their own hand. Refresh restores the seat on that browser.

No anonymous Supabase auth configuration, public signup, WebSocket server, or Supabase Realtime setup is required. Browser polling every 1.8 seconds goes through Vercel; serverless calls persist state in Supabase and use atomic version comparisons to prevent simultaneous moves overwriting one another. Stale or retried moves are rejected, never applied twice. Reads and moves require the family cookie plus a random seat token. Tables and authentication rate limits have RLS and no anon/authenticated grants. The raw state, tokens’ hashes, undealt cards, and secret trumps never reach other players.

## Local development

With Node 22+, run `npm run dev` and open http://localhost:3029. Without Supabase settings, local test mode starts with password `1234` and three computer players. For online database testing, copy `.env.example` to `.env.local`, fill in the four variables and run the SQL first; local development will then use that Supabase database. `npm test` runs engine and API security tests; `npm run build` creates the static frontend.

## Rules

Source: https://www.pagat.com/jass/29.html

Standard clockwise game: 32 cards; ranking J, 9, A, 10, K, Q, 8, 7. J=3, 9=2, A/10=1. Four cards before auction, four after trump selection. Family bidding starts at 17, up to 28. Increase raises by one; Custom allows any higher whole-number bid (for example 21). Stay matches the current bid and makes its caller the highest bidder; the next caller must increase or drop (no consecutive Stays). Drop removes the caller for this auction. Bidding stays between two active players, alternating until one drops. Only then does the next waiting player enter against the survivor. Three drops end the auction. If the first three Drop before anyone bids, the dealer must bid 17. Trumps remain secret until someone cannot follow suit, automatically revealed as that card is played. No forced trumping. Royals require K/Q of trumps still held after the holder’s team wins a trick with trumps revealed; declare before the next lead. Target adjusts by four, capped 17–28. No last-trick point (28 total); match scores +1/−1 for bidding team only. +6 wins, −6 loses. Joker/no-trump and seventh patti are supported. No reverse ranking, doubles, single-hand or regional cancellation rules.

## Practical limits

Family-only access uses a shared password, not individual verified identities. Anyone given the password can enter and create rooms; share it only with family. The password session lasts 30 days. Login attempts are limited in Supabase. Invite codes alone cannot bypass the password. Never expose the Supabase service key. Use Supabase’s normal backups for your project.

Seats are bound to local browser storage. Clearing it loses that seat; there is no account recovery or replacement of a player during a hand. A disconnected player can reconnect; the table waits on their turn. The host can deal the next hand or start a rematch after completion. Online rooms have no bots, timeouts, chat, midgame substitutions or abandonment controls. Local test mode provides three computer players. Create a new table if a seat is lost. Polling has Vercel/Supabase usage costs; pause the tab when not playing. Optional cleanup statements are in `supabase/setup.sql`.

Deployment requires your Vercel project and Supabase environment configuration. Nothing in this folder automatically provisions or changes your hosted projects.

## Heirloom card artwork

The 12 illustrated courts were generated with the built-in image-generation tool. The atlas is in `public/assets/royal-courts.png`; the generation prompt is in `docs/card-art-prompt.txt`. Rank labels, suit indices and the exact pip counts are rendered as crisp HTML/CSS for all 32 cards.

## Immediate local testing

Run `npm run dev` without Supabase settings to enable local test mode. Sign in using your configured family password (default `1234`), create a table and deal. Three computer players fill the other seats automatically. This mode uses memory; restarting the server clears test rooms. Vercel always uses Supabase and never enables this local fallback.

## Joker and seventh patti

The highest bidder can choose Joker (no trump, normal J–9–A–10–K–Q–8–7 order) or seventh patti (the suit of their actual seventh dealt card). The seventh card is reserved outside the playable hand until color opens. See [the research and rule decisions](docs/RULES-RESEARCH.md) for sources, restrictions and variant differences.

## Table animations and pacing

Local computer players act one at a time, 2.5 seconds apart. Completed tricks stay visible for 2.5 seconds with player names, the winner and captured points, then animate toward collection. A computer starting the following trick waits longer so the review is visible. New cards animate from the player's seat and the active avatar pulses. Reduced-motion preferences disable movement while keeping the readable pauses. Production polling remains at 1.8 seconds; local test polling is faster to show individual computer turns. No third-party animation library is loaded.
