const FORWARD_HEADERS = [
  "range",
  "if-match",
  "if-none-match",
  "if-modified-since",
  "if-unmodified-since",
  "authorization",
  "cookie",
];

const PASS_THROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-range",
  "accept-ranges",
  "last-modified",
  "etag",
  "content-disposition",
  "cache-control",
];

const cookieJar = new Map();

function readHeader(requestLike, headerName) {
  const normalizedName = headerName.toLowerCase();
  const rawHeaders = requestLike?.raw?.headers ?? requestLike?.headers;

  if (rawHeaders && typeof rawHeaders.get === "function") {
    return rawHeaders.get(headerName) || rawHeaders.get(normalizedName) || "";
  }

  if (Array.isArray(rawHeaders)) {
    for (let index = 0; index < rawHeaders.length - 1; index += 2) {
      if (String(rawHeaders[index]).toLowerCase() === normalizedName) {
        return String(rawHeaders[index + 1] ?? "");
      }
    }
  }

  if (rawHeaders && typeof rawHeaders === "object") {
    const value = rawHeaders[normalizedName] ?? rawHeaders[headerName];
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }

  return "";
}

function appendNoCacheHeaders(headers) {
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Proxy-By", "anime-proxy-suite");
  headers.set("X-Content-Type-Options", "nosniff");
}

export function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }

  if (!allowedOrigins.length || allowedOrigins.includes("*")) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

export function applyCorsHeaders(headers, origin, allowedOrigins) {
  const allowOrigin =
    !origin || !allowedOrigins.length || allowedOrigins.includes("*")
      ? "*"
      : allowedOrigins.includes(origin)
        ? origin
        : "";

  if (allowOrigin) {
    headers.set("Access-Control-Allow-Origin", allowOrigin);
  }

  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Requested-With, Range, Authorization, Cookie"
  );
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Range, Content-Length, Accept-Ranges, Content-Type"
  );
  headers.set("Access-Control-Allow-Credentials", "true");
  appendNoCacheHeaders(headers);
}

export function parseHeadersParam(rawHeadersParam) {
  if (!rawHeadersParam) {
    return {};
  }

  try {
    return JSON.parse(rawHeadersParam);
  } catch {
    try {
      return JSON.parse(decodeURIComponent(rawHeadersParam));
    } catch {
      throw new Error("Invalid headers query. Expected JSON string.");
    }
  }
}

function serializeHeadersParam(rawHeadersParam, upstreamHeaders) {
  if (rawHeadersParam) {
    return rawHeadersParam;
  }

  const childHeaders = {};
  const referer = upstreamHeaders.get("referer");
  const origin = upstreamHeaders.get("origin");

  if (referer) {
    childHeaders.referer = referer;
  }

  if (origin) {
    childHeaders.origin = origin;
  }

  return Object.keys(childHeaders).length ? JSON.stringify(childHeaders) : "";
}

function mergeCookieJar(targetUrl, upstreamResponse) {
  const setCookie = upstreamResponse.headers.get("set-cookie");
  if (!setCookie) {
    return;
  }

  const existing = cookieJar.get(targetUrl.hostname) || "";
  const merged = [...new Set([...existing.split("; "), ...setCookie.split(", ").map((item) => item.split(";")[0])])]
    .filter(Boolean)
    .join("; ");

  cookieJar.set(targetUrl.hostname, merged);
}

function createProxyUrl(baseUrl, providerKey, targetUrl, headersParam) {
  const proxyUrl = new URL(`/proxy/${providerKey}`, baseUrl);
  proxyUrl.searchParams.set("url", targetUrl);

  if (headersParam) {
    proxyUrl.searchParams.set("headers", headersParam);
  }

  return proxyUrl.toString();
}

function rewriteTagUris(line, absoluteTargetUrl, baseUrl, providerKey, headersParam) {
  return line.replace(/(URI\s*=\s*)(["'])([^"']+)(\2)/gi, (match, prefix, quote, rawUri) => {
    try {
      const resolved = new URL(rawUri, absoluteTargetUrl).href;
      return `${prefix}${quote}${createProxyUrl(baseUrl, providerKey, resolved, headersParam)}${quote}`;
    } catch {
      return match;
    }
  });
}

function rewritePlaylist(content, absoluteTargetUrl, baseUrl, providerKey, headersParam) {
  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return line;
      }

      if (trimmed.startsWith("#")) {
        return rewriteTagUris(line, absoluteTargetUrl, baseUrl, providerKey, headersParam);
      }

      try {
        const resolved = new URL(trimmed, absoluteTargetUrl).href;
        return createProxyUrl(baseUrl, providerKey, resolved, headersParam);
      } catch {
        return line;
      }
    })
    .join("\n");
}

function isPlaylistRequest(targetUrl, contentType) {
  const pathname = targetUrl.pathname.toLowerCase();
  const type = (contentType || "").toLowerCase();

  return (
    pathname.endsWith(".m3u8") ||
    type.includes("application/vnd.apple.mpegurl") ||
    type.includes("application/x-mpegurl") ||
    type.includes("mpegurl")
  );
}

function guessSegmentType(targetUrl, upstreamType) {
  if (upstreamType) {
    return upstreamType;
  }

  const pathname = targetUrl.pathname.toLowerCase();
  if (pathname.endsWith(".m4s")) {
    return "video/iso.segment";
  }
  if (pathname.endsWith(".mp4")) {
    return "video/mp4";
  }
  if (pathname.endsWith(".aac")) {
    return "audio/aac";
  }
  return "video/mp2t";
}

function buildUpstreamHeaders(request, targetUrl, additionalHeaders, profile, config) {
  const headers = new Headers({
    "User-Agent": config.defaultUserAgent,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  });

  for (const headerName of FORWARD_HEADERS) {
    const value = readHeader(request, headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  let customReferer = "";
  for (const [key, value] of Object.entries(additionalHeaders)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    headers.set(normalizedKey, String(value));

    if (normalizedKey === "referer" || normalizedKey === "referrer") {
      customReferer = String(value);
    }
  }

  const providerHeaders = profile.buildHeaders(targetUrl, customReferer);

  if (providerHeaders.referer) {
    headers.set("referer", providerHeaders.referer);
  }
  if (providerHeaders.origin) {
    headers.set("origin", providerHeaders.origin);
  }
  if (providerHeaders.fetchDest) {
    headers.set("sec-fetch-dest", providerHeaders.fetchDest);
  }
  if (providerHeaders.fetchMode) {
    headers.set("sec-fetch-mode", providerHeaders.fetchMode);
  }
  if (providerHeaders.fetchSite) {
    headers.set("sec-fetch-site", providerHeaders.fetchSite);
  }

  const storedCookies = cookieJar.get(targetUrl.hostname);
  if (storedCookies) {
    const existingCookie = headers.get("cookie");
    headers.set("cookie", existingCookie ? `${existingCookie}; ${storedCookies}` : storedCookies);
  }

  return headers;
}

function jsonError(message, status = 500, details = null) {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      details,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

export async function proxyTarget({
  request,
  targetUrl,
  providerKey,
  profile,
  rawHeadersParam,
  config,
  baseUrl,
  upstreamFetch,
}) {
  const additionalHeaders = parseHeadersParam(rawHeadersParam);
  const upstreamHeaders = buildUpstreamHeaders(request, targetUrl, additionalHeaders, profile, config);
  let upstreamResponse;

  try {
    upstreamResponse = await upstreamFetch(
      targetUrl.href,
      {
        method: "GET",
        headers: upstreamHeaders,
        redirect: "follow",
      },
      {
        timeout: config.requestTimeoutMs,
        enableCloudscraper: config.enableCloudscraper,
      }
    );
  } catch (error) {
    return jsonError("Failed to reach upstream", 502, {
      provider: providerKey,
      target: targetUrl.href,
      error: error.message,
    });
  }

  mergeCookieJar(targetUrl, upstreamResponse);

  if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
    const body = await upstreamResponse.text().catch(() => "");
    return jsonError("Upstream request failed", upstreamResponse.status, {
      provider: providerKey,
      target: targetUrl.href,
      upstreamStatus: upstreamResponse.status,
      body: body.slice(0, 500),
    });
  }

  const responseHeaders = new Headers();
  const upstreamType = upstreamResponse.headers.get("content-type") || "";

  if (isPlaylistRequest(targetUrl, upstreamType)) {
    const playlistBody = await upstreamResponse.text();
    const isActualPlaylist = playlistBody.trimStart().startsWith("#EXTM3U");

    if (!isActualPlaylist) {
      responseHeaders.set("Content-Type", upstreamType || "text/plain; charset=utf-8");
      return new Response(playlistBody, {
        status: upstreamResponse.status,
        headers: responseHeaders,
      });
    }

    const childHeadersParam = serializeHeadersParam(rawHeadersParam, upstreamHeaders);
    const proxiedPlaylist = rewritePlaylist(
      playlistBody,
      targetUrl,
      baseUrl,
      providerKey,
      childHeadersParam
    );

    responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");

    return new Response(proxiedPlaylist, {
      status: 200,
      headers: responseHeaders,
    });
  }

  for (const headerName of PASS_THROUGH_HEADERS) {
    const value = upstreamResponse.headers.get(headerName);
    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  responseHeaders.set(
    "Content-Type",
    guessSegmentType(targetUrl, responseHeaders.get("content-type"))
  );

  ["server", "via", "x-cache", "x-amz-cf-id", "x-amz-cf-pop"].forEach((headerName) => {
    responseHeaders.delete(headerName);
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}
