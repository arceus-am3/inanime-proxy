import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let cloudscraper = null;

try {
  cloudscraper = require("cloudscraper");
} catch {
  cloudscraper = null;
}

function toHeaderObject(headers) {
  const normalized = {};
  const source = headers instanceof Headers ? headers : new Headers(headers);

  source.forEach((value, key) => {
    normalized[key] = value;
  });

  return normalized;
}

function toResponseHeaders(sourceHeaders = {}) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(sourceHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }

    if (value !== undefined && value !== null) {
      headers.set(key, String(value));
    }
  }

  return headers;
}

export async function nodeUpstreamFetch(url, init = {}, options = {}) {
  const timeout = options.timeout ?? 20000;
  const method = (init.method || "GET").toUpperCase();
  const shouldUseCloudscraper =
    options.enableCloudscraper !== false && cloudscraper && method === "GET";

  if (!shouldUseCloudscraper) {
    return fetch(url, init);
  }

  try {
    const response = await cloudscraper({
      method,
      url,
      headers: toHeaderObject(init.headers),
      encoding: null,
      resolveWithFullResponse: true,
      simple: false,
      followAllRedirects: true,
      timeout,
    });

    return new Response(response.body, {
      status: response.statusCode || 200,
      headers: toResponseHeaders(response.headers),
    });
  } catch (error) {
    if (error?.response) {
      return new Response(error.response.body, {
        status: error.response.statusCode || 502,
        headers: toResponseHeaders(error.response.headers),
      });
    }

    return fetch(url, init);
  }
}
