import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVE_DIR = path.resolve(__dirname, "../archive");

function ensureArchiveDir() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
}

function getDateFilePath(dateStr) {
  const safeDate = String(dateStr || "").replace(/[^0-9-]/g, "");
  return path.join(ARCHIVE_DIR, `${safeDate}.json`);
}

function makeHeadlineKey(headline = "") {
  return String(headline).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 65);
}

// Save articles grouped by their publication date (YYYY-MM-DD)
export function saveArticlesToArchive(articles = []) {
  ensureArchiveDir();

  const byDate = {};
  for (const article of articles) {
    const dateKey = article.date || new Date().toISOString().split("T")[0];
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(article);
  }

  for (const [dateKey, newItems] of Object.entries(byDate)) {
    const filePath = getDateFilePath(dateKey);
    let existing = [];

    if (fs.existsSync(filePath)) {
      try {
        existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch {
        existing = [];
      }
    }

    const seenUrls = new Set(existing.map((a) => a.url));
    const seenHeadlines = new Set(existing.map((a) => makeHeadlineKey(a.headline)));
    const merged = [...existing];
    let addedCount = 0;

    for (const item of newItems) {
      const hKey = makeHeadlineKey(item.headline);
      if (item.url && !seenUrls.has(item.url) && !seenHeadlines.has(hKey)) {
        seenUrls.add(item.url);
        seenHeadlines.add(hKey);
        merged.push(item);
        addedCount++;
      }
    }

    // Only write to disk if brand-new articles were actually added
    if (addedCount > 0) {
      fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
    }
  }
}

// Load archived articles for a single date or a date range
export function loadArchivedArticles({ fromDate = "", toDate = "" } = {}) {
  ensureArchiveDir();

  const files = fs
    .readdirSync(ARCHIVE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();

  const results = [];

  for (const file of files) {
    const fileDate = file.replace(".json", "");
    if (fromDate && fileDate < fromDate) continue;
    if (toDate && fileDate > toDate) continue;

    try {
      const items = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf-8"));
      results.push(...items);
    } catch {
      // Skip corrupted files
    }
  }

  return results;
}

// List all archived dates with article counts (newest first)
export function listArchivedDates() {
  ensureArchiveDir();

  return fs
    .readdirSync(ARCHIVE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .map((file) => {
      const date = file.replace(".json", "");
      try {
        const items = JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf-8"));
        return { date, count: items.length };
      } catch {
        return { date, count: 0 };
      }
    });
}