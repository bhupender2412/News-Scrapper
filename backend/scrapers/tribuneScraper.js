import axios from "axios";
import Parser from "rss-parser";
import { filterPoliticalArticle } from "../utils/politicalFilter.js";
import { extractLocation } from "../utils/locationExtractor.js";

const parser = new Parser();

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
};

// Google News `before:` is exclusive, so add 1 day to include the end date
function addOneDay(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function buildSearchUrl({ fromDate, toDate, state, city, keyword }) {
  const queryParts = ["site:tribuneindia.com"];

  if (keyword && keyword.trim()) {
    queryParts.push(`"${keyword.trim()}"`);
  } else {
    // Broad political query when no specific keyword is typed
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

export async function scrapeTribune(options = {}) {
  const { fromDate = "", toDate = "", state = "", city = "", keyword = "", limit = 100 } = options;

  const feedUrl = buildSearchUrl({ fromDate, toDate, state, city, keyword });
  const verifiedArticles = [];
  const seenUrls = new Set();

  try {
    const { data: xml } = await axios.get(feedUrl, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
    });

    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, limit);

    for (const item of items) {
      if (!item.link || seenUrls.has(item.link)) continue;
      seenUrls.add(item.link);

      const headline = (item.title || "").replace(/\s*-\s*The Tribune$/i, "").trim();
      const content = (item.contentSnippet || headline).trim();

      const publishedDate = item.pubDate
        ? new Date(item.pubDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      // Strict date range check
      if (fromDate && publishedDate < fromDate) continue;
      if (toDate && publishedDate > toDate) continue;

      // Stage 1: Political & Opposition Filter
      const { isPolitical, category } = filterPoliticalArticle(headline, content);
      if (!isPolitical) continue;

      // Stage 2: Pan-India Location Extraction
      const location = extractLocation(headline, content);

      verifiedArticles.push({
        headline,
        state: location.state,
        city: location.city,
        category,
        source: "The Tribune",
        date: publishedDate,
        url: item.link,
        content,
      });
    }
  } catch (err) {
    console.error(`Failed to fetch Tribune historical feed: ${err.message}`);
  }

  return verifiedArticles;
}