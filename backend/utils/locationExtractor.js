import fs from "fs";

const locationsPath = new URL("../data/indiaLocations.json", import.meta.url);
const INDIA_LOCATIONS = JSON.parse(fs.readFileSync(locationsPath, "utf-8"));

function escapeRegex(str = "") {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Common words or short acronyms that frequently appear in non-location contexts
const AMBIGUOUS_CITY_NAMES = new Set([
  "Una",
  "Mandi",
  "Gaya",
  "Mau",
  "Dhar",
  "Kota",
  "Puri",
  "Beed",
  "Tonk",
  "Pali",
  "Sikar",
  "Alwar",
  "Churu",
  "Baran",
  "Bundi",
  "Dausa",
  "Jalore",
  "Sirohi",
  "Bilaspur",
  "Hamirpur",
]);

function buildStateAliasRegex(state) {
  if (state === "Himachal Pradesh") {
    return /\b(?:Himachal Pradesh|Himachal)\b/i;
  }
  if (state === "Jammu and Kashmir") {
    return /\b(?:Jammu and Kashmir|Jammu & Kashmir|J&K)\b/i;
  }
  if (state === "Uttar Pradesh") {
    return /\b(?:Uttar Pradesh)\b/i;
  }
  if (state === "Madhya Pradesh") {
    return /\b(?:Madhya Pradesh)\b/i;
  }
  if (state === "Andhra Pradesh") {
    return /\b(?:Andhra Pradesh)\b/i;
  }
  if (state === "Arunachal Pradesh") {
    return /\b(?:Arunachal Pradesh|Arunachal)\b/i;
  }
  if (state === "Tamil Nadu") {
    return /\b(?:Tamil Nadu)\b/i;
  }
  if (state === "West Bengal") {
    return /\b(?:West Bengal)\b/i;
  }
  return new RegExp(`\\b${escapeRegex(state)}\\b`, "i");
}

// Precompile case-sensitive city matchers + dateline matchers
const STATE_ENTRIES = Object.entries(INDIA_LOCATIONS).map(([state, cities]) => ({
  state,
  stateRegex: buildStateAliasRegex(state),
  cityMatchers: (cities || []).map((city) => {
    const esc = escapeRegex(city);
    const upperEsc = escapeRegex(city.toUpperCase());
    return {
      city,
      isAmbiguous: AMBIGUOUS_CITY_NAMES.has(city),
      // Dateline at start of article: "Shimla:" or "SHIMLA," or "Una -"
      datelineRegex: new RegExp(
        `(?:^|\\n)\\s*(?:${esc}|${upperEsc})\\s*[:,\\-–—]`,
      ),
      // Case-sensitive proper noun match (prevents "UNA" airline or lowercase "mandi" market)
      properWordRegex: new RegExp(`\\b${esc}\\b`),
      // District/town context: "Una district", "Mandi town"
      districtRegex: new RegExp(
        `\\b${esc}\\s+(?:district|town|city|division|constituency|tehsil|block)\\b`,
        "i"
      ),
    };
  }),
}));

const STATE_CITY_SET_MAP = new Map(
  Object.entries(INDIA_LOCATIONS).map(([state, cities]) => [
    state.toLowerCase(),
    new Set((cities || []).map((c) => c.toLowerCase())),
  ])
);

export function isCityInState(city = "", state = "") {
  if (!city || city === "State-Wide") return true;
  if (!state || state === "National") return true;
  const set = STATE_CITY_SET_MAP.get(state.toLowerCase());
  if (!set) return false;
  return set.has(city.toLowerCase());
}

function matchCityInList(cityMatchers, headline, leadBody, hasStateMention) {
  let bestCity = "";
  let bestScore = 0;

  for (const item of cityMatchers) {
    let score = 0;
    const inDateline = item.datelineRegex.test(leadBody.slice(0, 120));
    const inDistrict =
      item.districtRegex.test(headline) || item.districtRegex.test(leadBody);
    const inHeadline = item.properWordRegex.test(headline);
    const inBody = item.properWordRegex.test(leadBody);

    // If a city name is ambiguous (e.g., Una, Mandi, Bilaspur), require either
    // state mention, dateline, or "district/town" context so foreign/other-state news is rejected
    if (item.isAmbiguous && !hasStateMention && !inDateline && !inDistrict) {
      continue;
    }

    if (inDateline) score += 7;
    if (inDistrict) score += 6;
    if (inHeadline) score += 4;
    if (inBody) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestCity = item.city;
    }
  }

  return bestScore > 0 ? bestCity : "";
}

export function extractLocation(headline = "", content = "", preferredState = "") {
  const cleanHeadline = String(headline || "").trim();
  const leadBody = String(content || "").slice(0, 1500);

  // 1. State-scoped resolution when a specific state is requested
  if (preferredState && preferredState !== "National") {
    const targetEntry = STATE_ENTRIES.find(
      (e) => e.state.toLowerCase() === preferredState.toLowerCase()
    );

    if (targetEntry) {
      const hasStateMention =
        targetEntry.stateRegex.test(cleanHeadline) ||
        targetEntry.stateRegex.test(leadBody);

      const matchedCity = matchCityInList(
        targetEntry.cityMatchers,
        cleanHeadline,
        leadBody,
        hasStateMention
      );

      if (matchedCity) {
        return { state: targetEntry.state, city: matchedCity };
      }

      if (hasStateMention) {
        return { state: targetEntry.state, city: "State-Wide" };
      }
    }
  }

  // 2. Pan-India scan across all states and cities
  let bestState = "";
  let bestCity = "";
  let bestScore = 0;

  for (const entry of STATE_ENTRIES) {
    const stateInHeadline = entry.stateRegex.test(cleanHeadline);
    const stateInBody = entry.stateRegex.test(leadBody);
    const hasStateMention = stateInHeadline || stateInBody;

    const matchedCity = matchCityInList(
      entry.cityMatchers,
      cleanHeadline,
      leadBody,
      hasStateMention
    );

    let score = 0;
    if (matchedCity) score += 5;
    if (stateInHeadline) score += 5;
    if (stateInBody) score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestState = entry.state;
      bestCity = matchedCity || "State-Wide";
    }
  }

  if (bestState) {
    return { state: bestState, city: bestCity };
  }

  return { state: "National", city: "New Delhi" };
}