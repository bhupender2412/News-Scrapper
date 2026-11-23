export default function ArticleCard({ article }) {
  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
          {article.state}
        </span>
        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
          {article.city}
        </span>
        <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
          {article.category}
        </span>
      </div>

      <h2 className="text-lg font-bold text-slate-900 leading-snug mb-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-600 transition-colors"
        >
          {article.headline}
        </a>
      </h2>

      <p className="text-sm text-slate-600 line-clamp-3 mb-3">
        {article.content}
      </p>

      <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>
          {article.source} &bull; {article.date}
        </span>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 font-medium hover:underline"
        >
          Read Original &rarr;
        </a>
      </div>
    </article>
  );
}