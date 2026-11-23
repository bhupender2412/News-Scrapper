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
}) {
  const states = Object.keys(locations).sort();
  const cities = selectedState ? locations[selectedState] || [] : [];

  const applyDatePreset = (daysAgo) => {
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
    onFromDateChange("");
    onToDateChange("");
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
      {/* Newspaper Sources */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            English Newspapers ({selectedSources.length}/{availableSources.length} selected)
          </span>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={onSelectAllSources}
              className="text-blue-600 hover:underline font-medium cursor-pointer"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={onClearSources}
              className="text-slate-500 hover:underline font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {availableSources.map((source) => (
            <label
              key={source.id}
              className="inline-flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedSources.includes(source.id)}
                onChange={() => onToggleSource(source.id)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              {source.name}
            </label>
          ))}
        </div>
      </div>

      {/* Topic, State, City & Keyword Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        <select
          value={selectedTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Holistic Topics</option>
          {availableTopics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={selectedState}
          onChange={(e) => {
            onStateChange(e.target.value);
            onCityChange("");
          }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All States & UTs</option>
          <option value="National">National</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <select
          value={selectedCity}
          onChange={(e) => onCityChange(e.target.value)}
          disabled={!selectedState || cities.length === 0}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Any topic or keyword (e.g., AIIMS, NEP)..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quick Date Presets + All-Time + Date Pickers */}
      <div className="space-y-2 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Time Range:</span>
          <button
            type="button"
            onClick={setAllTime}
            className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              !fromDate && !toDate
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700"
            }`}
          >
            All Time
          </button>
          {[
            { label: "Today", days: 0 },
            { label: "Yesterday", days: 1 },
            { label: "Last 7 Days", days: 7 },
            { label: "Last 30 Days", days: 30 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyDatePreset(preset.days)}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">From Date (leave blank for All Time)</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">To Date (leave blank for All Time)</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}