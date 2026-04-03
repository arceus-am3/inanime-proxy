import { createApp } from "./src/app.js";

const app = createApp({
  runtimeName: "vercel",
  upstreamFetch: fetch,
});

export default app;
