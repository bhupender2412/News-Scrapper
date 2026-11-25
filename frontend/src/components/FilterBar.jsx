import { useState } from "react";

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function FilterBar({
  locations,
  availableTopics,
  selectedTopic,
  onTopicChange,
  availableSources,
  selectedSources,
  onToggleSource,
  onSelectAllSources,
  onClearSources,
  selectedState,
  onStateChange,
  selectedCity,
  onCityChange,
  searchQuery,
  onSearchChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  allStatesSweep,
  onAllStatesSweepChange,
  archivedDates = [],
  activeArchiveDate = "",
  onLoadArchivedDate,
}) {
  const [showSources, setShowSources] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);

  const states = Object.keys(locations).sort();
  const cities = selectedState ? locations[selectedState] || [] : [];

  const todayStr = formatDate(new Date());
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = formatDate(yesterdayObj);

  const getActivePreset = () => {
    if (!fromDate && !toDate) return "all";
    if (fromDate === todayStr && toDate === todayStr) return "today";
    if (fromDate === yesterdayStr && toDate === yesterdayStr) return "yesterday";

    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    if (fromDate === formatDate(d7) && toDate === todayStr) return "7d";

    const d30 = new Date();
    d30.setDate(d30.getDate() - 30);
    if (fromDate === formatDate(d30) && toDate === todayStr) return "30d";

    return "custom";
  };

  const activePreset = getActivePreset();

  const applyDatePreset = (daysAgo) => {
    setShowCustomDates(false);
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - daysAgo);

    if (daysAgo === 1) {
      onFromDateChange(formatDate(start));
      onToDateChange(formatDate(start));
    } else {
      onFromDateChange(formatDate(start));
      onToDateChange(formatDate(today));
    }
  };

  const setAllTime = () => {
    setShowCustomDates(false);
    onFromDateChange("");
    onToDateChange("");
  };

  return (
    <section className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
      {/* Row 1: Primary Search & Region Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Civic Topic */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Civic Topic
          </label>
          <div className="relative">
            <select
              value={selectedTopic}
              onChange={(e) => onTopicChange(e.target.value)}
              className="w-full appearance-none border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-sm bg-slate-50/60 hover:bg-white focus:bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            >
              <option value="all">All Holistic Topics</option>
              {availableTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <svg className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* State / UT */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            State / Union Territory
          </label>
          <div className="relative">
            <select
              value={selectedState}
              onChange={(e) => {
                onStateChange(e.target.value);
                onCityChange("");
              }}
              className="w-full appearance-none border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-sm bg-slate-50/60 hover:bg-white focus:bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            >
              <option value="">All States & UTs</option>
              <option value="National">National / Central</option>
              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            <svg className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* City / District */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            City / District
          </label>
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              disabled={!selectedState || cities.length === 0}
              className="w-full appearance-none border border-slate-200 rounded-xl pl-3.5 pr-9 py-2.5 text-sm bg-slate-50/60 hover:bg-white focus:bg-white font-medium text-slate-800 disabled:bg-slate-100/70 disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            >
              <option value="">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <svg className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Keyword Search */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Keyword Search
          </label>
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="e.g., AIIMS, NEP, Budget..."
              className="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm bg-slate-50/60 hover:bg-white focus:bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Compact Time Window, Sources Toggle, Archive Dropdown & Sweep */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
        {/* Time Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100/90">
            {[
              { id: "all", label: "All Time", action: setAllTime },
              { id: "today", label: "Today", action: () => applyDatePreset(0) },
              { id: "yesterday", label: "Yesterday", action: () => applyDatePreset(1) },
              { id: "7d", label: "7 Days", action: () => applyDatePreset(7) },
              { id: "30d", label: "30 Days", action: () => applyDatePreset(30) },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.action}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                  activePreset === item.id && !showCustomDates
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowCustomDates((prev) => !prev)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
                showCustomDates || activePreset === "custom"
                  ? "bg-white text-blue-600 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Right Controls: Newspapers Drawer Toggle, Archive Selector & Sweep */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSources((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
              showSources
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Newspapers</span>
            <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 font-mono-tech text-[11px]">
              {selectedSources.length}/{availableSources.length}
            </span>
            <svg
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                showSources ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {archivedDates.length > 0 && (
            <div className="relative">
              <select
                value={activeArchiveDate}
                onChange={(e) => {
                  if (e.target.value) onLoadArchivedDate(e.target.value);
                }}
                aria-label="Saved Date-Wise Archive"
                className="appearance-none border border-slate-200 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
              >
                <option value="">Saved Archive ({archivedDates.length} days)</option>
                {archivedDates.map((entry) => (
                  <option key={entry.date} value={entry.date}>
                    {entry.date} — {entry.count} articles
                  </option>
                ))}
              </select>
              <svg className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}

          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 px-2 py-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allStatesSweep}
              onChange={(e) => onAllStatesSweepChange(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>All-States Sweep</span>
          </label>
        </div>
      </div>

      {/* Expandable Custom Date Pickers */}
      {(showCustomDates || activePreset === "custom") && (
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono-tech bg-slate-50/70 focus:bg-white text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono-tech bg-slate-50/70 focus:bg-white text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={setAllTime}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              Reset dates
            </button>
          )}
        </div>
      )}

      {/* Expandable Newspaper Sources Drawer */}
      {showSources && (
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">
              Select English Publications
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSelectAllSources}
                className="text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={onClearSources}
                className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {availableSources.map((source) => {
              const active = selectedSources.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => onToggleSource(source.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-all ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {source.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}