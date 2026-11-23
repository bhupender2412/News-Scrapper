import { useState } from "react";

export default function ArticleCard({ article }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const snippet = (article.content || "").split(/\s+/).slice(0, 65).join(" ");
    const dateTime = article.time ? `${article.date} ${article.time}` : article.date;
    const textToCopy = `${article.headline}\n${article.source} (${dateTime}) | ${article.state}, ${article.city}\n${snippet}...\n${article.url}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            {article.category}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {article.state}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
            {article.city}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <h2 className="text-lg font-semibold text-slate-900 leading-snug">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-600 transition-colors"
        >
          {article.headline}
        </a>
      </h2>

      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
        {article.content}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
        <span className="font-medium text-slate-700">{article.source}</span>
        <span>
          {article.date}
          {article.time ? ` • ${article.time}` : ""}
        </span>
      </div>
    </article>
  );
}