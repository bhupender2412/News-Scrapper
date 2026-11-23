import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import Parser from "rss-parser";
import pkg from "google-news-url-decoder";
import { filterPoliticalArticle } from "../utils/politicalFilter.js";
import { extractLocation } from "../utils/locationExtractor.js";

const { GoogleDecoder } = pkg;
const decoder = new GoogleDecoder();
const parser = new Parser();

const sourcesPath = new URL("../data/newsSources.json", import.meta.url);
export const NEWS_SOURCES = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function addOneDay(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function buildSearchUrl(domain, { fromDate, toDate, state, city, keyword }) {
  const queryParts = [`site:${domain}`];

  if (keyword && keyword.trim()) {
    queryParts.push(`"${keyword.trim()}"`);
  } else {
    queryParts.push("(BJP OR Congress OR AAP OR CM OR PM OR Minister OR Opposition OR MLA OR MP)");
  }

  if (city && city.trim()) {
    queryParts.push(`"${city.trim()}"`);
  } else if (state && state.trim() && state !== "National") {
    queryParts.push(`"${state.trim()}"`);
  }

  if (fromDate) {
    queryParts.push(`after:${fromDate}`);
  }
  if (toDate) {
    queryParts.push(`before:${addOneDay(toDate)}`);
  }

  const encodedQuery = encodeURIComponent(queryParts.join(" "));
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
}

// Extract structured articleBody from JSON-LD
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
        if (node && typeof node.articleBody === "string" && node.articleBody.trim().length > 150) {
          bodyText = node.articleBody.replace(/\s+/g, " ").trim();
          break;
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  return bodyText;
}

// Fallback reader when a newspaper blocks direct axios requests
async function fetchViaReaderFallback(realUrl) {
  try {
    const { data: text } = await axios.get(`https://r.jina.ai/${realUrl}`, {
      headers: { Accept: "text/plain" },
      timeout: 12000,
    });

    if (typeof text !== "string") return "";

    // Keep clean prose paragraphs, skip markdown headers, links, and metadata lines
    const lines = text
      .split(/\n+/)
      .map((line) =>
        line
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown links
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

    return lines.slice(0, 6).join("\n\n");
  } catch {
    return "";
  }
}

// Fetch the real newspaper page and extract clean article content
async function fetchArticleBody(realUrl) {
  try {
    const { data: html } = await axios.get(realUrl, {
      headers: BROWSER_HEADERS,
      timeout: 10000,
      maxRedirects: 5,
    });

    if (typeof html === "string") {
      const $ = cheerio.load(html);

      // 1. JSON-LD articleBody
      const jsonLdBody = extractJsonLdBody($);
      if (jsonLdBody.length >= 250) {
        return jsonLdBody;
      }

      // 2. HTML paragraphs
      $(
        "script, style, noscript, iframe, header, footer, nav, aside, .ad, .advertisement, .related-news, .also-read, .comments"
      ).remove();

      const paragraphs = [];
      $("article p, .story-desc p, .article-body p, .content p, main p, p").each((_, el) => {
        const text = $(el).text().replace(/\s+/g, " ").trim();
        if (
          text.length >= 60 &&
          !/^(read also|also read|subscribe|follow us|copyright|all rights reserved|sign up|download)/i.test(
            text
          )
        ) {
          paragraphs.push(text);
        }
      });

      const uniqueParagraphs = [...new Set(paragraphs)];
      const joined = uniqueParagraphs.slice(0, 8).join("\n\n");
      if (joined.length >= 250) {
        return joined;
      }
    }
  } catch {
    // Direct fetch blocked; fall through to reader fallback
  }

  // 3. Reader fallback for publishers that block direct scraping
  return await fetchViaReaderFallback(realUrl);
}

async function scrapeSingleSource(source, options) {
  const { fromDate = "", toDate = "", limitPerSource = 25 } = options;
  const feedUrl = buildSearchUrl(source.domain, options);
  const candidates = [];

  try {
    const { data: xml } = await axios.get(feedUrl, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    });

    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, limitPerSource);

    for (const item of items) {
      if (!item.link) continue;

      const rawTitle = item.title || "";
      const headline = rawTitle.replace(/\s*-\s*[^-]+$/, "").trim() || rawTitle.trim();
      const snippet = (item.contentSnippet || "").trim();

      const publishedDate = item.pubDate
        ? new Date(item.pubDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      if (fromDate && publishedDate < fromDate) continue;
      if (toDate && publishedDate > toDate) continue;

      const { isPolitical, category } = filterPoliticalArticle(headline, snippet);
      if (!isPolitical) continue;

      candidates.push({
        headline,
        category,
        source: source.name,
        date: publishedDate,
        googleUrl: item.link,
        snippet,
      });
    }
  } catch (err) {
    console.error(`Failed to scrape ${source.name}: ${err.message}`);
  }

  return candidates;
}

// Decode each article's own URL individually (prevents URL mismatch) and fetch full body
async function enrichArticlesWithFullText(candidates) {
  if (candidates.length === 0) return [];

  const enriched = [];
  const fetchBatchSize = 5;

  for (let i = 0; i < candidates.length; i += fetchBatchSize) {
    const chunk = candidates.slice(i, i + fetchBatchSize);

    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        let realUrl = item.googleUrl;

        try {
          const decoded = await decoder.decode(item.googleUrl);
          if (decoded && decoded.status && decoded.decoded_url) {
            realUrl = decoded.decoded_url;
          }
        } catch {
          // Keep original link if decode fails
        }

        const fullBody = realUrl.includes("news.google.com")
          ? ""
          : await fetchArticleBody(realUrl);

        const content = fullBody || item.snippet || item.headline;
        const location = extractLocation(item.headline, content);

        return {
          headline: item.headline,
          state: location.state,
          city: location.city,
          category: item.category,
          source: item.source,
          date: item.date,
          url: realUrl,
          content,
        };
      })
    );

    enriched.push(...chunkResults);
  }

  return enriched;
}

export async function scrapeIndianNews(options = {}) {
  const { sources = [] } = options;

  const targetSources =
    sources.length > 0
      ? NEWS_SOURCES.filter((s) => sources.includes(s.id))
      : NEWS_SOURCES;

  const allCandidates = [];
  const seenUrls = new Set();

  const batchSize = 3;
  for (let i = 0; i < targetSources.length; i += batchSize) {
    const batch = targetSources.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((source) => scrapeSingleSource(source, options))
    );

    for (const sourceCandidates of batchResults) {
      for (const candidate of sourceCandidates) {
        if (!seenUrls.has(candidate.googleUrl)) {
          seenUrls.add(candidate.googleUrl);
          allCandidates.push(candidate);
        }
      }
    }

    if (i + batchSize < targetSources.length) {
      await delay(500);
    }
  }

  return await enrichArticlesWithFullText(allCandidates);
}