import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";

const app = createApp({
  runtimeName: "vercel",
  // Keep the Vercel function lightweight and avoid loading Node-only scraping
  // helpers during every request. The built-in fetch is enough for this runtime.
  upstreamFetch: fetch,
});

export default handle(app);
