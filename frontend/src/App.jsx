import { useEffect, useState } from "react";
import FilterBar from "./components/FilterBar";
import ArticleCard from "./components/ArticleCard";

const API_BASE = "http://localhost:5000";
const STORAGE_KEY = "news_scrapper_last_articles";

export default function App() {
  const [locations, setLocations] = useState({});
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [archivedDates, setArchivedDates] = useState([]);
  const [allStatesSweep, setAllStatesSweep] = useState(true);
  const [articles, setArticles] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchArchiveDates = () => {
    fetch(`${API_BASE}/api/archive/dates`)
      .then((res) => res.json())
      .then((data) => setArchivedDates(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/locations`).then((res) => res.json()),
      fetch(`${API_BASE}/api/sources`).then((res) => res.json()),
      fetch(`${API_BASE}/api/topics`).then((res) => res.json()),
    ])
      .then(([locData, srcData, topicData]) => {
        setLocations(locData);
        setAvailableSources(srcData);
        setSelectedSources(srcData.map((s) => s.id));
        setAvailableTopics(Array.isArray(topicData) ? topicData : []);
      })
      .catch(() =>
        setError("Could not connect to backend. Make sure it is running on port 5000.")
      );

    fetchArchiveDates();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
    } catch {
      // Ignore storage quota errors
    }
  }, [articles]);

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
    setSelectedCategory("All");

    try {
      const res = await fetch(`${API_BASE}/api/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: selectedSources,
          topic: selectedTopic,
          fromDate,
          toDate,
          state: selectedState,
          city: selectedCity,
          keyword: searchQuery,
          allStatesSweep,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Scraping failed.");
      }

      setArticles(data.articles || []);
      fetchArchiveDates();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadArchivedDate = async (date) => {
    setLoading(true);
    setError("");
    setSelectedCategory("All");
    try {
      const res = await fetch(`${API_BASE}/api/archive/${date}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error("Could not load archived date.");

      setFromDate(date);
      setToDate(date);
      setArticles(data.articles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["All", ...new Set(articles.map((a) => a.category).filter(Boolean))];

  // Only filter loaded articles by the topic pills above the list
  const filteredArticles = articles.filter((article) => {
    if (selectedCategory !== "All" && article.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const handleExport = async (format) => {
    if (filteredArticles.length === 0) return;

    try {
      const res = await fetch(`${API_BASE}/api/export-${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articles: filteredArticles }),
      });

      if (!res.ok) throw new Error(`Failed to export ${format.toUpperCase()} file.`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ballotix-news-${fromDate || new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header & Action Buttons */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Ballotix News Scraper
            </h1>
            <p className="text-sm text-slate-500">
              Governance, Health, Education, Economy & Civic news across all Indian States & UTs — zero entertainment, cricket, or crime
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleScrape}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors"
            >
              {loading ? "Scraping..." : "Scrape News"}
            </button>

            <button
              onClick={() => handleExport("txt")}
              disabled={filteredArticles.length === 0}
              className="px-3.5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 cursor-pointer transition-colors"
            >
              Download .TXT
            </button>

            <button
              onClick={() => handleExport("csv")}
              disabled={filteredArticles.length === 0}
              className="px-3.5 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 disabled:opacity-40 cursor-pointer transition-colors"
            >
              Download .CSV
            </button>
          </div>
        </header>

        {/* Filters */}
        <FilterBar
          locations={locations}
          availableTopics={availableTopics}
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
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

        {/* All-States Sweep Toggle & Date-Wise Archive Strip */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allStatesSweep}
              onChange={(e) => setAllStatesSweep(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Enable Pan-India All-States Sweep (used when "All States & UTs" is selected)
          </label>

          {archivedDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500">Saved Archive (Date-Wise):</span>
              {archivedDates.slice(0, 14).map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => handleLoadArchivedDate(entry.date)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
                >
                  {entry.date} ({entry.count})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Topic Pills & Results Count */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="text-sm text-slate-600 font-medium">
            Showing {filteredArticles.length} of {articles.length} verified articles
          </div>
        </div>

        {/* Articles List */}
        {filteredArticles.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-500 text-sm">
            {loading
              ? "Fetching holistic news across Indian English newspapers..."
              : 'No articles to display yet. Pick a topic, state, or keyword and click "Scrape News".'}
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