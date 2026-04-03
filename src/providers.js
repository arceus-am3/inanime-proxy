function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function includesHost(hostname, needles) {
  const lowered = hostname.toLowerCase();
  return needles.some((needle) => lowered.includes(needle));
}

function buildOrigin(urlString) {
  try {
    return new URL(urlString).origin;
  } catch {
    return urlString;
  }
}

function animeKaiHeaders(targetUrl, currentReferer, config) {
  let referer = currentReferer || config.animekaiBase;

  if (includesHost(targetUrl.hostname, ["megaup", "shop21pro"])) {
    referer = config.animekaiBase;
  }

  referer = ensureTrailingSlash(referer);

  return {
    referer,
    origin: buildOrigin(referer),
    fetchDest: includesHost(targetUrl.hostname, ["megaup", "shop21pro"]) ? "iframe" : "empty",
    fetchMode: includesHost(targetUrl.hostname, ["megaup", "shop21pro"]) ? "navigate" : "cors",
    fetchSite: "cross-site",
  };
}

function animePaheHeaders(targetUrl, currentReferer, config) {
  let referer = currentReferer || config.animepaheDefaultReferer;

  if (includesHost(targetUrl.hostname, ["kwik", "kwics"])) {
    referer = config.animepaheBase;
  } else if (includesHost(targetUrl.hostname, ["owocdn", "cdn"])) {
    if (!String(referer).includes("kwik.cx")) {
      referer = config.animepaheDefaultReferer;
    }
  }

  if (String(referer).includes("kwik.cx")) {
    referer = ensureTrailingSlash(referer);
  } else {
    referer = ensureTrailingSlash(referer);
  }

  return {
    referer,
    origin: buildOrigin(referer),
    fetchDest: includesHost(targetUrl.hostname, ["owocdn"]) ? "iframe" : "empty",
    fetchMode: includesHost(targetUrl.hostname, ["owocdn"]) ? "navigate" : "cors",
    fetchSite: "cross-site",
  };
}

function hiAnimeHeaders(targetUrl, currentReferer, config) {
  let referer = currentReferer || config.hianimeDefaultReferer;
  let origin = config.hianimeDefaultOrigin || buildOrigin(referer);

  if (includesHost(targetUrl.hostname, ["watching.onl"])) {
    referer = config.hianimeWatchingReferer || config.hianimeDefaultReferer;
    origin = config.hianimeWatchingOrigin || buildOrigin(referer);
  }

  if (
    includesHost(targetUrl.hostname, [
      "dotstream",
      "lostproject",
      "megaplay",
      "megacloud",
      "megaf",
      "rapid-cloud",
      "streamwish",
      "vidstream",
      "mcloud",
      "megaup",
    ])
  ) {
    referer = config.hianimeDefaultReferer;
    origin = config.hianimeDefaultOrigin || buildOrigin(referer);
  }

  referer = ensureTrailingSlash(referer);

  return {
    referer,
    origin,
    fetchDest: "empty",
    fetchMode: "cors",
    fetchSite: "cross-site",
  };
}

export function getProviderProfiles(config) {
  return {
    animekai: {
      key: "animekai",
      label: "AnimeKai",
      aliases: ["kai"],
      detectHosts: ["anikai", "megaup", "shop21pro"],
      buildHeaders: (targetUrl, currentReferer) =>
        animeKaiHeaders(targetUrl, currentReferer, config),
    },
    animepahe: {
      key: "animepahe",
      label: "AnimePahe",
      aliases: ["pahe"],
      detectHosts: ["animepahe", "kwik", "kwics", "owocdn"],
      buildHeaders: (targetUrl, currentReferer) =>
        animePaheHeaders(targetUrl, currentReferer, config),
    },
    hianime: {
      key: "hianime",
      label: "HiAnime",
      aliases: ["aniwatch", "zoro"],
      detectHosts: [
        "hianime",
        "aniwatch",
        "dotstream",
        "lostproject",
        "watching.onl",
        "vidwish",
        "megaplay",
        "megacloud",
        "megaf",
        "rapid-cloud",
        "vidstream",
        "streamwish",
      ],
      buildHeaders: (targetUrl, currentReferer) =>
        hiAnimeHeaders(targetUrl, currentReferer, config),
    },
  };
}

export function resolveProviderKey(providerInput, targetUrl, profiles) {
  if (providerInput) {
    const normalized = providerInput.toLowerCase();
    for (const profile of Object.values(profiles)) {
      if (profile.key === normalized || profile.aliases.includes(normalized)) {
        return profile.key;
      }
    }
  }

  if (targetUrl) {
    const hostname = targetUrl.hostname.toLowerCase();
    for (const profile of Object.values(profiles)) {
      if (profile.detectHosts.some((needle) => hostname.includes(needle))) {
        return profile.key;
      }
    }
  }

  return null;
}
