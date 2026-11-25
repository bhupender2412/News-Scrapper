function escapeCsv(value = "") {
  const str = String(value).replace(/\r?\n/g, " ").trim();
  if (str.includes(",") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Keep ISO dates as plain text in Excel so default column widths never overflow into "########"
function formatExcelDate(dateStr = "") {
  const clean = String(dateStr).trim();
  if (!clean) return "";
  return `="${clean.replace(/"/g, '""')}"`;
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
      escapeCsv(article.headline),
      escapeCsv(article.category || "General"),
      escapeCsv(article.state),
      escapeCsv(article.city),
      escapeCsv(article.source),
      formatExcelDate(article.date),
      escapeCsv(article.time || "N/A"),
      escapeCsv(article.url),
      escapeCsv(article.content),
    ].join(",")
  );

  // Prefix UTF-8 BOM (\uFEFF) so Excel displays ₹, ’, “, and – cleanly
  return `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
}