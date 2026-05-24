// Nuvio Plugin - o1.kkkppp.live / Kinobox Aggregator
// React Native / Hermes compatible
// Flow: TMDB ID -> IMDB ID -> Kinobox API -> Players -> Stream extraction

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ==================== CONFIG ====================
var TMDB_API_KEY = "52a8278a45b783b48b3cb730c17433b0";
var KINOBOX_API = "https://a.ddbb.live/api/players";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  "Accept": "application/json,*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection": "keep-alive"
};

// Player-specific referers
var PLAYER_REFERERS = {
  "Collaps": "https://o1.kkkppp.live/",
  "Alloha": "https://o1.kkkppp.live/",
  "Turbo": "https://o1.kkkppp.live/",
  "Veoveo": "https://o1.kkkppp.live/",
  "Vibix": "https://o1.kkkppp.live/"
};

// ==================== HTTP ====================
function makeRequest(url, options) {
  return __async(this, arguments, function* (url, options = {}) {
    const headers = __spreadValues(__spreadValues({}, DEFAULT_HEADERS), options.headers || {});
    try {
      const response = yield fetch(url, __spreadValues({
        method: options.method || "GET",
        headers: headers
      }, options));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      console.error(`[Kinobox] Request failed for ${url}: ${error.message}`);
      throw error;
    }
  });
}

// ==================== TMDB ====================
function getTmdbInfo(tmdbId, mediaType) {
  return __async(this, null, function* () {
    var _a, _b;
    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    console.log(`[Kinobox] Fetching TMDB info for ID: ${tmdbId}`);
    const response = yield makeRequest(url);
    const data = yield response.json();
    const title = mediaType === "tv" ? data.name : data.title;
    const year = mediaType === "tv" ? ((_a = data.first_air_date) == null ? void 0 : _a.substring(0, 4)) : ((_b = data.release_date) == null ? void 0 : _b.substring(0, 4));
    const imdbId = data.imdb_id || "";
    if (!title) {
      throw new Error("Could not extract title from TMDB response");
    }
    console.log(`[Kinobox] TMDB Info: "${title}" (${year}), IMDB: ${imdbId}`);
    return { title, year, imdbId, data };
  });
}

// ==================== Stream Extractors ====================
function extractStreamFromHtml(htmlContent) {
  // Try hls: "..." pattern (Collaps style)
  const hlsMatch = htmlContent.match(/hls:\s*"([^"]+\.m3u8[^"]*)"/);
  if (hlsMatch && hlsMatch[1]) {
    return { url: hlsMatch[1], type: "hls" };
  }

  // Try file: "..." pattern
  const fileMatch = htmlContent.match(/file:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"/);
  if (fileMatch && fileMatch[1]) {
    return { url: fileMatch[1], type: fileMatch[1].includes(".m3u8") ? "hls" : "mp4" };
  }

  // Generic m3u8 URL
  const m3u8Match = htmlContent.match(/https?:\/\/[^\s"<>]+\.m3u8[^\s"<>]*/);
  if (m3u8Match && m3u8Match[0]) {
    return { url: m3u8Match[0], type: "hls" };
  }

  // Generic mp4 URL
  const mp4Match = htmlContent.match(/https?:\/\/[^\s"<>]+\.mp4[^\s"<>]*/);
  if (mp4Match && mp4Match[0]) {
    return { url: mp4Match[0], type: "mp4" };
  }

  // dash/mpd
  const dashMatch = htmlContent.match(/dash:\s*"([^"]+\.mpd[^"]*)"/);
  if (dashMatch && dashMatch[1]) {
    return { url: dashMatch[1], type: "dash" };
  }

  // Try src="..." on video tag
  const videoSrcMatch = htmlContent.match(/<video[^>]+src="([^"]+)"/);
  if (videoSrcMatch && videoSrcMatch[1]) {
    return { url: videoSrcMatch[1], type: videoSrcMatch[1].includes(".m3u8") ? "hls" : "mp4" };
  }

  return null;
}

// Extract from Alloha player
function extractAllohaStream(htmlContent) {
  const srcMatch = htmlContent.match(/"src":\s*"([^"]+)"/);
  if (srcMatch) {
    return { url: srcMatch[1], type: "hls" };
  }

  const fileMatch = htmlContent.match(/file["\']?\s*[:=]\s*["\']([^"\']+)["\']/);
  if (fileMatch) {
    return { url: fileMatch[1], type: "hls" };
  }

  return extractStreamFromHtml(htmlContent);
}

// ==================== Player Fetchers ====================
function fetchPlayerStream(playerType, iframeUrl) {
  return __async(this, null, function* () {
    console.log(`[Kinobox] Fetching ${playerType}: ${iframeUrl}`);

    const referer = PLAYER_REFERERS[playerType] || iframeUrl;

    try {
      const response = yield makeRequest(iframeUrl, {
        headers: {
          "Referer": referer,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      const html = yield response.text();

      let streamInfo = null;

      switch (playerType) {
        case "Alloha":
          streamInfo = extractAllohaStream(html);
          break;
        default:
          streamInfo = extractStreamFromHtml(html);
      }

      if (streamInfo) {
        console.log(`[Kinobox] Found ${streamInfo.type} stream for ${playerType}`);
      } else {
        console.log(`[Kinobox] No stream found for ${playerType}`);
      }

      return streamInfo;
    } catch (error) {
      console.error(`[Kinobox] Error fetching ${playerType}: ${error.message}`);
      return null;
    }
  });
}

// ==================== Kinobox API ====================
function getKinoboxPlayers(imdbId) {
  return __async(this, null, function* () {
    console.log(`[Kinobox] Fetching players for IMDB ID: ${imdbId}`);

    const url = `${KINOBOX_API}?imdb=${imdbId}`;
    const response = yield makeRequest(url);
    const data = yield response.json();

    if (data.error) {
      throw new Error(data.error.title || "API Error");
    }

    if (!data.data || data.data.length === 0) {
      console.log("[Kinobox] No players found");
      return [];
    }

    // Filter out players with no iframeUrl
    const validPlayers = data.data.filter(p => p.iframeUrl || (p.translations && p.translations.some(t => t.iframeUrl)));

    console.log(`[Kinobox] Found ${validPlayers.length} valid players: ${validPlayers.map(p => p.type).join(", ")}`);
    return validPlayers;
  });
}

// ==================== Stream Builder ====================
function createStreamTitle(mediaInfo) {
  if (mediaInfo.mediaType === "tv" && mediaInfo.season && mediaInfo.episode) {
    return `${mediaInfo.title} S${String(mediaInfo.season).padStart(2, "0")}E${String(mediaInfo.episode).padStart(2, "0")}`;
  }
  return mediaInfo.year ? `${mediaInfo.title} (${mediaInfo.year})` : mediaInfo.title;
}

function buildStreamObject(player, translation, streamInfo, mediaInfo) {
  const playerType = player.type;
  const streamTitle = createStreamTitle(mediaInfo);

  const transName = translation.name || "Unknown";
  const quality = translation.quality || player.quality || "Auto";

  const referer = PLAYER_REFERERS[playerType] || streamInfo.url;
  const origin = referer.replace(/\/$/, "");

  return {
    name: `Kinobox - ${playerType}`,
    title: `${streamTitle} - ${transName} (${quality})`,
    url: streamInfo.url,
    quality: quality,
    translate: transName,
    provider: "kinobox",
    headers: {
      "Referer": referer,
      "Origin": origin,
      "User-Agent": DEFAULT_HEADERS["User-Agent"]
    },
    behaviorHints: {
      notWebReady: false,
      bingeGroup: `kinobox_${playerType.toLowerCase()}`
    }
  };
}

// ==================== MAIN ====================
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    console.log(`[Kinobox] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    try {
      // Step 1: Get IMDB ID from TMDB
      const { title, year, imdbId } = yield getTmdbInfo(tmdbId, mediaType);

      if (!imdbId) {
        console.log("[Kinobox] No IMDB ID found");
        return [];
      }

      // Step 2: Get players from Kinobox API using IMDB ID
      const players = yield getKinoboxPlayers(imdbId);

      if (players.length === 0) {
        return [];
      }

      const mediaInfo = {
        title,
        year,
        mediaType,
        season: seasonNum,
        episode: episodeNum
      };

      const resolvedStreams = [];

      // Step 3: Process each player
      for (const player of players) {
        const translations = player.translations || [{ name: null, quality: null, iframeUrl: player.iframeUrl }];

        for (const translation of translations) {
          const iframeUrl = translation.iframeUrl || player.iframeUrl;
          if (!iframeUrl) continue;

          const streamInfo = yield fetchPlayerStream(player.type, iframeUrl);

          if (streamInfo && streamInfo.url) {
            const streamObj = buildStreamObject(player, translation, streamInfo, mediaInfo);
            resolvedStreams.push(streamObj);
          }
        }
      }

      console.log(`[Kinobox] Returning ${resolvedStreams.length} streams`);
      return resolvedStreams;

    } catch (error) {
      console.error(`[Kinobox] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
