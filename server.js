import dotenv from "dotenv";
import { serve } from "@hono/node-server";
import { pathToFileURL } from "node:url";
import { createApp } from "./src/app.js";

dotenv.config();

const isVercel = Boolean(process.env.VERCEL);
const runtimeName = isVercel ? "vercel" : "node";
let upstreamFetch = fetch;

if (!isVercel) {
  const { nodeUpstreamFetch } = await import("./src/nodeUpstreamFetch.js");
  upstreamFetch = nodeUpstreamFetch;
}

const app = createApp({
  runtimeName,
  upstreamFetch,
});

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10) || 3000;

  serve(
    {
      fetch: app.fetch,
      port,
      hostname: "0.0.0.0",
    },
    (info) => {
      const host = info.address === "::" ? "127.0.0.1" : info.address;
      console.log(`InAnime Proxy running at http://${host}:${info.port}`);
    }
  );
}

export default app;
