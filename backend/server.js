import express from "express";
import cors from "cors";
import fs from "fs";
import { NEWS_SOURCES, scrapeIndianNews } from "./scrapers/newsScraper.js";
import { formatArticlesToTxt } from "./utils/txtFormatter.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Load locations once so the frontend can populate State & City dropdowns
const locationsPath = new URL("./data/indiaLocations.json", import.meta.url);
const indiaLocations = JSON.parse(fs.readFileSync(locationsPath, "utf-8"));

// In-memory cache of the latest scraped articles
let latestArticles = [];

app.get("/api/locations", (req, res) => {
  res.json(indiaLocations);
});

app.get("/api/sources", (req, res) => {
  res.json(NEWS_SOURCES);
});

app.post("/api/scrape", async (req, res) => {
  try {
    const {
      sources = [],
      fromDate = "",
      toDate = "",
      state = "",
      city = "",
      keyword = "",
      limitPerSource = 25,
    } = req.body || {};

    const results = await scrapeIndianNews({
      sources,
      fromDate,
      toDate,
      state,
      city,
      keyword,
      limitPerSource,
    });

    // Sort newest first
    results.sort((a, b) => b.date.localeCompare(a.date));

    latestArticles = results;
    res.json({
      success: true,
      count: results.length,
      articles: results,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to scrape news articles.",
    });
  }
});

app.get("/api/download-txt", (req, res) => {
  const txtContent = formatArticlesToTxt(latestArticles);
  const filename = `india-political-news-${new Date().toISOString().split("T")[0]}.txt`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(txtContent);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});