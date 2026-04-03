import { Hono } from "hono";
import { getRuntimeConfig } from "./config.js";
import { applyCorsHeaders, isOriginAllowed, proxyTarget } from "./proxy.js";
import { getProviderProfiles, resolveProviderKey } from "./providers.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomePage(config, providers, baseUrl) {
  const encodedMaster = encodeURIComponent("https://example.com/master.m3u8");
  const encodedSegment = encodeURIComponent("https://example.com/segment.ts");
  const encodedWatchingMaster = encodeURIComponent(
    "https://fxpy7.watching.onl/anime/demo/master.m3u8"
  );
  const encodedReferer = encodeURIComponent("https://vidwish.live/");
  const encodedOrigin = encodeURIComponent("https://vidwish.live");
  const encodedHeaders = encodeURIComponent(
    JSON.stringify({
      referer: "https://vidwish.live/",
      origin: "https://vidwish.live",
    })
  );

  const exampleAutoDetect = `${baseUrl}/m3u8-proxy?url=${encodedMaster}`;
  const exampleProvider = `${baseUrl}/m3u8-proxy?provider=hianime&url=${encodedMaster}`;
  const exampleReferer = `${baseUrl}/m3u8-proxy?provider=hianime&referer=${encodedReferer}&origin=${encodedOrigin}&url=${encodedWatchingMaster}`;
  const exampleHeaders = `${baseUrl}/m3u8-proxy?provider=hianime&headers=${encodedHeaders}&url=${encodedWatchingMaster}`;
  const exampleDirectProvider = `${baseUrl}/proxy/hianime?url=${encodedMaster}`;
  const exampleTsProxy = `${baseUrl}/ts-proxy?provider=hianime&url=${encodedSegment}`;

  const endpointDocs = [
    {
      method: "GET",
      path: "/",
      summary: "Docs home page. Yahin se saare endpoints aur examples dekh sakte ho.",
      example: `${baseUrl}/`,
    },
    {
      method: "GET",
      path: "/health",
      summary: "Runtime health check. Server live hai ya nahi, quickly confirm karta hai.",
      example: `${baseUrl}/health`,
    },
    {
      method: "GET",
      path: "/providers",
      summary: "Supported providers aur unke aliases JSON me deta hai.",
      example: `${baseUrl}/providers`,
    },
    {
      method: "GET",
      path: "/m3u8-proxy?provider=<provider>&url=<encoded-url>",
      summary: "Main HLS playlist proxy. Master playlist aur child playlists dono rewrite karta hai.",
      example: exampleProvider,
    },
    {
      method: "GET",
      path: "/ts-proxy?provider=<provider>&url=<encoded-url>",
      summary: "Segment proxy. Binary files, ts, m4s, mp4, aac type requests pass through karta hai.",
      example: exampleTsProxy,
    },
    {
      method: "GET",
      path: "/proxy/:provider?url=<encoded-url>",
      summary: "Provider-specific generic proxy. Playlist aur segment dono ke liye use ho sakta hai.",
      example: exampleDirectProvider,
    },
    {
      method: "GET",
      path: "/:provider/m3u8-proxy?url=<encoded-url>",
      summary: "Provider path me fixed ho jata hai. Query me provider dene ki zarurat nahi.",
      example: `${baseUrl}/hianime/m3u8-proxy?url=${encodedMaster}`,
    },
    {
      method: "GET",
      path: "/:provider/ts-proxy?url=<encoded-url>",
      summary: "Provider-specific segment route.",
      example: `${baseUrl}/hianime/ts-proxy?url=${encodedSegment}`,
    },
  ];

  const endpointCards = endpointDocs
    .map(
      (endpoint) => `
        <article class="doc-card endpoint-card">
          <div class="endpoint-head">
            <span class="pill">${escapeHtml(endpoint.method)}</span>
            <code>${escapeHtml(endpoint.path)}</code>
          </div>
          <p>${escapeHtml(endpoint.summary)}</p>
          <div class="example-label">Example</div>
          <pre><code>${escapeHtml(endpoint.example)}</code></pre>
        </article>
      `
    )
    .join("");

  const providerCards = Object.values(providers)
    .map(
      (provider) => `
        <article class="doc-card provider-card">
          <h3>${escapeHtml(provider.label)}</h3>
          <p><strong>Key:</strong> <code>${escapeHtml(provider.key)}</code></p>
          <p><strong>Aliases:</strong> ${escapeHtml(provider.aliases.join(", ") || "-")}</p>
          <p><strong>Auto detect hosts:</strong> ${escapeHtml(
            provider.detectHosts.join(", ")
          )}</p>
          <pre><code>${escapeHtml(`${baseUrl}/proxy/${provider.key}?url=${encodedMaster}`)}</code></pre>
        </article>
      `
    )
    .join("");

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Anime Proxy Suite</title>
      <style>
        :root {
          --bg: #0f1115;
          --panel: #171a21;
          --panel-2: #11151d;
          --text: #f6f7fb;
          --muted: #aab2c0;
          --accent: #4cc9f0;
          --accent2: #ffd166;
          --accent3: #9ef0c2;
          --border: #2a3040;
          --code: #0c1017;
          --shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", sans-serif;
          color: var(--text);
          background:
            radial-gradient(circle at top right, rgba(76, 201, 240, 0.18), transparent 30%),
            radial-gradient(circle at bottom left, rgba(255, 209, 102, 0.15), transparent 30%),
            var(--bg);
          min-height: 100vh;
        }
        main {
          width: min(1180px, calc(100% - 32px));
          margin: 32px auto;
          padding: 28px;
          background: rgba(23, 26, 33, 0.9);
          border: 1px solid var(--border);
          border-radius: 24px;
          backdrop-filter: blur(10px);
          box-shadow: var(--shadow);
        }
        h1, h2, h3 { margin-top: 0; }
        h1 { font-size: clamp(2rem, 5vw, 3.2rem); margin-bottom: 10px; }
        h2 { font-size: 1.35rem; margin-bottom: 14px; }
        h3 { font-size: 1rem; margin-bottom: 8px; }
        p, li, td, th { color: var(--muted); line-height: 1.6; }
        a { color: var(--accent); }
        code {
          color: var(--accent2);
          word-break: break-all;
        }
        pre {
          margin: 0;
          padding: 14px;
          overflow-x: auto;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.06);
          background: var(--code);
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin: 24px 0;
        }
        .hero {
          display: grid;
          gap: 18px;
        }
        .hero p {
          max-width: 900px;
          font-size: 1rem;
        }
        .card, .doc-card {
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,0.03);
        }
        .section {
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .section:first-of-type {
          border-top: 0;
          padding-top: 0;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .steps {
          margin: 0;
          padding-left: 22px;
        }
        .steps li + li {
          margin-top: 8px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 54px;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.82rem;
          font-weight: 700;
          color: #07131a;
          background: linear-gradient(135deg, var(--accent), var(--accent3));
        }
        .endpoint-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .endpoint-card p,
        .provider-card p {
          margin: 8px 0;
        }
        .example-label {
          margin: 10px 0 8px;
          color: var(--text);
          font-size: 0.92rem;
          font-weight: 600;
        }
        .table-wrap {
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: rgba(255,255,255,0.02);
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 14px;
          text-align: left;
          vertical-align: top;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        th {
          color: var(--text);
          background: rgba(255,255,255,0.03);
        }
        tr:last-child td {
          border-bottom: 0;
        }
        .tip-box {
          border-left: 4px solid var(--accent);
          background: rgba(76, 201, 240, 0.08);
          padding: 16px;
          border-radius: 14px;
        }
        .muted {
          color: var(--muted);
        }
        .small {
          font-size: 0.92rem;
        }
        @media (max-width: 720px) {
          main {
            width: min(100%, calc(100% - 20px));
            margin: 10px auto;
            padding: 18px;
            border-radius: 18px;
          }
          .endpoint-head {
            align-items: flex-start;
          }
        }
      </style>
    </head>
    <body>
      <main>
        <section class="hero section">
          <div>
            <h1>Anime Proxy Suite</h1>
            <p>Unified multi-provider proxy for AnimeKai, AnimePahe, and HiAnime. Yeh page docs home hai: saare endpoints, query params, ready-made examples, aur new stream link aane par kya karna hai sab yahin explained hai.</p>
          </div>
        <div class="meta">
          <div class="card">
            <strong>Runtime</strong>
            <p>${config.runtimeName}</p>
          </div>
          <div class="card">
            <strong>Allowed Origins</strong>
            <p>${config.allowedOrigins.join(", ")}</p>
          </div>
          <div class="card">
            <strong>Cloudscraper</strong>
            <p>${config.enableCloudscraper ? "enabled" : "disabled"}</p>
          </div>
          <div class="card">
            <strong>Base URL</strong>
            <p>${escapeHtml(baseUrl)}</p>
          </div>
        </div>
        </section>

        <section class="section">
          <h2>Quick Start</h2>
          <ol class="steps">
            <li>Raw stream URL lo, usually <code>results.streamingLink.link.file</code> se.</li>
            <li>Seedha try karo: <code>/m3u8-proxy?provider=hianime&amp;url=ENCODED_URL</code>.</li>
            <li>Agar host special referer maangta hai, <code>referer</code> aur <code>origin</code> query add karo.</li>
            <li>Player me raw CDN link ki jagah proxy link use karo.</li>
            <li>Proxy master playlist ko rewrite karega, isliye child playlists aur segments bhi isi server se load honge.</li>
          </ol>
        </section>

        <section class="section">
          <h2>Ready Examples</h2>
          <div class="grid">
            <article class="doc-card">
              <h3>Auto Detect</h3>
              <p>Provider host se detect ho jata hai. Jab auto detect kaam kare tab yeh shortest form hai.</p>
              <pre><code>${escapeHtml(exampleAutoDetect)}</code></pre>
            </article>
            <article class="doc-card">
              <h3>Manual Provider</h3>
              <p>Auto detect fail ho ya tum direct provider fix karna chaho, to <code>provider=</code> do.</p>
              <pre><code>${escapeHtml(exampleProvider)}</code></pre>
            </article>
            <article class="doc-card">
              <h3>Referer + Origin</h3>
              <p>Special hosts ke liye easiest supported format. Ab JSON headers banana zaroori nahi.</p>
              <pre><code>${escapeHtml(exampleReferer)}</code></pre>
            </article>
            <article class="doc-card">
              <h3>Headers JSON</h3>
              <p>Advanced fallback. Agar custom headers pass karne ho to <code>headers=JSON</code> bhi supported hai.</p>
              <pre><code>${escapeHtml(exampleHeaders)}</code></pre>
            </article>
          </div>
        </section>

        <section class="section">
          <h2>Endpoints</h2>
          <div class="grid">
            ${endpointCards}
          </div>
        </section>

        <section class="section">
          <h2>Query Params</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Param</th>
                  <th>Required</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>url</code></td>
                  <td>Yes</td>
                  <td>Target playlist ya segment URL. Hamesha URL-encoded form me bhejo.</td>
                </tr>
                <tr>
                  <td><code>provider</code></td>
                  <td>No</td>
                  <td><code>animekai</code>, <code>animepahe</code>, <code>hianime</code>. Auto detect fail ho to manually do.</td>
                </tr>
                <tr>
                  <td><code>referer</code></td>
                  <td>No</td>
                  <td>Jab upstream host specific referer maangta ho. Example: <code>https://vidwish.live/</code>.</td>
                </tr>
                <tr>
                  <td><code>origin</code></td>
                  <td>No</td>
                  <td>Usually referer ka origin part. Example: <code>https://vidwish.live</code>.</td>
                </tr>
                <tr>
                  <td><code>headers</code></td>
                  <td>No</td>
                  <td>Advanced JSON string. Example: <code>{"referer":"https://vidwish.live/","origin":"https://vidwish.live"}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <h2>Providers</h2>
          <div class="grid">
            ${providerCards}
          </div>
        </section>

        <section class="section">
          <h2>How Rewriting Works</h2>
          <div class="grid">
            <article class="doc-card">
              <h3>Playlist Request</h3>
              <p>Master ya child <code>.m3u8</code> mile to proxy us file ke andar ke URLs ko apne routes me rewrite karta hai.</p>
            </article>
            <article class="doc-card">
              <h3>Segment Request</h3>
              <p>Non-playlist files jaise <code>.ts</code>, <code>.m4s</code>, <code>.mp4</code>, <code>.aac</code> direct stream ki tarah pass through hote hain.</p>
            </article>
            <article class="doc-card">
              <h3>Why Player Works</h3>
              <p>Ek baar first playlist proxy se load ho jaye, uske baad child playlist aur segment requests bhi proxy URLs ban jati hain.</p>
            </article>
          </div>
        </section>

        <section class="section">
          <h2>New URL Aaye To Kya Karo</h2>
          <div class="tip-box">
            <ol class="steps">
              <li><code>/api/stream</code> JSON me <code>results.streamingLink.link.file</code> copy karo.</li>
              <li>Agar available ho to <code>results.streamingLink.iframe</code> dekho.</li>
              <li>Provider mostly <code>hianime</code> hoga, to pehle <code>provider=hianime</code> ke saath try karo.</li>
              <li><code>iframe</code> ka domain nikaalo. Usse <code>referer</code> aur <code>origin</code> banao. Example: <code>https://vidwish.live/stream/s-2/123/sub</code> se referer <code>https://vidwish.live/</code> aur origin <code>https://vidwish.live</code>.</li>
              <li>Final URL form use karo: <code>/m3u8-proxy?provider=hianime&amp;referer=...&amp;origin=...&amp;url=...</code></li>
              <li>Agar error <code>Unknown provider</code> aaye to new host mapping add karni padegi.</li>
              <li>Agar error <code>403</code> aaye to host ko alag referer/origin chahiye.</li>
            </ol>
          </div>
        </section>

        <section class="section">
          <h2>Troubleshooting</h2>
          <div class="grid">
            <article class="doc-card">
              <h3>Unknown provider</h3>
              <p>Host auto-detect list me nahi hai. Temporary fix ke liye <code>provider=</code> do. Permanent fix ke liye provider host mapping add karo.</p>
            </article>
            <article class="doc-card">
              <h3>403 / Cloudflare</h3>
              <p>Upstream ko specific referer ya origin chahiye. <code>referer</code> aur <code>origin</code> query params use karo.</p>
            </article>
            <article class="doc-card">
              <h3>Player still raw link use kar raha hai</h3>
              <p>Frontend ya API response me raw CDN URL aa raha hoga. Player ko proxy URL hi dena padega.</p>
            </article>
          </div>
          <p class="small muted">Tip: agar homepage browser me old version dikh raha ho to hard refresh karo.</p>
        </section>
      </main>
    </body>
  </html>`;
}

export function createApp(options = {}) {
  const app = new Hono();
  const upstreamFetch = options.upstreamFetch || fetch;
  const runtimeName = options.runtimeName || "worker";

  app.use("*", async (c, next) => {
    const config = getRuntimeConfig(c.env, runtimeName);
    const origin = c.req.header("origin") || "";

    if (c.req.method === "OPTIONS") {
      const headers = new Headers();
      applyCorsHeaders(headers, origin, config.allowedOrigins);
      return new Response(null, { status: 204, headers });
    }

    if (!isOriginAllowed(origin, config.allowedOrigins)) {
      const headers = new Headers();
      applyCorsHeaders(headers, origin, config.allowedOrigins);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Origin "${origin}" is not allowed`,
        }),
        {
          status: 403,
          headers: {
            ...Object.fromEntries(headers.entries()),
            "Content-Type": "application/json",
          },
        }
      );
    }

    await next();
    applyCorsHeaders(c.res.headers, origin, config.allowedOrigins);
  });

  app.get("/", (c) => {
    const config = getRuntimeConfig(c.env, runtimeName);
    const providers = getProviderProfiles(config);
    const baseUrl = config.publicUrl || new URL(c.req.url).origin;
    return c.html(renderHomePage(config, providers, baseUrl));
  });

  app.get("/health", (c) => {
    const config = getRuntimeConfig(c.env, runtimeName);
    return c.json({
      success: true,
      runtime: config.runtimeName,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/providers", (c) => {
    const config = getRuntimeConfig(c.env, runtimeName);
    const providers = getProviderProfiles(config);
    return c.json({
      success: true,
      results: Object.values(providers).map((provider) => ({
        key: provider.key,
        label: provider.label,
        aliases: provider.aliases,
      })),
    });
  });

  const proxyHandler = async (c) => {
    const config = getRuntimeConfig(c.env, runtimeName);
    const providers = getProviderProfiles(config);
    const rawTargetUrl = c.req.query("url");

    if (!rawTargetUrl) {
      return c.json(
        {
          success: false,
          message: "Missing required query: url",
        },
        400
      );
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawTargetUrl);
    } catch {
      return c.json(
        {
          success: false,
          message: "Invalid target URL",
        },
        400
      );
    }

    const requestedProvider = c.req.param("provider") || c.req.query("provider") || "";
    const providerKey = resolveProviderKey(requestedProvider, targetUrl, providers);

    if (!providerKey) {
      return c.json(
        {
          success: false,
          message: "Unknown provider. Use animekai, animepahe, or hianime.",
        },
        400
      );
    }

    const profile = providers[providerKey];
    const baseUrl = config.publicUrl || new URL(c.req.url).origin;
    const rawHeadersParam = c.req.query("headers") || "";
    const referer = c.req.query("referer") || "";
    const origin = c.req.query("origin") || "";
    const mergedHeaders = {};

    if (rawHeadersParam) {
      try {
        Object.assign(mergedHeaders, JSON.parse(rawHeadersParam));
      } catch {
        try {
          Object.assign(mergedHeaders, JSON.parse(decodeURIComponent(rawHeadersParam)));
        } catch {
          return c.json(
            {
              success: false,
              message: "Invalid headers query. Expected JSON string.",
            },
            400
          );
        }
      }
    }

    if (referer) {
      mergedHeaders.referer = referer;
    }

    if (origin) {
      mergedHeaders.origin = origin;
    }

    const serializedHeaders =
      Object.keys(mergedHeaders).length > 0 ? JSON.stringify(mergedHeaders) : "";

    return proxyTarget({
      request: c.req,
      targetUrl,
      providerKey,
      profile,
      rawHeadersParam: serializedHeaders,
      config,
      baseUrl,
      upstreamFetch,
    });
  };

  app.get("/proxy/:provider", proxyHandler);
  app.get("/:provider/m3u8-proxy", proxyHandler);
  app.get("/:provider/ts-proxy", proxyHandler);
  app.get("/m3u8-proxy", proxyHandler);
  app.get("/ts-proxy", proxyHandler);

  app.onError((error, c) => {
    console.error("Anime Proxy Suite error:", error);
    return c.json(
      {
        success: false,
        message: error.message || "Internal server error",
      },
      500
    );
  });

  app.notFound((c) =>
    c.json(
      {
        success: false,
        message: "Route not found",
      },
      404
    )
  );

  return app;
}
