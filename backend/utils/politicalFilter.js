import fs from "fs";

const keywordsPath = new URL("../data/politicalKeywords.json", import.meta.url);
const keywords = JSON.parse(fs.readFileSync(keywordsPath, "utf-8"));

function matchesAny(text, list) {
  return list.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(text);
  });
}

export function filterPoliticalArticle(headline = "", content = "") {
  // Take headline + first 2 paragraphs for Stage 1 validation
  const paragraphs = content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sampleText = `${headline} ${paragraphs.slice(0, 2).join(" ")}`;

  const hasEntity = matchesAny(sampleText, keywords.entities);
  if (!hasEntity) {
    return { isPolitical: false, category: null };
  }

  const hasOppositionVerb = matchesAny(sampleText, keywords.oppositionVerbs);
  const hasPostCue = matchesAny(sampleText, keywords.postCues);

  if (!hasOppositionVerb && !hasPostCue) {
    return { isPolitical: false, category: null };
  }

  let category = "Political Statement";
  if (hasOppositionVerb && hasPostCue) {
    category = "Opposition Comment / Politician Post";
  } else if (hasOppositionVerb) {
    category = "Opposition Comment";
  } else if (hasPostCue) {
    category = "Politician Post";
  }

  return { isPolitical: true, category };
}