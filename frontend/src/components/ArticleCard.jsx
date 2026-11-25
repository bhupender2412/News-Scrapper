import { useState } from "react";

function getSourceInitials(source = "") {
  const words = source
    .replace(/^The\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "IN";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function ArticleCard({ article }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isLongContent = (article.content || "").length > 320;

  const handleCopy = () => {
    const snippet = (article.content || "").split(/\s+/).slice(0, 65).join(" ");
    const dateTime = article.time
      ? `${article.date} ${article.time}`
      : article.date;
    const textToCopy = `${article.headline}\n${article.source} (${dateTime}) | ${article.state}, ${article.city}\n${snippet}...\n${article.url}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="group bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs hover:border-blue-300/90 hover:shadow-md transition-all duration-200 space-y-3">
      {/* Top Metadata & Quiet Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
            {article.category || "Civic News"}
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
            {article.state}
            {article.city && article.city !== article.state ? ` • ${article.city}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {copied ? "Copied" : "Copy"}
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
          >
            <span>Read</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Editorial Headline */}
      <h3 className="font-editorial text-xl sm:text-[22px] font-bold text-slate-900 leading-snug tracking-tight">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group-hover:text-blue-600 transition-colors"
        >
          {article.headline}
        </a>
      </h3>

      {/* Article Body */}
      <div className="space-y-1.5">
        <p
          className={`text-sm text-slate-600 leading-relaxed whitespace-pre-line ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {article.content}
        </p>

        {isLongContent && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {expanded ? "Show less" : "Read full extract →"}
          </button>
        )}
      </div>

      {/* Footer: Publisher & Timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-900 text-white font-mono-tech text-[10px] font-semibold">
            {getSourceInitials(article.source)}
          </span>
          <span className="font-semibold text-slate-800">{article.source}</span>
        </div>

        <div className="font-mono-tech text-[11px] text-slate-500">
          {article.date}
          {article.time ? ` • ${article.time}` : ""}
        </div>
      </div>
    </article>
  );
}