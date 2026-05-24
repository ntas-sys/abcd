// Media Stream Provider
// React Native / Hermes compatible

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
var KINOBD_API = "https://kinobd.net";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
  "Accept": "application/json,*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "Connection": "keep-alive"
};

// ==================== HTTP ====================
function makeRequest(url, options) {
  return __async(this, arguments, function* (url, options = {}) {
    var _a;
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
      console.error(`[Media] Request failed for ${url}: ${error.message}`);
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
    console.log(`[Media] Fetching TMDB info for ID: ${tmdbId}`);
    const response = yield makeRequest(url);
    const data = yield response.json();
    const title = mediaType === "tv" ? data.name : data.title;
    const year = mediaType === "tv" ? ((_a = data.first_air_date) == null ? void 0 : _a.substring(0, 4)) : ((_b = data.release_date) == null ? void 0 : _b.substring(0, 4));
    const imdbId = data.imdb_id || "";
    if (!title) {
      throw new Error("Could not extract title from TMDB response");
    }
    console.log(`[Media] TMDB Info: "${title}" (${year}), IMDB: ${imdbId}`);
    return { title, year, imdbId, data };
  });
}

// ==================== KinoBD ====================
function getKinoBdPlayers(imdbId, kinopoiskId) {
  return __async(this, null, function* () {
    console.log(`[Media] Fetching players for IMDB: ${imdbId}`);
    
    const params = new URLSearchParams();
    if (kinopoiskId) params.set("kinopoisk", kinopoiskId);
    if (imdbId) params.set("imdb", imdbId);
    params.set("language", "en");
    params.set("player", "collaps,voidboost,videocdn,alloha,ashdi,kodik,vibix,bazon,youtube,hdvb,iframe,pleer,ustore,cdnmovies,kholobok,kinotochka,ext,trailer,nf,torrent");

    const response = yield makeRequest(`${KINOBD_API}/playerdata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Re": "https://statichun.com/cinema"
      },
      body: params.toString()
    });

    const data = yield response.json();
    console.log(`[Media] Response keys: ${Object.keys(data).join(", ")}`);
    return data;
  });
}

// ==================== Collaps Parser ====================
function extractM3U8FromCollaps(htmlContent) {
  console.log(`[Media] Parsing HTML, length: ${htmlContent.length}`);

  const hlsMatch = htmlContent.match(/hls:\s*"([^"]+\.m3u8[^"]*)"/);
  if (hlsMatch && hlsMatch[1]) {
    console.log(`[Media] Found HLS URL`);
    return hlsMatch[1];
  }

  const m3u8Match = htmlContent.match(/https?:\/\/[^\s"<>]+\.m3u8[^\s"<>]*/);
  if (m3u8Match && m3u8Match[0]) {
    console.log(`[Media] Found HLS URL (generic)`);
    return m3u8Match[0];
  }

  const dashMatch = htmlContent.match(/dash:\s*"([^"]+\.mpd[^"]*)"/);
  if (dashMatch && dashMatch[1]) {
    console.log(`[Media] Found DASH URL`);
    return dashMatch[1];
  }

  console.log(`[Media] No stream URL found`);
  return null;
}

function getCollapsStream(collapsUrl) {
  return __async(this, null, function* () {
    console.log(`[Media] Fetching iframe: ${collapsUrl}`);
    try {
      const response = yield makeRequest(collapsUrl, {
        headers: {
          "Referer": "https://statichun.com/",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      });
      const html = yield response.text();
      const streamUrl = extractM3U8FromCollaps(html);
      if (streamUrl) {
        console.log(`[Media] Stream extracted: ${streamUrl.substring(0, 80)}...`);
      }
      return streamUrl;
    } catch (error) {
      console.error(`[Media] Fetch error: ${error.message}`);
      return null;
    }
  });
}

// ==================== Stream Builder ====================
function createStreamTitle(mediaInfo) {
  if (mediaInfo.mediaType === "tv" && mediaInfo.season && mediaInfo.episode) {
    return `${mediaInfo.title} S${String(mediaInfo.season).padStart(2, "0")}E${String(mediaInfo.episode).padStart(2, "0")}`;
  }
  return mediaInfo.year ? `${mediaInfo.title} (${mediaInfo.year})` : mediaInfo.title;
}

function processKinoBdResponse(kinoData, mediaInfo) {
  const streams = [];
  const streamTitle = createStreamTitle(mediaInfo);

  if (kinoData.collaps && kinoData.collaps.iframe) {
    console.log(`[Media] Found Collaps: ${kinoData.collaps.translate || "Unknown"}`);
    streams.push({
      _isCollaps: true,
      _collapsUrl: kinoData.collaps.iframe,
      name: `Media - Collaps`,
      title: streamTitle,
      quality: kinoData.collaps.quality || "Unknown",
      translate: kinoData.collaps.translate || "",
      provider: "statichun"
    });
  }

  console.log(`[Media] Extracted ${streams.length} players`);
  return streams;
}

// ==================== MAIN ====================
function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return __async(this, null, function* () {
    console.log(`[Media] Fetching streams for TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    try {
      const { title, year, imdbId } = yield getTmdbInfo(tmdbId, mediaType);

      if (!imdbId) {
        console.log("[Media] No IMDB ID found");
        return [];
      }

      const kinoData = yield getKinoBdPlayers(imdbId, null);

      const mediaInfo = {
        title,
        year,
        mediaType,
        season: seasonNum,
        episode: episodeNum
      };

      const streams = processKinoBdResponse(kinoData, mediaInfo);

      if (streams.length === 0) {
        console.log("[Media] No players found");
        return [];
      }

      const collapsStreams = streams.filter(s => s._isCollaps);
      const resolvedStreams = [];

      for (const cs of collapsStreams) {
          const m3u8Url = yield getCollapsStream(cs._collapsUrl);
          if (m3u8Url) {
            resolvedStreams.push({
              name: cs.name + (cs.quality && cs.quality !== "Unknown" ? ` (${cs.quality})` : ""),
              title: cs.title + (cs.translate ? ` - ${cs.translate}` : ""),
              url: m3u8Url,
              headers: {
                "Referer": "https://statichun.com/",
                "Origin": "https://statichun.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
              },  // ← BU VIRGÜL EKSIKTI
              quality: cs.quality || "Unknown",
              provider: "statichun",
              behaviorHints: {
                notWebReady: false,
                bingeGroup: "statichun"
              }
            });
          }
        }

      console.log(`[Media] Returning ${resolvedStreams.length} streams`);
      return resolvedStreams;

    } catch (error) {
      console.error(`[Media] Error in getStreams: ${error.message}`);
      return [];
    }
  });
}

module.exports = { getStreams };
