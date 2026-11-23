function createSummary(content = "", headline = "", minWords = 60, maxWords = 70) {
  let clean = content.replace(/\s+/g, " ").trim();

  // Strip the headline if it is repeated at the start of the article body
  if (headline) {
    const cleanHeadline = headline.replace(/\s+/g, " ").trim();
    if (clean.toLowerCase().startsWith(cleanHeadline.toLowerCase())) {
      clean = clean.slice(cleanHeadline.length).replace(/^[\s\-:|–—]+/, "").trim();
    }
  }

  if (!clean || clean.split(" ").length < 8) {
    return "Full article text was blocked by the publisher; open URL to read.";
  }

  const words = clean.split(" ").filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(" ");
  }

  // Prefer ending at a complete sentence between 60 and 70 words
  const chunk = words.slice(0, maxWords).join(" ");
  const lastSentenceEnd = Math.max(
    chunk.lastIndexOf(". "),
    chunk.lastIndexOf("? "),
    chunk.lastIndexOf("! ")
  );

  if (lastSentenceEnd !== -1) {
    const sentenceCut = chunk.slice(0, lastSentenceEnd + 1).trim();
    if (sentenceCut.split(" ").length >= minWords) {
      return sentenceCut;
    }
  }

  // Fallback: cut cleanly at 65 words
  return `${words.slice(0, 65).join(" ").replace(/[.,;:\-]+$/, "")}...`;
}

export function formatArticlesToTxt(articles = []) {
  const today = new Date().toISOString().split("T")[0];
  const divider = "===================================================================";

  const lines = [
    "BALLOTIX NEWS SCRAPPER — INDIA HOLISTIC CIVIC & PUBLIC-INTEREST NEWS REPORT",
    `Generated On: ${today} | Total Verified Articles: ${articles.length}`,
    divider,
    "",
  ];

  articles.forEach((article, index) => {
    const summary = createSummary(article.content, article.headline);

    lines.push(`[ARTICLE #${index + 1}]`);
    lines.push(`HEADLINE : ${article.headline}`);
    lines.push(`TOPIC    : ${article.category || "General"}`);
    lines.push(`STATE    : ${article.state}`);
    lines.push(`CITY     : ${article.city}`);
    lines.push(
      `SOURCE   : ${article.source} | DATE: ${article.date} | TIME: ${article.time || "N/A"}`
    );
    lines.push(`URL      : ${article.url} | SUMMARY: ${summary}`);
    lines.push("CONTENT  :");
    lines.push(article.content);
    lines.push("");
    lines.push(divider);
    lines.push("");
  });

  return lines.join("\n");
}