import fs from "fs";

const locationsPath = new URL("../data/indiaLocations.json", import.meta.url);
const indiaLocations = JSON.parse(fs.readFileSync(locationsPath, "utf-8"));

// Helper to match whole words only (prevents "Goa" matching inside "goal")
function hasWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  return regex.test(text);
}

// Scans a given text block for a City first, then a State/UT
function findLocationInText(text) {
  if (!text) return null;

  // 1. Check all cities and map directly to parent State/UT
  for (const [state, cities] of Object.entries(indiaLocations)) {
    for (const city of cities) {
      if (hasWord(text, city)) {
        return { state, city };
      }
    }
  }

  // 2. If no city matched, check State/UT names directly
  for (const state of Object.keys(indiaLocations)) {
    if (hasWord(text, state)) {
      return { state, city: "Statewide" };
    }
  }

  return null;
}

export function extractLocation(headline = "", content = "") {
  // Stage 1: Check article dateline (first 60 characters of body)
  const dateline = content.slice(0, 60);
  const datelineMatch = findLocationInText(dateline);
  if (datelineMatch) {
    return datelineMatch;
  }

  // Stage 2: Scan headline, then full body
  const headlineMatch = findLocationInText(headline);
  if (headlineMatch) {
    return headlineMatch;
  }

  const bodyMatch = findLocationInText(content);
  if (bodyMatch) {
    return bodyMatch;
  }

  // Stage 3: Default fallback for central/national-only news
  return { state: "National", city: "New Delhi" };
}