import http from "node:http";
import { readFile } from "node:fs/promises";
import productionHandler, { createHandler } from "./api/game.mjs";
import { randomBytes } from "node:crypto";
import { createLocalDatabase } from "./lib/local-test.mjs";
try {
  process.loadEnvFile(".env.local");
} catch {}
const localTest = !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY;
const localConfig = {
  password: process.env.FAMILY_PASSWORD || "1234",
  secret: process.env.SESSION_SECRET || randomBytes(32).toString("hex"),
};
const handler = localTest
  ? createHandler({
      getConfig: () => localConfig,
      database: createLocalDatabase({ paced: true }),
      localTest: true,
      advanceComputers: () => {},
    })
  : productionHandler;
if (localTest)
  console.log(
    "LOCAL TEST MODE: three computer players; rooms reset when the server restarts.",
  );
http
  .createServer(async (req, res) => {
    if (req.url === "/api/game") return handler(req, res);
    const path = new URL(req.url, "http://localhost").pathname;
    const files = {
      "/": "index.html",
      "/app.js": "app.js",
      "/style.css": "style.css",
      "/assets/royal-courts.png": "assets/royal-courts.png",
    };
    if (!files[path]) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Type",
      path.endsWith(".png")
        ? "image/png"
        : path.endsWith(".js")
          ? "text/javascript"
          : path.endsWith(".css")
            ? "text/css"
            : "text/html",
    );
    res.end(
      await readFile(new URL("./public/" + files[path], import.meta.url)),
    );
  })
  .listen(3029, "0.0.0.0", () =>
    console.log("Twenty-Nine: http://localhost:3029"),
  );
