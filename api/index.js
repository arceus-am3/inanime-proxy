import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { nodeUpstreamFetch } from "../src/nodeUpstreamFetch.js";

const app = createApp({
  runtimeName: "vercel",
  upstreamFetch: nodeUpstreamFetch,
});

export default handle(app);
