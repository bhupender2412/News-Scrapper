import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import Parser from "rss-parser";
import pkg from "google-news-url-decoder";
import {
  classifyArticle,
  getTopicSearchQuery,
  isNoiseArticle,
} from "../utils/topicFilter.js";
import {
  extractLocation,
  isCityInState,
} from "../utils/locationExtractor.js";
import {
  loadArchivedArticles,
  saveArticlesToArchive,
} from "../utils/newsArchive.js";

const { GoogleDecoder } = pkg;
const decoder = new GoogleDecoder();
const parser = new Parser();

const sourcesPath = new URL("../data/newsSources.json", import.meta.url);
export const NEWS_SOURCES = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));

const locationsPath = new URL("../data/indiaLocations.json", import.meta.url);
const INDIA_LOCATIONS = JSON.parse(fs.readFileSync(locationsPath, "utf-8"));

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
};

const INDIA_REGIONS = [
  {
    name: "North",
    query:
      '(Punjab OR Haryana OR "Himachal Pradesh" OR Delhi OR "Uttar Pradesh" OR Uttarakhand)',
  },
  {
    name: "West",
    query: "(Maharashtra OR Gujarat OR Rajasthan OR Goa)",
  },
  {
    name: "South",
    query:
      '(Karnataka OR "Tamil Nadu" OR Kerala OR "Andhra Pradesh" OR Telangana)',
  },
  {
    name: "East",
    query: '("West Bengal" OR Bihar OR Jharkhand OR Odisha)',
  },
  {
    name: "Central",
    query: '("Madhya Pradesh" OR Chhattisgarh)',
  },
  {
    name: "North-East",
    query:
      "(Assam OR Manipur OR Meghalaya OR Tripura OR Nagaland OR Mizoram OR Sikkim)",
  },
];

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      try {
        results[current] = await worker(items[current], current);
      } catch {
        results[current] = null;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

function parsePublishDateTime(pubDateStr) {
  const parsed = pubDateStr ? new Date(pubDateStr) : new Date();
  const validDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    publishedAt: validDate.toISOString(),
    date: dateFormatter.format(validDate),
    time: `${timeFormatter.format(validDate).toUpperCase()} IST`,
  };
}

function todayStr() {
  return parsePublishDateTime(new Date()).date;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

function chunkArray(arr = [], size = 4) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeFeedEntry(feedEntry) {
  if (typeof feedEntry === "string") {
    return { url: feedEntry, states: [] };
  }
  return {
    url: feedEntry?.url || "",
    states: Array.isArray(feedEntry?.states) ? feedEntry.states : [],
  };
}

function selectDirectFeedsForSources(targetSources, state = "", includeAllRegional = false) {
  const selected = [];

  for (const source of targetSources) {
    if (!Array.isArray(source.rssFeeds)) continue;

    for (const rawFeed of source.rssFeeds) {
      const feed = normalizeFeedEntry(rawFeed);
      if (!feed.url) continue;

      if (state && state !== "National") {
        if (feed.states.length === 0 || feed.states.includes(state)) {
          selected.push({
            url: feed.url,
            sourceName: source.name,
            feedStates: feed.states,
          });
        }
      } else if (includeAllRegional || feed.states.length === 0) {
        selected.push({
          url: feed.url,
          sourceName: source.name,
          feedStates: feed.states,
        });
      }
    }
  }

  return selected;
}

function buildGoogleNewsUrl({
  domain = "",
  topic = "all",
  fromDate = "",
  toDate = "",
  state = "",
  city = "",
  keyword = "",
  locationClause = "",
}) {
  const queryParts = [];

  if (domain) queryParts.push(`site:${domain}`);

  if (keyword && keyword.trim()) {
    queryParts.push(keyword.trim());
  } else {
    queryParts.push(getTopicSearchQuery(topic));
  }

  if (locationClause) {
    queryParts.push(locationClause);
  } else if (city && city.trim()) {
    if (state && state.trim() && state !== "National" && city.toLowerCase() !== state.toLowerCase()) {
      queryParts.push(`"${city.trim()}" "${state.trim()}"`);
    } else {
      queryParts.push(`"${city.trim()}"`);
    }
  } else if (state && state.trim() && state !== "National") {
    queryParts.push(`"${state.trim()}"`);
  }

  const today = todayStr();

  if (fromDate === today && (!toDate || toDate === today)) {
    queryParts.push("when:2d");
  } else if (fromDate || toDate) {
    if (fromDate) queryParts.push(`after:${addDays(fromDate, -1)}`);
    if (toDate) queryParts.push(`before:${addDays(toDate, 1)}`);
  } else if (!keyword || !keyword.trim()) {
    queryParts.push("when:30d");
  }

  const encodedQuery = encodeURIComponent(queryParts.join(" "));
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
}

// Strictly verifies that an article belongs to the requested Indian state
function matchesRequestedState(headline, content, targetState) {
  if (!targetState || targetState === "National") return true;
  const resolved = extractLocation(headline, content, targetState);
  return resolved.state.toLowerCase() === targetState.toLowerCase();
}

function cleanHtmlText(raw = "") {
  if (!raw) return "";
  const decoded = cheerio.load(`<div>${raw}</div>`)("div").text();
  const withSpaces = decoded.replace(/<\/(p|div|br|li)>/gi, " ");
  const stripped = cheerio.load(`<div>${withSpaces}</div>`)("div").text();
  return stripped.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonLdBody($) {
  let bodyText = "";

  $('script[type="application/ld+json"]').each((_, el) => {
    if (bodyText.length >= 250) return;
    try {
      const raw = $(el).html();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];

      for (const node of nodes) {
        if (
          node &&
          typeof node.articleBody === "string" &&
          node.articleBody.trim().length > 150
        ) {
          bodyText = cleanHtmlText(node.articleBody);
          break;
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  return bodyText;
}

async function fetchViaReaderFallback(realUrl) {
  try {
    const { data: text } = await axios.get(`https://r.jina.ai/${realUrl}`, {
      headers: { Accept: "text/plain" },
      timeout: 4500,
    });

    if (typeof text !== "string") return "";

    const lines = text
      .split(/\n+/)
      .map((line) =>
        line
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/[*_`>#]/g, "")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter(
        (line) =>
          line.length >= 80 &&
          !/^(Title:|URL Source:|Published Time:|Markdown Content:|Image |Read Also|Also Read|Subscribe|Copyright)/i.test(
            line
          )
      );

    return lines.slice(0, 5).join("\n\n");
  } catch {
    return "";
  }
}

async function fetchArticleBody(realUrl, timeoutMs = 4000) {
  try {
    const { data: html } = await axios.get(realUrl, {
      headers: BROWSER_HEADERS,
      timeout: timeoutMs,
      maxRedirects: 4,
    });

    if (typeof html === "string") {
      const $ = cheerio.load(html);

      const jsonLdBody = extractJsonLdBody($);
      if (jsonLdBody.length >= 250) return jsonLdBody;

      $(
        "script, style, noscript, iframe, header, footer, nav, aside, .ad, .advertisement, .related-news, .also-read, .comments"
      ).remove();

      const paragraphs = [];
      $("article p, .story-desc p, .article-body p, .content p, main p, p").each(
        (_, el) => {
          const text = $(el).text().replace(/\s+/g, " ").trim();
          if (
            text.length >= 60 &&
            !/^(read also|also read|subscribe|follow us|copyright|all rights reserved|sign up|download)/i.test(
              text
            )
          ) {
            paragraphs.push(text);
          }
        }
      );

      const joined = [...new Set(paragraphs)].slice(0, 6).join("\n\n");
      if (joined.length >= 250) return joined;
    }
  } catch {
    // Fall through to reader fallback
  }

  return await fetchViaReaderFallback(realUrl);
}

async function fetchDirectRssFeed(feedObj, options) {
  const {
    fromDate = "",
    toDate = "",
    state = "",
    city = "",
    keyword = "",
    limitPerFeed = 25,
  } = options;
  const candidates = [];

  try {
    const { data: xml } = await axios.get(feedObj.url, {
      headers: BROWSER_HEADERS,
      timeout: 5000,
    });

    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, limitPerFeed);

    for (const item of items) {
      if (!item.link) continue;

      const headline = (item.title || "").trim();
      const snippet = cleanHtmlText(item.contentSnippet || item.summary || "");
      const dt = parsePublishDateTime(item.pubDate);

      if (fromDate && dt.date < fromDate) continue;
      if (toDate && dt.date > toDate) continue;
      if (isNoiseArticle(headline, keyword)) continue;

      const feedLockedToTargetState =
        state &&
        Array.isArray(feedObj.feedStates) &&
        feedObj.feedStates.length === 1 &&
        feedObj.feedStates[0] === state;

      if (
        state &&
        state !== "National" &&
        !feedLockedToTargetState &&
        !matchesRequestedState(headline, snippet, state)
      ) {
        continue;
      }

      if (
        city &&
        city !== "State-Wide" &&
        !`${headline} ${snippet}`.toLowerCase().includes(city.toLowerCase())
      ) {
        continue;
      }

      candidates.push({
        headline,
        source: feedObj.sourceName,
        date: dt.date,
        time: dt.time,
        publishedAt: dt.publishedAt,
        rawUrl: item.link,
        isGoogleLink: false,
        fromTargetedSearch: false,
        feedStates: feedObj.feedStates || [],
        snippet,
      });
    }
  } catch {
    // Skip unreachable direct RSS feed
  }

  return candidates;
}

async function fetchGoogleRssTask(task, options) {
  const {
    fromDate = "",
    toDate = "",
    keyword = "",
    limitPerSource = 20,
  } = options;
  const candidates = [];

  try {
    const { data: xml } = await axios.get(task.url, {
      headers: BROWSER_HEADERS,
      timeout: 6000,
    });

    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, limitPerSource);

    for (const item of items) {
      if (!item.link) continue;

      const rawTitle = item.title || "";
      const sourceMatch = rawTitle.match(/\s*-\s*([^-]+)$/);
      const sourceName =
        task.sourceName || (sourceMatch ? sourceMatch[1].trim() : "Indian News");
      const headline =
        rawTitle.replace(/\s*-\s*[^-]+$/, "").trim() || rawTitle.trim();
      const snippet = cleanHtmlText(item.contentSnippet || "");
      const dt = parsePublishDateTime(item.pubDate);

      if (fromDate && dt.date < fromDate) continue;
      if (toDate && dt.date > toDate) continue;
      if (isNoiseArticle(headline, keyword)) continue;

      candidates.push({
        headline,
        source: sourceName,
        date: dt.date,
        time: dt.time,
        publishedAt: dt.publishedAt,
        rawUrl: item.link,
        isGoogleLink: true,
        fromTargetedSearch: true,
        hintCity: task.hintCity || "",
        snippet,
      });
    }
  } catch {
    // Skip failed RSS query
  }

  return candidates;
}

export async function scrapeIndianNews(options = {}) {
  const {
    sources = [],
    topic = "all",
    fromDate = "",
    toDate = "",
    state = "",
    city = "",
    keyword = "",
    allStatesSweep = true,
    maxArticles = 150,
  } = options;

  const targetSources =
    sources.length > 0
      ? NEWS_SOURCES.filter((s) => sources.includes(s.id))
      : NEWS_SOURCES;

  const today = todayStr();
  const includesRecent = !toDate || toDate >= addDays(today, -2);

  const rssTasks = [];

  // 1. Direct RSS feeds
  if (includesRecent && !keyword.trim()) {
    const directFeeds = selectDirectFeedsForSources(
      targetSources,
      state,
      allStatesSweep && !state
    );
    for (const feedObj of directFeeds) {
      rssTasks.push({
        type: "direct",
        feedObj,
      });
    }
  }

  // 2. Per-newspaper Google News queries
  for (const source of targetSources) {
    rssTasks.push({
      type: "google",
      url: buildGoogleNewsUrl({
        domain: source.domain,
        topic,
        fromDate,
        toDate,
        state,
        city,
        keyword,
      }),
      sourceName: source.name,
      hintCity: city || "",
    });
  }

  // 3. State + City-Expanded Queries when a specific state is selected
  if (state && state !== "National") {
    const stateCities = INDIA_LOCATIONS[state] || [];

    if (city && city !== "State-Wide") {
      rssTasks.push({
        type: "google",
        url: buildGoogleNewsUrl({
          topic,
          fromDate,
          toDate,
          state,
          city,
          keyword,
        }),
        sourceName: "",
        hintCity: city,
      });
    } else {
      rssTasks.push({
        type: "google",
        url: buildGoogleNewsUrl({
          topic,
          fromDate,
          toDate,
          state,
          keyword,
        }),
        sourceName: "",
        hintCity: "",
      });

      for (const majorCity of stateCities.slice(0, 6)) {
        rssTasks.push({
          type: "google",
          url: buildGoogleNewsUrl({
            topic,
            fromDate,
            toDate,
            state,
            city: majorCity,
            keyword,
          }),
          sourceName: "",
          hintCity: majorCity,
        });
      }

      // Anchor batched city queries with the state name so shared city names (e.g. Bilaspur, Una) don't pull other states
      const cityChunks = chunkArray(stateCities.slice(6), 2);
      for (const group of cityChunks) {
        const clause = `"${state}" (${group.map((c) => `"${c}"`).join(" OR ")})`;
        rssTasks.push({
          type: "google",
          url: buildGoogleNewsUrl({
            topic,
            fromDate,
            toDate,
            keyword,
            locationClause: clause,
          }),
          sourceName: "",
          hintCity: group.length === 1 ? group[0] : "",
        });
      }
    }
  } else if (allStatesSweep && !keyword.trim()) {
    for (const region of INDIA_REGIONS) {
      rssTasks.push({
        type: "google",
        url: buildGoogleNewsUrl({
          topic,
          fromDate,
          toDate,
          keyword,
          locationClause: region.query,
        }),
        sourceName: "",
        hintCity: "",
      });
    }
  }

  const taskResults = await runWithConcurrency(rssTasks, 12, (task) =>
    task.type === "direct"
      ? fetchDirectRssFeed(task.feedObj, {
          fromDate,
          toDate,
          state,
          city,
          keyword,
          limitPerFeed: 25,
        })
      : fetchGoogleRssTask(task, {
          fromDate,
          toDate,
          keyword,
          limitPerSource: 20,
        })
  );

  const allCandidates = [];
  const seenKeys = new Set();

  for (const list of taskResults) {
    if (!Array.isArray(list)) continue;
    for (const candidate of list) {
      const key = `${candidate.headline.toLowerCase().slice(0, 65)}|${candidate.date}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        allCandidates.push(candidate);
      }
    }
  }

  const archived = loadArchivedArticles({ fromDate, toDate });
  const archivedMap = new Map(
    archived.map((a) => [
      `${a.headline.toLowerCase().slice(0, 65)}|${a.date}`,
      a,
    ])
  );

  const reusedArticles = [];
  const toFetch = [];
  let droppedByFilter = 0;

  for (const candidate of allCandidates) {
    const key = `${candidate.headline.toLowerCase().slice(0, 65)}|${candidate.date}`;
    const existing = archivedMap.get(key);

    if (existing && existing.time) {
      const cleanedContent = cleanHtmlText(existing.content);
      const check = classifyArticle(existing.headline, cleanedContent, {
        selectedTopic: topic,
        keyword,
        fromTargetedSearch: candidate.fromTargetedSearch,
      });

      if (!check.isRelevant) {
        droppedByFilter++;
        continue;
      }

      const loc = extractLocation(existing.headline, cleanedContent, state);

      if (state && state !== "National") {
        const lockedByFeed =
          Array.isArray(candidate.feedStates) &&
          candidate.feedStates.length === 1 &&
          candidate.feedStates[0] === state;

        if (!lockedByFeed && loc.state.toLowerCase() !== state.toLowerCase()) {
          droppedByFilter++;
          continue;
        }

        let resolvedCity = "State-Wide";
        if (city && city !== "State-Wide") {
          resolvedCity = city;
        } else if (loc.state.toLowerCase() === state.toLowerCase() && isCityInState(loc.city, state)) {
          resolvedCity = loc.city;
        } else if (isCityInState(existing.city, state)) {
          resolvedCity = existing.city;
        } else if (isCityInState(candidate.hintCity, state)) {
          resolvedCity = candidate.hintCity;
        }

        if (
          city &&
          city !== "State-Wide" &&
          resolvedCity.toLowerCase() !== city.toLowerCase() &&
          !`${existing.headline} ${cleanedContent}`.toLowerCase().includes(city.toLowerCase())
        ) {
          droppedByFilter++;
          continue;
        }

        reusedArticles.push({
          ...existing,
          content: cleanedContent,
          state,
          city: resolvedCity,
          topicId: check.topicId,
          category: check.topicLabel,
        });
      } else {
        reusedArticles.push({
          ...existing,
          content: cleanedContent,
          state: loc.state,
          city: loc.city || existing.city || "State-Wide",
          topicId: check.topicId,
          category: check.topicLabel,
        });
      }
    } else {
      toFetch.push(candidate);
    }
  }

  toFetch.sort((a, b) =>
    (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
  );

  const batchToEnrich = toFetch.slice(0, maxArticles);

  const newlyEnriched = (
    await runWithConcurrency(batchToEnrich, 15, async (item) => {
      let realUrl = item.rawUrl;

      if (item.isGoogleLink) {
        try {
          const decoded = await decoder.decode(item.rawUrl);
          if (decoded && decoded.status && decoded.decoded_url) {
            realUrl = decoded.decoded_url;
          }
        } catch {
          // Keep original link if decode fails
        }
      }

      const fullBody = realUrl.includes("news.google.com")
        ? ""
        : await fetchArticleBody(realUrl);

      const content = cleanHtmlText(fullBody || item.snippet || item.headline);

      const classification = classifyArticle(item.headline, content, {
        selectedTopic: topic,
        keyword,
        fromTargetedSearch: item.fromTargetedSearch,
      });
      if (!classification.isRelevant) {
        droppedByFilter++;
        return null;
      }

      const location = extractLocation(item.headline, content, state);
      let finalState = location.state;
      let finalCity = location.city;

      if (state && state !== "National") {
        const lockedByFeed =
          Array.isArray(item.feedStates) &&
          item.feedStates.length === 1 &&
          item.feedStates[0] === state;

        if (!lockedByFeed && location.state.toLowerCase() !== state.toLowerCase()) {
          droppedByFilter++;
          return null;
        }

        finalState = state;
        if (city && city !== "State-Wide") {
          finalCity = city;
        } else if (
          location.state.toLowerCase() === state.toLowerCase() &&
          isCityInState(location.city, state)
        ) {
          finalCity = location.city;
        } else if (isCityInState(item.hintCity, state)) {
          finalCity = item.hintCity;
        } else {
          finalCity = "State-Wide";
        }
      }

      return {
        headline: item.headline,
        state: finalState,
        city: finalCity,
        topicId: classification.topicId,
        category: classification.topicLabel,
        source: item.source,
        date: item.date,
        time: item.time,
        publishedAt: item.publishedAt,
        url: realUrl,
        content,
      };
    })
  ).filter(Boolean);

  if (newlyEnriched.length > 0) {
    saveArticlesToArchive(newlyEnriched);
  }

  return {
    articles: [...newlyEnriched, ...reusedArticles],
    stats: {
      feedsQueried: rssTasks.length,
      candidatesScanned: allCandidates.length,
      reusedFromArchive: reusedArticles.length,
      newlyExtracted: newlyEnriched.length,
      droppedByFilter,
      cappedRemaining: Math.max(0, toFetch.length - batchToEnrich.length),
    },
  };
}

export async function syncDirectRssFeeds(options = {}) {
  const {
    sources = [],
    state = "",
    city = "",
    topic = "all",
    limitPerFeed = 25,
  } = options;

  const targetSources =
    sources.length > 0
      ? NEWS_SOURCES.filter((s) => sources.includes(s.id))
      : NEWS_SOURCES;

  const feeds = selectDirectFeedsForSources(targetSources, state, true);

  const feedResults = await runWithConcurrency(feeds, 12, (feedObj) =>
    fetchDirectRssFeed(feedObj, {
      state,
      city,
      limitPerFeed,
    })
  );

  const seenKeys = new Set();
  const candidates = [];

  for (const list of feedResults) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const key = `${item.headline.toLowerCase().slice(0, 65)}|${item.date}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        candidates.push(item);
      }
    }
  }

  const today = todayStr();
  const yesterday = addDays(today, -1);
  const existingArchived = loadArchivedArticles({ fromDate: yesterday, toDate: today });
  const existingKeys = new Set(
    existingArchived.map(
      (a) => `${a.headline.toLowerCase().slice(0, 65)}|${a.date}`
    )
  );

  const syncedArticles = [];
  const brandNewToSave = [];

  for (const item of candidates) {
    const content = cleanHtmlText(item.snippet || item.headline);
    const classification = classifyArticle(item.headline, content, {
      selectedTopic: topic,
      fromTargetedSearch: false,
    });
    if (!classification.isRelevant) continue;

    const location = extractLocation(item.headline, content, state);
    const lockedByFeed =
      Array.isArray(item.feedStates) &&
      item.feedStates.length === 1 &&
      item.feedStates[0] === state;

    if (
      state &&
      state !== "National" &&
      !lockedByFeed &&
      location.state.toLowerCase() !== state.toLowerCase()
    ) {
      continue;
    }

    const finalState = state && state !== "National" ? state : location.state;
    const finalCity =
      city && city !== "State-Wide"
        ? city
        : location.state.toLowerCase() === finalState.toLowerCase() &&
          isCityInState(location.city, finalState)
        ? location.city
        : "State-Wide";

    const articleObj = {
      headline: item.headline,
      state: finalState,
      city: finalCity,
      topicId: classification.topicId,
      category: classification.topicLabel,
      source: item.source,
      date: item.date,
      time: item.time,
      publishedAt: item.publishedAt,
      url: item.rawUrl,
      content,
    };

    syncedArticles.push(articleObj);

    const key = `${item.headline.toLowerCase().slice(0, 65)}|${item.date}`;
    if (!existingKeys.has(key)) {
      existingKeys.add(key);
      brandNewToSave.push(articleObj);
    }
  }

  const enrichedNew = (
    await runWithConcurrency(brandNewToSave.slice(0, 10), 10, async (art) => {
      const fullBody = await fetchArticleBody(art.url, 2500);
      return fullBody ? { ...art, content: cleanHtmlText(fullBody) } : art;
    })
  ).filter(Boolean);

  if (enrichedNew.length > 0) {
    saveArticlesToArchive(enrichedNew);
  }

  const enrichedByUrl = new Map(enrichedNew.map((a) => [a.url, a]));
  const finalArticles = syncedArticles
    .map((a) => enrichedByUrl.get(a.url) || a)
    .sort((a, b) =>
      (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
    );

  return {
    articles: finalArticles,
    newCount: brandNewToSave.length,
    syncedAt: parsePublishDateTime(new Date()).time,
  };
}