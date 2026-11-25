import fs from "fs";
import {
  scrapeIndianNews,
  syncDirectRssFeeds,
} from "../scrapers/newsScraper.js";

const locationsPath = new URL("../data/indiaLocations.json", import.meta.url);
const INDIA_LOCATIONS = JSON.parse(fs.readFileSync(locationsPath, "utf-8"));

// Priority states scraped deeply every run; pass "--all-states" to sweep every state/UT
const PRIORITY_STATES = [
  "Punjab",
  "Haryana",
  "Himachal Pradesh",
  "Chandigarh",
  "Delhi",
];

async function runDailyAutomation() {
  const startedAt = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  console.log(`[Ballotix Auto-Scrape] Started at ${startedAt} IST`);

  // 1. Fast sync of all direct RSS feeds (The Tribune regional feeds + national dailies)
  const liveResult = await syncDirectRssFeeds({ topic: "all" });
  console.log(
    `[Step 1/3] Direct RSS synced: ${liveResult.articles.length} checked, ${liveResult.newCount} new archived.`
  );

  // 2. Pan-India 6-region civic sweep
  const nationalResult = await scrapeIndianNews({
    topic: "all",
    allStatesSweep: true,
    maxArticles: 150,
  });
  console.log(
    `[Step 2/3] Pan-India sweep: ${nationalResult.stats.newlyExtracted} new, ${nationalResult.stats.reusedFromArchive} already archived.`
  );

  // 3. State + City-wise deep extraction
  const sweepAll = process.argv.includes("--all-states");
  const statesToScrape = sweepAll
    ? Object.keys(INDIA_LOCATIONS)
    : PRIORITY_STATES;

  for (const state of statesToScrape) {
    const stateResult = await scrapeIndianNews({
      topic: "all",
      state,
      allStatesSweep: false,
      maxArticles: 120,
    });
    console.log(
      `[Step 3/3] ${state}: ${stateResult.stats.newlyExtracted} new stories archived.`
    );
  }

  console.log("[Ballotix Auto-Scrape] Completed successfully.");
  process.exit(0);
}

runDailyAutomation().catch((err) => {
  console.error("[Ballotix Auto-Scrape] Failed:", err);
  process.exit(1);
});