# India Political & Opposition News Scraper

A full-stack, solo-developer news scraping and filtering dashboard built with **Node.js (Express)** and **React (Vite + Tailwind CSS)**. It collects political statements, social media posts by Indian politicians, and opposition rebuttals across **15 major Indian English newspapers**, automatically geo-tags every article across all **28 States and 8 Union Territories**, and exports clean `.TXT` reports with 60–70 word summaries.

---

## Features

- **15 Major Indian English Newspapers:** Scrapes *The Tribune*, *The Hindu*, *The Indian Express*, *The Times of India*, *Hindustan Times*, *Deccan Herald*, *The Telegraph*, *The New Indian Express*, *Deccan Chronicle*, *The Statesman*, *Free Press Journal*, *Business Standard*, *Mint*, *The Pioneer*, and *The Assam Tribune*.
- **Two-Stage Filtering Pipeline:**
  - **Stage 1 — Political & Opposition Filter:** Scans headlines and opening paragraphs for Indian political parties, titles (`PM`, `CM`, `MP`, `MLA`, `Minister`, `Opposition`), social media cues (`tweeted`, `posted on X`), and opposition reaction verbs (`slammed`, `hit back`, `targeted`, `demanded`, `questioned`). Non-political news is discarded automatically.
  - **Stage 2 — Pan-India Geo-Tagging:** Checks article datelines (first 60 characters), headlines, and body text against a dataset of all **28 Indian States, 8 Union Territories**, and major cities/districts, automatically resolving cities to their parent State/UT (defaulting to `National / New Delhi` for central-only news).
- **Historical Date Range Search:** Query news from any past date range (`From Date` to `To Date`), combined with State, City, and keyword filters.
- **Full Article Extraction & URL Decoding:** Decodes Google News RSS links to direct publisher URLs and extracts clean article bodies using JSON-LD (`articleBody`), Cheerio HTML parsing, and a reader fallback.
- **One-Click `.TXT` Export:** Generates a structured, ad-free `.txt` report with a **60–70 word summary** extracted from each article's body right beside its URL.

---

## Tech Stack

- **Backend:** Node.js, Express, CORS, Axios, Cheerio, `rss-parser`, `google-news-url-decoder`
- **Frontend:** React, Vite, Tailwind CSS

---

## Project Structure

```text
News-Scrapper/
├── backend/
│   ├── data/
│   │   ├── indiaLocations.json      # All 28 States, 8 UTs & major cities/districts
│   │   ├── newsSources.json         # 15 Indian English newspaper configurations
│   │   └── politicalKeywords.json   # Parties, titles, post cues & opposition verbs
│   ├── scrapers/
│   │   └── newsScraper.js           # Unified multi-newspaper scraper & body extractor
│   ├── utils/
│   │   ├── locationExtractor.js     # Dateline, headline & body Pan-India geo-tagger
│   │   ├── politicalFilter.js       # Political statement & opposition rebuttal filter
│   │   └── txtFormatter.js          # Clean .TXT report & 60–70 word summary generator
│   ├── server.js                    # Express API (/api/locations, /api/sources, /api/scrape, /api/download-txt)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ArticleCard.jsx      # Displays headline, State/City badges, category & snippet
│   │   │   └── FilterBar.jsx        # Newspaper checkboxes, State/City dropdowns, date range & search
│   │   ├── App.jsx                  # Main dashboard & .TXT export controls
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── .gitignore
└── README.md