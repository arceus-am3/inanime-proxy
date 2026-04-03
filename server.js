import dotenv from "dotenv";
import { serve } from "@hono/node-server";
import { createApp } from "./src/app.js";
import { nodeUpstreamFetch } from "./src/nodeUpstreamFetch.js";

dotenv.config();

const app = createApp({
  runtimeName: "node",
  upstreamFetch: nodeUpstreamFetch,
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10) || 3000;

serve(
  {
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0",
  },
  (info) => {
    const host = info.address === "::" ? "127.0.0.1" : info.address;
    console.log(`Anime Proxy Suite running at http://${host}:${info.port}`);
  }
);
