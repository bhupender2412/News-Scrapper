import { useCallback, useEffect, useRef, useState } from "react";
import FilterBar from "./components/FilterBar";
import ArticleCard from "./components/ArticleCard";

const API_BASE = "http://localhost:5000";
const STORAGE_KEY = "ballotix_news_scrapper_last_articles";

export default function App() {
  const [locations, setLocations] = useState({});
  const [availableTopics, setAvailableTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState("all");
  const [availableSources, setAvailableSources] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [archivedDates, setArchivedDates] = useState([]);
  const [activeArchiveDate, setActiveArchiveDate] = useState("");
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
  const [selectedCityPill, setSelectedCityPill] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [liveSyncStatus, setLiveSyncStatus] = useState("");
  const [scrapeStats, setScrapeStats] = useState(null);
  const [error, setError] = useState("");

  const lastScrapeSigRef = useRef("");

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
    setSelectedCityPill("All");
    setActiveArchiveDate("");
    setScrapeStats(null);

    const currentSig = JSON.stringify({
      sources: [...selectedSources].sort(),
      topic: selectedTopic,
      fromDate,
      toDate,
      state: selectedState,
      city: selectedCity,
      keyword: searchQuery.trim().toLowerCase(),
      allStatesSweep,
    });

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

      const incoming = data.articles || [];

      if (lastScrapeSigRef.current === currentSig) {
        setArticles((prev) => {
          const seen = new Set(
            incoming.map((a) => `${a.headline.toLowerCase().slice(0, 65)}|${a.date}`)
          );
          const keptPrev = prev.filter(
            (a) => !seen.has(`${a.headline.toLowerCase().slice(0, 65)}|${a.date}`)
          );
          const merged = [...incoming, ...keptPrev];
          merged.sort((a, b) =>
            (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
          );
          return merged;
        });
      } else {
        setArticles(incoming);
        lastScrapeSigRef.current = currentSig;
      }

      setScrapeStats(data.stats || null);
      fetchArchiveDates();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLiveRssSync = useCallback(async () => {
    if (selectedSources.length === 0) return;

    setSyncingLive(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/rss-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: selectedSources,
          state: selectedState,
          city: selectedCity,
          topic: selectedTopic,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Live RSS sync failed.");
      }

      const incoming = data.articles || [];
      if (incoming.length > 0) {
        setArticles((prev) => {
          const seen = new Set(
            incoming.map((a) => `${a.headline.toLowerCase().slice(0, 65)}|${a.date}`)
          );
          const keptOld = prev.filter(
            (a) => !seen.has(`${a.headline.toLowerCase().slice(0, 65)}|${a.date}`)
          );
          const merged = [...incoming, ...keptOld];
          merged.sort((a, b) =>
            (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date)
          );
          return merged;
        });
      }

      setLiveSyncStatus(
        data.newCount > 0
          ? `+${data.newCount} new at ${data.syncedAt}`
          : `Synced ${data.syncedAt}`
      );
      fetchArchiveDates();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingLive(false);
    }
  }, [selectedSources, selectedState, selectedCity, selectedTopic]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      handleLiveRssSync();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleLiveRssSync]);

  const handleLoadArchivedDate = async (date) => {
    setLoading(true);
    setError("");
    setSelectedCategory("All");
    setSelectedCityPill("All");
    setActiveArchiveDate(date);
    setScrapeStats(null);
    lastScrapeSigRef.current = "";
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

  const categoryCounts = articles.reduce((acc, article) => {
    const key = article.category || "Civic News";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const categories = ["All", ...Object.keys(categoryCounts)];

  const cityCountsMap = articles.reduce((acc, article) => {
    const key = article.city || "State-Wide";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sortedCities = Object.entries(cityCountsMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cityName]) => cityName);
  const cityPills = ["All", ...sortedCities];

  const filteredArticles = articles.filter((article) => {
    if (selectedCategory !== "All" && article.category !== selectedCategory) {
      return false;
    }
    if (selectedCityPill !== "All" && (article.city || "State-Wide") !== selectedCityPill) {
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

      const stateSlug = selectedState
        ? `-${selectedState.toLowerCase().replace(/\s+/g, "-")}`
        : "";
      const citySlug =
        selectedCityPill !== "All"
          ? `-${selectedCityPill.toLowerCase().replace(/\s+/g, "-")}`
          : "";
      const dateSlug = fromDate || new Date().toISOString().split("T")[0];

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ballotix-news${stateSlug}${citySlug}-${dateSlug}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Clean Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Ballotix News Scrapper
                </h1>
                {liveSyncStatus && (
                  <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {liveSyncStatus}
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-slate-500">
                Indian Civic, Governance & Policy News Aggregator
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Live RSS + Auto Sync Segmented Control */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={handleLiveRssSync}
                disabled={syncingLive || loading}
                title="Sync latest articles directly from Tribune & newspaper RSS feeds"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full bg-emerald-500 ${
                    syncingLive ? "animate-ping" : ""
                  }`}
                />
                <span>{syncingLive ? "Syncing..." : "Live RSS"}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoRefresh((prev) => !prev)}
                title="Toggle 5-minute automatic RSS refresh"
                className={`hidden sm:inline-flex items-center px-2.5 py-2 text-[11px] font-semibold border-l border-slate-200 cursor-pointer transition-colors ${
                  autoRefresh
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                Auto 5m
              </button>
            </div>

            {/* Export Buttons */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => handleExport("txt")}
                disabled={filteredArticles.length === 0}
                className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
              >
                .TXT
              </button>
              <button
                onClick={() => handleExport("csv")}
                disabled={filteredArticles.length === 0}
                className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 border-l border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
              >
                .CSV
              </button>
            </div>

            {/* Primary Scrape Button */}
            <button
              onClick={handleScrape}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-xs transition-all"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Scraping...</span>
                </>
              ) : (
                <span>Scrape News</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Compact Filter Bar */}
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
          allStatesSweep={allStatesSweep}
          onAllStatesSweepChange={setAllStatesSweep}
          archivedDates={archivedDates}
          activeArchiveDate={activeArchiveDate}
          onLoadArchivedDate={handleLoadArchivedDate}
        />

        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Lightweight Filter Pills & Results Summary */}
        {articles.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="font-medium text-slate-700">
                Showing{" "}
                <span className="font-bold text-slate-900">
                  {filteredArticles.length}
                </span>
                {filteredArticles.length !== articles.length
                  ? ` of ${articles.length}`
                  : ""}{" "}
                verified civic articles
              </div>

              {scrapeStats && (
                <div className="font-mono-tech text-[11px] text-slate-500">
                  {scrapeStats.newlyExtracted} new • {scrapeStats.reusedFromArchive} archived
                  {scrapeStats.cappedRemaining > 0
                    ? ` • ${scrapeStats.cappedRemaining} remaining in queue`
                    : ""}
                </div>
              )}
            </div>

            {/* Topic Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => {
                const count = cat === "All" ? articles.length : categoryCounts[cat] || 0;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                      active
                        ? "bg-blue-600 text-white shadow-2xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`text-[11px] ${
                        active ? "text-blue-100" : "text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* City Pills (shown when multiple cities are extracted) */}
            {sortedCities.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400 mr-1">
                  Cities:
                </span>
                {cityPills.map((cityName) => {
                  const count =
                    cityName === "All" ? articles.length : cityCountsMap[cityName] || 0;
                  const active = selectedCityPill === cityName;
                  return (
                    <button
                      key={cityName}
                      type="button"
                      onClick={() => setSelectedCityPill(cityName)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all ${
                        active
                          ? "bg-slate-900 text-white"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>{cityName}</span>
                      <span
                        className={`text-[10px] ${
                          active ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Loading Skeletons / Empty State / Feed */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 animate-pulse"
              >
                <div className="flex gap-2">
                  <div className="h-5 w-28 bg-slate-200 rounded-md" />
                  <div className="h-5 w-24 bg-slate-100 rounded-md" />
                </div>
                <div className="h-6 w-3/4 bg-slate-200 rounded-md" />
                <div className="space-y-2 pt-1">
                  <div className="h-4 w-full bg-slate-100 rounded" />
                  <div className="h-4 w-5/6 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-12 text-center space-y-2 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900">
              No articles loaded yet
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Choose a civic topic, state, or time window above and click{" "}
              <span className="font-semibold text-blue-600">Scrape News</span> or{" "}
              <span className="font-semibold text-slate-800">Live RSS</span>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredArticles.map((article, idx) => (
              <ArticleCard key={`${article.url}-${idx}`} article={article} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}