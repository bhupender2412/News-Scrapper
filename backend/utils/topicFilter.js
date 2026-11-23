import fs from "fs";

const configPath = new URL("../data/topicConfig.json", import.meta.url);
export const TOPIC_CONFIG = JSON.parse(fs.readFileSync(configPath, "utf-8"));

function compileMatchers(list = []) {
  return list.map((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i");
  });
}

const NOISE_MATCHERS = compileMatchers(TOPIC_CONFIG.excludeNoise);

const TOPIC_MATCHERS = TOPIC_CONFIG.topics.map((topic) => ({
  id: topic.id,
  label: topic.label,
  matchers: compileMatchers(topic.keywords),
}));

function countMatches(text, regexList) {
  let hits = 0;
  for (const rx of regexList) {
    if (rx.test(text)) hits++;
  }
  return hits;
}

export function getTopicsList() {
  return TOPIC_CONFIG.topics.map(({ id, label }) => ({ id, label }));
}

export function getTopicSearchQuery(topicId = "all") {
  if (topicId && topicId !== "all") {
    const found = TOPIC_CONFIG.topics.find((t) => t.id === topicId);
    if (found) return found.searchQuery;
  }
  return "(government OR health OR education OR economy OR infrastructure OR policy)";
}

// Fast check to block entertainment, cricket, and crime
export function isNoiseArticle(headline = "", keyword = "") {
  const cleanHeadline = headline.trim();
  const hasNoise = NOISE_MATCHERS.some((rx) => rx.test(cleanHeadline));
  if (!hasNoise) return false;

  // Allow only if the user explicitly searched for that word
  const q = keyword.trim();
  if (q && NOISE_MATCHERS.some((rx) => rx.test(q))) {
    return false;
  }

  return true;
}

// Accurate post-fetch classification using headline + full body
export function classifyArticle(headline = "", content = "", options = {}) {
  const { selectedTopic = "all", keyword = "", fromTargetedSearch = false } = options;

  if (isNoiseArticle(headline, keyword)) {
    return { isRelevant: false, topicId: "", topicLabel: "" };
  }

  const cleanHeadline = headline.trim();
  const textToScan = `${cleanHeadline} ${content.slice(0, 1200)}`;

  // Score every topic
  let bestTopic = null;
  let bestScore = 0;

  for (const t of TOPIC_MATCHERS) {
    const score = countMatches(cleanHeadline, t.matchers) * 2 + countMatches(textToScan, t.matchers);
    if (score > bestScore) {
      bestScore = score;
      bestTopic = t;
    }
  }

  // 1. Custom keyword search: check if at least one meaningful word matches (or trust Google targeted search)
  const q = keyword.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const lowerText = textToScan.toLowerCase();
    const matched =
      lowerText.includes(q) ||
      (words.length > 0 && words.some((w) => lowerText.includes(w)));

    if (!matched && !fromTargetedSearch) {
      return { isRelevant: false, topicId: "", topicLabel: "" };
    }

    return {
      isRelevant: true,
      topicId: bestTopic ? bestTopic.id : "custom",
      topicLabel: bestTopic ? bestTopic.label : `Topic: ${keyword.trim()}`,
    };
  }

  // 2. Specific topic selected from dropdown
  if (selectedTopic && selectedTopic !== "all") {
    const target = TOPIC_MATCHERS.find((t) => t.id === selectedTopic);
    if (!target) return { isRelevant: false, topicId: "", topicLabel: "" };

    const targetHits = countMatches(textToScan, target.matchers);

    // Keep if target topic matches, OR if it came from a targeted search and wasn't overridden by another topic
    if (targetHits > 0 || (fromTargetedSearch && (!bestTopic || bestTopic.id === target.id))) {
      return { isRelevant: true, topicId: target.id, topicLabel: target.label };
    }

    return { isRelevant: false, topicId: "", topicLabel: "" };
  }

  // 3. "All Holistic Topics": require at least one civic topic match
  if (bestTopic && bestScore > 0) {
    return {
      isRelevant: true,
      topicId: bestTopic.id,
      topicLabel: bestTopic.label,
    };
  }

  return { isRelevant: false, topicId: "", topicLabel: "" };
}