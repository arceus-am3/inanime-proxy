const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function getRawEnv(bindings, key) {
  if (bindings && Object.prototype.hasOwnProperty.call(bindings, key)) {
    return bindings[key];
  }

  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }

  return undefined;
}

function parseCsv(value, fallback = []) {
  if (!value) {
    return fallback;
  }

  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeBaseUrl(value, fallback) {
  const resolved = value || fallback;
  return resolved.endsWith("/") ? resolved : `${resolved}/`;
}

function buildOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

export function getRuntimeConfig(bindings = {}, runtimeName = "worker") {
  const publicUrl = getRawEnv(bindings, "PUBLIC_URL") || "";
  const allowedOrigins = parseCsv(getRawEnv(bindings, "ALLOWED_ORIGINS"), ["*"]);
  const requestTimeoutMs =
    Number.parseInt(getRawEnv(bindings, "REQUEST_TIMEOUT_MS") ?? "20000", 10) || 20000;
  const hianimeDefaultReferer = normalizeBaseUrl(
    getRawEnv(bindings, "HIANIME_DEFAULT_REFERER"),
    "https://megaplay.buzz/"
  );
  const hianimeWatchingReferer = normalizeBaseUrl(
    getRawEnv(bindings, "HIANIME_WATCHING_REFERER"),
    "https://vidwish.live/"
  );

  return {
    runtimeName,
    publicUrl,
    allowedOrigins,
    requestTimeoutMs,
    enableCloudscraper: parseBoolean(getRawEnv(bindings, "ENABLE_CLOUDSCRAPER"), true),
    defaultUserAgent: getRawEnv(bindings, "DEFAULT_USER_AGENT") || DEFAULT_USER_AGENT,
    animekaiBase: normalizeBaseUrl(
      getRawEnv(bindings, "ANIMEKAI_BASE"),
      "https://anikai.to/"
    ),
    animepaheBase: normalizeBaseUrl(
      getRawEnv(bindings, "ANIMEPAHE_BASE"),
      "https://animepahe.si/"
    ),
    animepaheDefaultReferer: normalizeBaseUrl(
      getRawEnv(bindings, "ANIMEPAHE_DEFAULT_REFERER"),
      "https://kwik.cx/"
    ),
    hianimeDefaultReferer,
    hianimeDefaultOrigin:
      getRawEnv(bindings, "HIANIME_DEFAULT_ORIGIN") || buildOrigin(hianimeDefaultReferer),
    hianimeWatchingReferer,
    hianimeWatchingOrigin:
      getRawEnv(bindings, "HIANIME_WATCHING_ORIGIN") || buildOrigin(hianimeWatchingReferer),
  };
}
