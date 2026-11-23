export default function FilterBar({
  locations,
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

      {/* State, City & Keyword Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
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
          placeholder="Search leader, party, or keyword..."
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Date Range Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}