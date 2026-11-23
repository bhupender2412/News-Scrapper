function escapeCsv(value = "") {
  const str = String(value).replace(/\r?\n/g, " ").trim();
  if (str.includes(",") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatArticlesToCsv(articles = []) {
  const headers = [
    "Headline",
    "Topic",
    "State",
    "City",
    "Source",
    "Date",
    "Time",
    "URL",
    "Content",
  ];

  const rows = articles.map((article) =>
    [
      article.headline,
      article.category || "General",
      article.state,
      article.city,
      article.source,
      article.date,
      article.time || "N/A",
      article.url,
      article.content,
    ]
      .map(escapeCsv)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}