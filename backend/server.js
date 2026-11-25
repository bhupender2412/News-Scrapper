import express from "express";
import cors from "cors";
import fs from "fs";
import {
  NEWS_SOURCES,
  scrapeIndianNews,
  syncDirectRssFeeds,
} from "./scrapers/newsScraper.js";
import { getTopicsList } from "./utils/topicFilter.js";
import { formatArticlesToTxt } from "./utils/txtFormatter.js";
import { formatArticlesToCsv } from "./utils/csvFormatter.js";
import {
  listArchivedDates,
  loadArchivedArticles,
} from "./utils/newsArchive.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const locationsPath = new URL("./data/indiaLocations.json", import.meta.url);
const indiaLocations = JSON.parse(fs.readFileSync(locationsPath, "utf-8"));

let latestArticles = [];

function computeCityBreakdown(articles = []) {
  const counts = {};
  for (const art of articles) {
    const cityKey = art.city || "State-Wide";
    counts[cityKey] = (counts[cityKey] || 0) + 1;
  }

  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1])
  );
}

app.get("/api/locations", (req, res) => {
  res.json(indiaLocations);
});

app.get("/api/sources", (req, res) => {
  res.json(NEWS_SOURCES);
});

app.get("/api/topics", (req, res) => {
  res.json(getTopicsList());
});

app.get("/api/archive/dates", (req, res) => {
  res.json(listArchivedDates());
});

app.get("/api/archive/:date", (req, res) => {
  const { date } = req.params;
  const articles = loadArchivedArticles({ fromDate: date, toDate: date });
  articles.sort((a, b) =>
    (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
  );
  latestArticles = articles;
  res.json({
    success: true,
    date,
    count: articles.length,
    cityBreakdown: computeCityBreakdown(articles),
    articles,
  });
});

app.post("/api/scrape", async (req, res) => {
  try {
    const {
      sources = [],
      topic = "all",
      fromDate = "",
      toDate = "",
      state = "",
      city = "",
      keyword = "",
      allStatesSweep = true,
    } = req.body || {};

    const { articles: scraped, stats } = await scrapeIndianNews({
      sources,
      topic,
      fromDate,
      toDate,
      state,
      city,
      keyword,
      allStatesSweep,
    });

    scraped.sort((a, b) =>
      (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
    );

    latestArticles = scraped;
    res.json({
      success: true,
      count: scraped.length,
      stats,
      cityBreakdown: computeCityBreakdown(scraped),
      articles: scraped,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to scrape news articles.",
    });
  }
});

// Fast live RSS sync endpoint (checks direct Tribune & daily RSS feeds in ~2-4 seconds)
app.post("/api/rss-live", async (req, res) => {
  try {
    const {
      sources = [],
      state = "",
      city = "",
      topic = "all",
    } = req.body || {};

    const result = await syncDirectRssFeeds({
      sources,
      state,
      city,
      topic,
    });

    if (result.articles.length > 0) {
      latestArticles = result.articles;
    }

    res.json({
      success: true,
      count: result.articles.length,
      newCount: result.newCount,
      syncedAt: result.syncedAt,
      cityBreakdown: computeCityBreakdown(result.articles),
      articles: result.articles,
    });
  } catch (err) {
    console.error("Live RSS sync error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to sync live RSS feeds.",
    });
  }
});

app.post("/api/export-txt", (req, res) => {
  const articlesToExport =
    Array.isArray(req.body?.articles) && req.body.articles.length > 0
      ? req.body.articles
      : latestArticles;

  const txtContent = formatArticlesToTxt(articlesToExport);
  const filename = `ballotix-news-${new Date().toISOString().split("T")[0]}.txt`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(txtContent);
});

app.post("/api/export-csv", (req, res) => {
  const articlesToExport =
    Array.isArray(req.body?.articles) && req.body.articles.length > 0
      ? req.body.articles
      : latestArticles;

  const csvContent = formatArticlesToCsv(articlesToExport);
  const filename = `ballotix-news-${new Date().toISOString().split("T")[0]}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvContent);
});

// Automatic 15-minute live RSS poller for continuous daily archiving
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

async function runLiveRssPoller() {
  try {
    const { newCount, syncedAt } = await syncDirectRssFeeds({ topic: "all" });
    if (newCount > 0) {
      console.log(`[Live-RSS] Archived ${newCount} new civic articles at ${syncedAt}.`);
    }
  } catch (err) {
    console.error(`[Live-RSS] Poll error: ${err.message}`);
  }
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  setTimeout(runLiveRssPoller, 5000);
  setInterval(runLiveRssPoller, FIFTEEN_MINUTES_MS);
});