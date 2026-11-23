import { useEffect, useState } from "react";
import FilterBar from "./components/FilterBar";
import ArticleCard from "./components/ArticleCard";

const API_BASE = "http://localhost:5000";

export default function App() {
  const [locations, setLocations] = useState({});
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/locations`).then((res) => res.json()),
      fetch(`${API_BASE}/api/sources`).then((res) => res.json()),
    ])
      .then(([locData, srcData]) => {
        setLocations(locData);
        setAvailableSources(srcData);
        setSelectedSources(srcData.map((s) => s.id)); // Select all by default
      })
      .catch(() =>
        setError("Could not connect to backend. Make sure it is running on port 5000.")
      );
  }, []);

  const handleToggleSource = (sourceId) => {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((s) => s !== sourceId) : [...prev, sourceId]
    );
  };

  const handleSelectAllSources = () => {
    setSelectedSources(availableSources.map((s) => s.id));
  };

  const handleClearSources = () => {
    setSelectedSources([]);
  };

  const handleScrape = async () => {
    if (selectedSources.length === 0) {
      setError("Please select at least one newspaper.");
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      setError("From Date cannot be later than To Date.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: selectedSources,
          fromDate,
          toDate,
          state: selectedState,
          city: selectedCity,
          keyword: searchQuery,
          limitPerSource: 25,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Scraping failed.");
      }

      setArticles(data.articles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTxt = () => {
    window.location.href = `${API_BASE}/api/download-txt`;
  };

  const filteredArticles = articles.filter((article) => {
    if (selectedState && article.state !== selectedState) return false;
    if (selectedCity && article.city !== selectedCity) return false;
    if (fromDate && article.date < fromDate) return false;
    if (toDate && article.date > toDate) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inHeadline = article.headline.toLowerCase().includes(q);
      const inContent = article.content.toLowerCase().includes(q);
      if (!inHeadline && !inContent) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header & Action Buttons */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              India Political & Opposition News Scraper
            </h1>
            <p className="text-sm text-slate-500">
              Pan-India geo-tagged political statements, social posts & opposition rebuttals
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleScrape}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors"
            >
              {loading ? "Scraping..." : "Scrape Political News"}
            </button>

            <button
              onClick={handleDownloadTxt}
              disabled={articles.length === 0}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              Download .TXT File
            </button>
          </div>
        </header>

        {/* Filters */}
        <FilterBar
          locations={locations}
          availableSources={availableSources}
          selectedSources={selectedSources}
          onToggleSource={handleToggleSource}
          onSelectAllSources={handleSelectAllSources}
          onClearSources={handleClearSources}
          selectedState={selectedState}
          onStateChange={setSelectedState}
          selectedCity={selectedCity}
          onCityChange={setSelectedCity}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          fromDate={fromDate}
          onFromDateChange={setFromDate}
          toDate={toDate}
          onToDateChange={setToDate}
        />

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-slate-600 font-medium">
          Showing {filteredArticles.length} of {articles.length} verified political articles
        </div>

        {/* Articles List */}
        {filteredArticles.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 text-sm">
            {loading
              ? "Fetching and filtering political news across Indian English newspapers..."
              : 'No articles to display yet. Click "Scrape Political News" to start.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredArticles.map((article, idx) => (
              <ArticleCard key={`${article.url}-${idx}`} article={article} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}