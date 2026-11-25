# Ballotix News Scrapper

**Indian Civic, Governance & Policy Intelligence Aggregator**

Ballotix News Scrapper is a full-stack news intelligence platform built to extract, classify, archive, and export verified public-interest journalism across Indian states and cities. It combines regional publisher RSS feeds with multi-stage city-expanded search queries, strict state-to-city geo-validation, and noise filtering to surface governance, health, education, economy, infrastructure, judiciary, and social welfare reporting.

---

## Key Features

- **State & City-Wise Separate Extraction:** Selecting any Indian State or Union Territory automatically runs state-wide queries alongside individual and batched city-level queries from `indiaLocations.json`. Interactive **City Filter Pills** let you isolate and export news for individual cities (e.g., *Ludhiana*, *Amritsar*, *Shimla*, *Dharamshala*) or *State-Wide* coverage.
- **Strict Geo-Validation:** Case-sensitive proper-noun and dateline matching prevents cross-state leaks and acronym collisions (such as airline tickers or generic agricultural terms).
- **Live RSS Sync & Continuous Polling:** Dedicated regional RSS feeds—including *The Tribune* state and city feeds alongside *The Hindu*, *The Indian Express*, *Hindustan Times*, *The Times of India*, *Deccan Herald*, *NDTV*, *News18*, *ThePrint*, *Mint*, *Business Standard*, and *The Telegraph*—power instant **Live RSS** sync (`POST /api/rss-live`), a 5-minute UI auto-refresh toggle, and a 15-minute background archival poller.
- **Holistic Civic Classification & Noise Exclusion:** Automatically tags articles into 7 civic domains while filtering out entertainment, cricket/sports, and routine crime reports.
- **Full-Text Body Extraction & Telemetry:** Uses a 15-worker concurrency pool with JSON-LD parsing, HTML body extraction, and `r.jina.ai` fallback, displaying live scrape audit telemetry (`new`, `archived`, and `remaining in queue`) with seamless multi-batch merging.
- **Date-Wise IST Archiving:** Stores deduplicated articles in `backend/archive/YYYY-MM-DD.json` using `Asia/Kolkata` (IST) dates and timestamps for instant historical lookup.
- **Excel-Ready `.CSV` & `.TXT` Exports:** Exports the active state, city, or topic selection with UTF-8 BOM encoding (`\uFEFF`) and text-formatted ISO dates so Indian Rupee (`₹`) symbols and dates render cleanly in Microsoft Excel.

---

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS (`Plus Jakarta Sans`, `Newsreader`, `JetBrains Mono`)
- **Backend:** Node.js, Express, `axios`, `cheerio`, `rss-parser`, `google-news-url-decoder`
- **Storage & Tooling:** Local date-partitioned JSON archive, `nodemon` (configured to ignore `archive/`)

---

## Project Structure

```text
News-Scrapper/
├── backend/
│   ├── archive/                  # Date-wise JSON archives (YYYY-MM-DD.json)
│   ├── data/
│   │   ├── indiaLocations.json   # States, UTs, and city/district mappings
│   │   ├── newsSources.json      # National & regional/state RSS feed configs
│   │   └── topicConfig.json      # Civic domain keywords & noise blocklists
│   ├── scrapers/
│   │   └── newsScraper.js        # Multi-source scraper & live RSS sync engine
│   ├── utils/
│   │   ├── csvFormatter.js       # UTF-8 BOM & Excel-safe CSV generator
│   │   ├── locationExtractor.js  # Case-sensitive state & city geo-resolver
│   │   ├── newsArchive.js        # Deduplicated date-wise archive manager
│   │   ├── topicFilter.js        # Civic topic classifier & noise filter
│   │   └── txtFormatter.js       # Structured plain-text brief exporter
│   ├── nodemon.json              # Ignores archive/ writes during dev
│   ├── package.json
│   └── server.js                 # Express API & 15-minute RSS poller
├── frontend/
│   ├── index.html
│   ├── package.json
│   └── src/
│       ├── App.jsx               # Main dashboard, telemetry, topic/city pills
│       ├── index.css             # Typography & scrollbar styling
│       └── components/
│           ├── ArticleCard.jsx   # Editorial card with expandable full text
│           └── FilterBar.jsx     # Compact search, date, source & archive bar
└── README.md