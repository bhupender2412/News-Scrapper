import express from "express";
import cors from "cors";
import fs from "fs";
import { NEWS_SOURCES, scrapeIndianNews } from "./scrapers/newsScraper.js";
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
  latestArticles = articles;
  res.json({
    success: true,
    date,
    count: articles.length,
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

    const scraped = await scrapeIndianNews({
      sources,
      topic,
      fromDate,
      toDate,
      state,
      city,
      keyword,
      allStatesSweep,
    });

    // Sort by exact publication timestamp (newest first)
    scraped.sort((a, b) =>
      (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
    );

    latestArticles = scraped;
    res.json({
      success: true,
      count: scraped.length,
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

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

async function runDailyAutoScrape() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`[Auto-Scrape] Collecting holistic Pan-India news for ${today}...`);
  try {
    const items = await scrapeIndianNews({
      topic: "all",
      fromDate: today,
      toDate: today,
      allStatesSweep: true,
    });
    console.log(`[Auto-Scrape] Archived ${items.length} articles for ${today}.`);
  } catch (err) {
    console.error(`[Auto-Scrape] Failed: ${err.message}`);
  }
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  setInterval(runDailyAutoScrape, SIX_HOURS_MS);
});