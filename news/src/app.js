import { createAiAssistant } from './ai/ai-assistant.js';

    // LocalStorage Keys (v4 verified)
    const LS_ARTICLES_KEY = 'rss_live_articles_v4';
    const LS_SOURCES_KEY = 'rss_live_sources_v4';
    const LS_CATEGORIES_KEY = 'rss_live_categories_v4';
    const LS_LAST_FETCH_KEY = 'rss_last_fetch_timestamp_v4';
    const LS_WORD_FILTERS_KEY = 'rss_word_filters_v1';
    const LS_REGION_MIGRATION_KEY = 'rss_source_regions_v1';
    const LS_EGYPT_FEEDS_MIGRATION_KEY = 'rss_egypt_feeds_v1';
    const LS_BLOOMBERG_FEEDS_MIGRATION_KEY = 'rss_bloomberg_feeds_v1';
    const REGIONS = ['egypt', 'mena', 'world'];

    // Default RSS sources. Region describes the source, not each story's location.
    const VERIFIED_SOURCES = [
      { id: 's1', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', priority: 10, enabled: true, region: 'world' },
      { id: 's2', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', priority: 9, enabled: true, region: 'world' },
      { id: 's3', name: 'BBC Arabic', url: 'https://feeds.bbci.co.uk/arabic/rss.xml', priority: 9, enabled: true, region: 'world' },
      { id: 's4', name: 'OilPrice.com', url: 'https://oilprice.com/rss/main', priority: 9, enabled: true, region: 'world' },
      { id: 's5', name: 'CNBC Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', priority: 8, enabled: true, region: 'world' },
      { id: 's6', name: 'Al Jazeera Arabic', url: 'https://www.aljazeera.net/aljazeerarss/a7c6e2fb-b7f7-42f4-8354-84598160d298/73d0e1b4-532f-45ef-b135-bfdff8b8cab9', priority: 8, enabled: true, region: 'mena' },
      { id: 's7', name: 'Al Jazeera English', url: 'https://www.aljazeera.com/xml/rss/all.xml', priority: 8, enabled: true, region: 'mena' },
      { id: 's8', name: 'MarketWatch', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', priority: 8, enabled: true, region: 'world' },
      { id: 's9', name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', priority: 8, enabled: true, region: 'world' },
      { id: 's10', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', priority: 7, enabled: true, region: 'world' },
      { id: 's11', name: 'RT Arabic', url: 'https://arabic.rt.com/rss/', priority: 7, enabled: true, region: 'world' },
      { id: 's12', name: 'Egypt Independent', url: 'https://www.egyptindependent.com/feed/', priority: 8, enabled: true, region: 'egypt' },
      { id: 's13', name: 'Al Masry Al Youm', url: 'https://www.almasryalyoum.com/rss/rssfeed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's14', name: 'Youm7 Politics', url: 'https://www.youm7.com/rss/SectionRss?SectionID=319', priority: 8, enabled: true, region: 'egypt' },
      // The supplied Ahram URL could not be confirmed as an XML feed; keep it available for manual checking.
      { id: 's15', name: 'Ahram Gate', url: 'https://gate.ahram.org.eg/RSS.aspx', priority: 8, enabled: false, region: 'egypt' },
      { id: 's16', name: 'Shorouk News', url: 'https://www.shorouknews.com/rss/main', priority: 8, enabled: true, region: 'egypt' },
      { id: 's17', name: 'Egypt Oil & Gas', url: 'https://egyptoil-gas.com/news/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's18', name: 'Al Borsa News', url: 'https://www.alborsaanews.com/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's19', name: 'Amwal Al Ghad', url: 'https://amwalalghad.com/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's20', name: 'Hapi', url: 'https://hapi.eg/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's21', name: 'Masrawy', url: 'https://www.masrawy.com/rss/feed/25/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1', priority: 8, enabled: true, region: 'egypt' },
      { id: 's22', name: 'Al Mal News', url: 'https://almalnews.com/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's23', name: 'Enterprise Arabic', url: 'https://enterprise.press/ar/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's24', name: 'Invest-Gate', url: 'https://invest-gate.me/feed', priority: 8, enabled: true, region: 'egypt' },
      { id: 's29', name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss', priority: 9, enabled: true, region: 'world' },
      { id: 's30', name: 'Bloomberg Politics', url: 'https://feeds.bloomberg.com/politics/news.rss', priority: 9, enabled: true, region: 'world' },
      { id: 's31', name: 'Bloomberg Technology', url: 'https://feeds.bloomberg.com/technology/news.rss', priority: 9, enabled: true, region: 'world' },
      { id: 's32', name: 'Bloomberg Wealth', url: 'https://feeds.bloomberg.com/wealth/news.rss', priority: 9, enabled: true, region: 'world' }
    ];

    const DEFAULT_CATEGORIES = {
      oil: {
        label: "Oil",
        keywords: [
          { w: "opec", s: 10 }, { w: "أوبك", s: 10 },
          { w: "brent", s: 8 }, { w: "برنت", s: 8 },
          { w: "wti", s: 8 },
          { w: "crude", s: 6 }, { w: "خام", s: 6 },
          { w: "production cut", s: 8 }, { w: "خفض الإنتاج", s: 8 },
          { w: "oil", s: 4 }, { w: "نفط", s: 4 },
          { w: "petroleum", s: 5 }, { w: "بترول", s: 5 },
          { w: "refinery", s: 5 }, { w: "مصافي", s: 5 },
          { w: "barrel", s: 4 }, { w: "برميل", s: 4 },
          { w: "energy", s: 4 }, { w: "طاقة", s: 4 }
        ]
      },
      economy: {
        label: "Economy",
        keywords: [
          { w: "federal reserve", s: 10 }, { w: "البنك المركزي", s: 10 },
          { w: "fed", s: 6 },
          { w: "interest rate", s: 8 }, { w: "سعر الفائدة", s: 8 }, { w: "أسعار الفائدة", s: 8 },
          { w: "inflation", s: 7 }, { w: "تضخم", s: 7 }, { w: "التضخم", s: 7 },
          { w: "gdp", s: 6 }, { w: "الناتج المحلي", s: 6 },
          { w: "recession", s: 7 }, { w: "ركود", s: 7 },
          { w: "economy", s: 4 }, { w: "اقتصاد", s: 4 }, { w: "الاقتصاد", s: 4 },
          { w: "debt", s: 5 }, { w: "ديون", s: 5 },
          { w: "tariff", s: 6 }, { w: "جمارك", s: 6 }
        ]
      },
      gold: {
        label: "Gold",
        keywords: [
          { w: "gold", s: 8 }, { w: "ذهب", s: 8 }, { w: "الذهب", s: 8 },
          { w: "ounce", s: 6 }, { w: "أوقية", s: 6 },
          { w: "bullion", s: 7 }, { w: "سبائك", s: 7 },
          { w: "precious metals", s: 6 }, { w: "معادن ثمينة", s: 6 }
        ]
      },
      stocks: {
        label: "Stocks",
        keywords: [
          { w: "nasdaq", s: 8 }, { w: "ناسداك", s: 8 },
          { w: "s&p", s: 8 }, { w: "dow", s: 7 }, { w: "داو جونز", s: 7 },
          { w: "wall street", s: 6 }, { w: "بورصة", s: 6 }, { w: "البورصة", s: 6 },
          { w: "stocks", s: 5 }, { w: "shares", s: 5 }, { w: "أسهم", s: 5 }, { w: "الأسهم", s: 5 },
          { w: "equities", s: 5 }, { w: "rally", s: 4 }
        ]
      },
      politics: {
        label: "Politics",
        keywords: [
          { w: "president", s: 6 }, { w: "رئيس", s: 6 },
          { w: "parliament", s: 8 }, { w: "برلمان", s: 8 }, { w: "البرلمان", s: 8 },
          { w: "government", s: 5 }, { w: "حكومة", s: 5 }, { w: "الحكومة", s: 5 },
          { w: "sanctions", s: 9 }, { w: "عقوبات", s: 9 },
          { w: "election", s: 7 }, { w: "انتخابات", s: 7 },
          { w: "minister", s: 5 }, { w: "وزير", s: 5 },
          { w: "ceasefire", s: 8 }, { w: "هدنة", s: 8 },
          { w: "war", s: 6 }, { w: "حرب", s: 6 }
        ]
      },
      tech: {
        label: "Tech",
        keywords: [
          { w: "nvidia", s: 10 }, { w: "semiconductor", s: 8 }, { w: "رقائق", s: 8 },
          { w: "artificial intelligence", s: 8 }, { w: "ذكاء اصطناعي", s: 8 }, { w: "AI", s: 6 },
          { w: "chips", s: 6 }, { w: "microsoft", s: 6 }, { w: "google", s: 6 },
          { w: "apple", s: 6 }, { w: "software", s: 5 }, { w: "تكنولوجيا", s: 5 },
          { w: "startup", s: 5 }
        ]
      },
      construction: {
        label: "Construction",
        keywords: [
          { w: "infrastructure", s: 8 }, { w: "بنية تحتية", s: 8 },
          { w: "contractor", s: 6 }, { w: "مقاولات", s: 6 },
          { w: "concrete", s: 6 }, { w: "خرسانة", s: 6 },
          { w: "real estate", s: 6 }, { w: "عقارات", s: 6 },
          { w: "housing", s: 5 }, { w: "إسكان", s: 5 }
        ]
      }
    };

    let sources = loadSources();
    let categories = loadCategories();
    let allArticles = loadStoredArticles();
    let wordFilters = loadWordFilters();
    let latestFetchedIds = new Set();
    let activeCat = 'all';
    let activeModalCat = 'oil';
    let tickerRunning = true;
    let isFetching = false;

    function loadSources() {
      try {
        const stored = localStorage.getItem(LS_SOURCES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const defaultsByUrl = new Map(VERIFIED_SOURCES.map(source => [source.url, source.region]));
            // Remove all Presidency feeds, including custom entries and previously migrated URLs.
            const normalized = parsed.filter(source =>
              !/^https?:\/\/(?:[^/]+\.)?presidency\.eg(?:[/:?#]|$)/i.test(source.url.trim())
            ).map(source => ({
              ...source,
              region: REGIONS.includes(source.region) ? source.region : (defaultsByUrl.get(source.url) || 'world')
            }));
            if (!localStorage.getItem(LS_REGION_MIGRATION_KEY)) {
              const egyptDefault = VERIFIED_SOURCES.find(source => source.id === 's12');
              if (!normalized.some(source => source.url === egyptDefault.url)) normalized.push({ ...egyptDefault });
              try { localStorage.setItem(LS_REGION_MIGRATION_KEY, '1'); } catch (e) {}
            }
            if (!localStorage.getItem(LS_EGYPT_FEEDS_MIGRATION_KEY)) {
              const existingUrls = new Set(normalized.map(source => source.url.replace(/\/$/, '').toLowerCase()));
              for (const source of VERIFIED_SOURCES.slice(12, 24)) {
                const url = source.url.replace(/\/$/, '').toLowerCase();
                if (!existingUrls.has(url)) {
                  normalized.push({ ...source });
                  existingUrls.add(url);
                }
              }
              try {
                localStorage.setItem(LS_SOURCES_KEY, JSON.stringify(normalized));
                localStorage.setItem(LS_EGYPT_FEEDS_MIGRATION_KEY, '1');
              } catch (e) {}
            }
            if (!localStorage.getItem(LS_BLOOMBERG_FEEDS_MIGRATION_KEY)) {
              const existingUrls = new Set(normalized.map(source => source.url.replace(/\/$/, '').toLowerCase()));
              for (const source of VERIFIED_SOURCES.filter(source => source.url.startsWith('https://feeds.bloomberg.com/'))) {
                const url = source.url.replace(/\/$/, '').toLowerCase();
                if (!existingUrls.has(url)) {
                  normalized.push({ ...source });
                  existingUrls.add(url);
                }
              }
              try {
                localStorage.setItem(LS_SOURCES_KEY, JSON.stringify(normalized));
                localStorage.setItem(LS_BLOOMBERG_FEEDS_MIGRATION_KEY, '1');
              } catch (e) {}
            }
            return normalized;
          }
        }
      } catch (e) {}
      return JSON.parse(JSON.stringify(VERIFIED_SOURCES));
    }

    function saveSources() {
      try { localStorage.setItem(LS_SOURCES_KEY, JSON.stringify(sources)); } catch (e) {}
    }

    function loadCategories() {
      try {
        const stored = localStorage.getItem(LS_CATEGORIES_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }

    function saveCategories() {
      try { localStorage.setItem(LS_CATEGORIES_KEY, JSON.stringify(categories)); } catch (e) {}
    }

    function loadWordFilters() {
      try {
        const stored = JSON.parse(localStorage.getItem(LS_WORD_FILTERS_KEY));
        if (stored && Array.isArray(stored.include) && Array.isArray(stored.exclude)) {
          return {
            include: stored.include.filter(word => typeof word === 'string' && word.trim()),
            exclude: stored.exclude.filter(word => typeof word === 'string' && word.trim())
          };
        }
      } catch (e) {}
      return { include: [], exclude: [] };
    }

    function saveWordFilters() {
      try { localStorage.setItem(LS_WORD_FILTERS_KEY, JSON.stringify(wordFilters)); } catch (e) {}
    }

    function loadStoredArticles() {
      try {
        const stored = localStorage.getItem(LS_ARTICLES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
      return [];
    }

    function saveStoredArticles() {
      try {
        if (allArticles.length > 2000) allArticles = allArticles.slice(0, 2000);
        localStorage.setItem(LS_ARTICLES_KEY, JSON.stringify(allArticles));
      } catch (e) {}
    }

    function normalizeArabic(text) {
      if (!text) return '';
      return text
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ـ/g, '')
        .toLowerCase();
    }

    function normalizeFilterText(text) {
      return normalizeArabic(text)
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
    }

    function phraseMatches(text, phrase) {
      const needle = normalizeFilterText(phrase);
      if (!needle) return false;
      const paddedText = ` ${text} `;
      if (paddedText.includes(` ${needle} `)) return true;
      return /^[\u0600-\u06FF]+$/.test(needle) && paddedText.includes(` ال${needle} `);
    }

    function matchesSavedWords(item) {
      const text = normalizeFilterText(item.title + ' ' + (item.summary || ''));
      if (wordFilters.exclude.some(phrase => phraseMatches(text, phrase))) return false;
      return wordFilters.include.length === 0 || wordFilters.include.some(phrase => phraseMatches(text, phrase));
    }

    function getArticleRegion(item) {
      const source = sources.find(source => source.id === item.sourceId) ||
        sources.find(source => source.name === item.source);
      return source?.region || item.region || 'world';
    }

    function matchesRegion(item, selectedRegion) {
      const region = getArticleRegion(item);
      if (selectedRegion === 'all') return true;
      if (selectedRegion === 'mena') return region === 'mena' || region === 'egypt';
      return region === selectedRegion;
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[char]);
    }

    function safeArticleUrl(value) {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '#';
      } catch (e) {
        return '#';
      }
    }

    function detectLanguage(text) {
      return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
    }

    const BREAKING_KEYWORDS = [
      'breaking', 'urgent', 'alert', 'attack', 'war', 'sanctions', 
      'rate decision', 'opec cut', 'emergency', 'strike', 'disaster',
      'عاجل', 'طارئ', 'هجوم', 'حرب', 'عقوبات', 'قرار الفائدة', 'قرار أوبك'
    ];

    function isBreakingNews(title) {
      const norm = normalizeArabic(title);
      return BREAKING_KEYWORDS.some(kw => norm.includes(normalizeArabic(kw)));
    }

    function classifyArticle(title, description) {
      const normText = normalizeArabic(title + " " + description);
      const titleNorm = normalizeArabic(title);

      const matchedCats = [];
      const scores = {};
      const matchedKwList = [];

      for (const [catKey, catObj] of Object.entries(categories)) {
        let catScore = 0;
        const catMatched = [];

        for (const kw of catObj.keywords) {
          const kwNorm = normalizeArabic(kw.w);
          let found = false;

          if (titleNorm.includes(kwNorm)) {
            catScore += (kw.s * 2);
            found = true;
          } else if (normText.includes(kwNorm)) {
            catScore += kw.s;
            found = true;
          }

          if (found) {
            catMatched.push(kw.w);
            matchedKwList.push(kw.w);
          }
        }

        if (catScore >= 3) {
          matchedCats.push(catKey);
          scores[catKey] = catScore;
        }
      }

      const breaking = isBreakingNews(title);
      return {
        categories: matchedCats,
        scores,
        matchedKeywords: matchedKwList,
        isBreaking: breaking,
        primaryScore: Math.max(0, ...Object.values(scores))
      };
    }

    function getTokens(str) {
      return new Set(
        normalizeArabic(str)
          .replace(/[^\w\s\u0600-\u06FF]/gi, ' ')
          .split(/\s+/)
          .filter(w => w.length > 2)
      );
    }

    function findDuplicateArticle(newTitle, existingArticles) {
      const tokensA = getTokens(newTitle);
      if (tokensA.size === 0) return null;

      for (const art of existingArticles) {
        if (normalizeArabic(art.title) === normalizeArabic(newTitle)) return art;

        const tokensB = getTokens(art.title);
        if (tokensB.size === 0) continue;
        let intersection = 0;
        tokensA.forEach(token => { if (tokensB.has(token)) intersection++; });
        const union = tokensA.size + tokensB.size - intersection;
        const jaccard = union > 0 ? (intersection / union) : 0;
        if (jaccard >= 0.80) return art;
      }
      return null;
    }

    // High Speed Fetch: Try rss2json first, with fallback to allorigins XML
    async function fetchFeedItems(sourceMeta) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(sourceMeta.url)}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
            return data.items.map(item => ({
              title: item.title?.trim() || '',
              summary: (item.description || item.content || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().slice(0, 260),
              url: item.link || '',
              source: sourceMeta.name,
              sourceId: sourceMeta.id,
              region: sourceMeta.region,
              sourcePriority: sourceMeta.priority,
              publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
            }));
          }
        }
      } catch (e) {}

      // Fallback: allorigins raw XML
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(sourceMeta.url)}`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const xml = await res.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xml, 'text/xml');
          let nodes = xmlDoc.querySelectorAll('item');
          if (!nodes || nodes.length === 0) nodes = xmlDoc.querySelectorAll('entry');

          const items = [];
          nodes.forEach((node, idx) => {
            if (idx >= 20) return;
            const title = node.querySelector('title')?.textContent?.trim() || '';
            if (!title) return;
            let link = node.querySelector('link')?.textContent?.trim() || node.querySelector('link')?.getAttribute('href') || '';
            let desc = node.querySelector('description, summary, content')?.textContent?.trim() || '';
            desc = desc.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().slice(0, 260);
            const pubRaw = node.querySelector('pubDate, published, updated')?.textContent?.trim() || '';
            const publishedAt = pubRaw ? new Date(pubRaw).toISOString() : new Date().toISOString();

            items.push({
              title,
              summary: desc,
              url: link,
              source: sourceMeta.name,
              sourceId: sourceMeta.id,
              region: sourceMeta.region,
              sourcePriority: sourceMeta.priority,
              publishedAt
            });
          });
          return items;
        }
      } catch (e) {}

      return [];
    }

    // PARALLEL LIVE FETCHER: Fetches ALL feeds at the exact same time in ~1 second!
    async function fetchAllFeeds() {
      if (isFetching) return;
      isFetching = true;

      const btn = document.getElementById('fetchBtn');
      const spinner = document.getElementById('fetchSpinner');
      const btnLabel = document.getElementById('fetchBtnLabel');
      const progressBox = document.getElementById('fetchProgressContainer');
      const progressBar = document.getElementById('fetchProgressBar');
      const statusText = document.getElementById('syncStatusText');
      const feedback = document.getElementById('fetchFeedback');

      spinner.classList.add('animate-spin');
      btn.disabled = true;
      progressBox.classList.remove('hidden');
      progressBar.dataset.progress = 'start';
      statusText.innerText = 'Streaming all feeds in parallel...';

      const enabledSources = sources.filter(s => s.enabled);
      let newlyAdded = 0;
      let fetchedStories = 0;
      let respondingSources = 0;
      latestFetchedIds.clear();
      feedback.classList.remove('hidden');
      feedback.textContent = `Fetching ${enabledSources.length} RSS sources...`;

      // Launch all feed requests concurrently in parallel!
      const fetchPromises = enabledSources.map(async src => {
        try {
          return await fetchFeedItems(src);
        } catch (err) {
          return [];
        }
      });

      const results = await Promise.allSettled(fetchPromises);
      progressBar.dataset.progress = 'processing';

      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          if (res.value.length > 0) respondingSources++;
          fetchedStories += res.value.length;
          for (const raw of res.value) {
            if (!raw.title) continue;

            const existingArticle = findDuplicateArticle(raw.title, allArticles);
            if (existingArticle) {
              latestFetchedIds.add(existingArticle.id);
            } else {
              const classification = classifyArticle(raw.title, raw.summary);
              const lang = detectLanguage(raw.title + " " + raw.summary);

              const article = {
                id: 'art-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now(),
                title: raw.title,
                summary: raw.summary,
                url: raw.url,
                source: raw.source,
                sourceId: raw.sourceId,
                region: raw.region,
                sourcePriority: raw.sourcePriority,
                publishedAt: raw.publishedAt,
                categories: classification.categories,
                keywords: classification.matchedKeywords,
                score: classification.primaryScore,
                isBreaking: classification.isBreaking,
                language: lang
              };

              allArticles.unshift(article);
              latestFetchedIds.add(article.id);
              newlyAdded++;
            }
          }
        }
      });

      progressBar.dataset.progress = 'complete';
      saveStoredArticles();
      try { localStorage.setItem(LS_LAST_FETCH_KEY, new Date().toISOString()); } catch (e) {}

      spinner.classList.remove('animate-spin');
      btn.disabled = false;
      btnLabel.innerText = 'Fetch Live';
      setTimeout(() => {
        progressBox.classList.add('hidden');
        progressBar.dataset.progress = 'idle';
      }, 600);
      statusText.innerText = `Synced (${allArticles.length} total • +${newlyAdded} new)`;
      feedback.textContent = respondingSources > 0
        ? `Fetched ${fetchedStories} stories from ${respondingSources}/${enabledSources.length} sources (${newlyAdded} new).`
        : 'No RSS sources returned stories. Check your connection and try Fetch Live again.';

      renderNews();
      renderTicker();
      updateCategoryCounts();
      isFetching = false;
    }

    function renderTicker() {
      const track = document.getElementById('tickerTrack');
      let tickerItems = allArticles.slice(0, 30);

      if (tickerItems.length === 0) {
        track.innerHTML = '<div class="text-xs text-slate-400 font-mono px-4">No live articles yet. Click Fetch Live above to stream real news.</div>';
        return;
      }

      function buildTickerItem(item) {
        const catBadge = item.categories.length > 0 ? item.categories[0].toUpperCase() : 'NEWS';
        return `
          <a href="${escapeHtml(safeArticleUrl(item.url))}" target="_blank" rel="noopener noreferrer" class="inline-flex flex-col justify-center px-4 py-1 border-r border-slate-200 shrink-0 hover:bg-slate-50 transition group">
            <div class="flex items-center gap-2 text-xs font-mono">
              ${item.isBreaking ? '<span class="bg-red-600 text-white font-bold px-1.5 py-0.2 rounded text-[10px] animate-pulse">BREAKING</span>' : ''}
              <span class="bg-slate-100 text-slate-800 font-semibold px-1.5 py-0.2 rounded text-[10px] uppercase border border-slate-200">${catBadge}</span>
              <span class="font-bold text-slate-800">${escapeHtml(item.source)}</span>
              <span class="text-slate-400">• ${timeAgo(item.publishedAt)}</span>
            </div>
            <div class="text-sm font-semibold text-slate-900 group-hover:text-blue-600 mt-0.5 max-w-xl truncate ${item.language === 'ar' ? 'arabic-text' : ''}">
              ${escapeHtml(item.title)}
            </div>
          </a>
        `;
      }

      const itemsHtml = tickerItems.map(buildTickerItem).join('');
      track.innerHTML = itemsHtml + itemsHtml;
    }

    function timeAgo(dateString) {
      const min = Math.floor((new Date() - new Date(dateString)) / 60000);
      if (isNaN(min) || min < 1) return "Just now";
      if (min < 60) return `${min}m ago`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    }

    function getCatBadge(cat) {
      const map = {
        oil: "bg-slate-100 text-slate-700",
        economy: "bg-blue-50 text-blue-700",
        gold: "bg-amber-50 text-amber-700",
        stocks: "bg-emerald-50 text-emerald-700",
        politics: "bg-indigo-50 text-indigo-700",
        tech: "bg-purple-50 text-purple-700",
        construction: "bg-orange-50 text-orange-700"
      };
      return `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${map[cat] || 'bg-slate-100 text-slate-600'}">${escapeHtml(cat)}</span>`;
    }

    function updateCategoryCounts() {
      document.getElementById('countAll').innerText = allArticles.length;
      document.getElementById('countBreaking').innerText = allArticles.filter(a => a.isBreaking).length;
      document.getElementById('countOil').innerText = allArticles.filter(a => a.categories.includes('oil')).length;
      document.getElementById('countEconomy').innerText = allArticles.filter(a => a.categories.includes('economy')).length;
      document.getElementById('countGold').innerText = allArticles.filter(a => a.categories.includes('gold')).length;
      document.getElementById('countStocks').innerText = allArticles.filter(a => a.categories.includes('stocks')).length;
      document.getElementById('countPolitics').innerText = allArticles.filter(a => a.categories.includes('politics')).length;
      document.getElementById('countTech').innerText = allArticles.filter(a => a.categories.includes('tech')).length;
      document.getElementById('countConstruction').innerText = allArticles.filter(a => a.categories.includes('construction')).length;
    }

    function renderNews() {
      const list = document.getElementById('newsList');
      const empty = document.getElementById('emptyNotice');
      const q = document.getElementById('searchInput').value.trim().toLowerCase();
      const src = document.getElementById('sourceSelect').value;
      const lang = document.getElementById('langSelect').value;
      const sort = document.getElementById('sortSelect').value;
      const scope = document.getElementById('scopeSelect').value;
      const region = document.getElementById('regionSelect').value;

      let filtered = allArticles.filter(item => {
        if (scope === 'live' && !latestFetchedIds.has(item.id)) return false;
        if (!matchesRegion(item, region) || !matchesSavedWords(item)) return false;
        if (activeCat === 'breaking' && !item.isBreaking) return false;
        if (activeCat !== 'all' && activeCat !== 'breaking' && !item.categories.includes(activeCat)) return false;
        if (src !== 'all' && item.source !== src) return false;
        if (lang !== 'all' && item.language !== lang) return false;
        if (q && !item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q)) return false;
        return true;
      });

      if (sort === 'newest') filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      else if (sort === 'score') filtered.sort((a, b) => b.score - a.score);
      else if (sort === 'source') filtered.sort((a, b) => b.sourcePriority - a.sourcePriority);

      if (filtered.length === 0) {
        list.innerHTML = '';
        document.getElementById('emptyNoticeText').textContent = allArticles.length === 0
          ? 'No RSS news has loaded yet. Check your connection and try Fetch Live again.'
          : scope === 'live' && latestFetchedIds.size === 0
            ? 'This fetch returned no stories. Choose All Articles to see saved news.'
            : 'No stories match the current filters. Try All News, All Regions, or review saved Words.';
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');

      list.innerHTML = filtered.map(item => `
        <article class="p-4 hover:bg-slate-50/80 transition flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs text-slate-500">
            <div class="flex items-center gap-2 flex-wrap">
              ${item.isBreaking ? '<span class="bg-red-600 text-white font-semibold px-1.5 py-0.2 rounded text-[10px]">Breaking</span>' : ''}
              <span class="font-semibold text-slate-800">${escapeHtml(item.source)}</span>
              <span>•</span>
              <span class="font-mono text-[11px]">${timeAgo(item.publishedAt)}</span>
              ${item.categories.length > 0 ? '<span>•</span><div class="flex gap-1">' + item.categories.map(c => getCatBadge(c)).join('') + '</div>' : ''}
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[11px] text-slate-400 font-mono">Score: ${item.score || 0}</span>
              <button
                type="button"
                data-action="open-ai"
                data-article-id="${escapeHtml(item.id)}"
                class="ai-article-button"
                aria-label="Analyze this article with AI"
                title="Analyze this article with AI"
              >
                <span aria-hidden="true">✦</span>
                <span>AI</span>
              </button>
            </div>
          </div>

          <h2 class="text-sm font-semibold text-slate-900 hover:text-blue-600 ${item.language === 'ar' ? 'arabic-text leading-relaxed' : 'leading-snug'}">
            <a href="${escapeHtml(safeArticleUrl(item.url))}" target="_blank" rel="noopener noreferrer" class="hover:underline">
              ${escapeHtml(item.title)}
            </a>
          </h2>

          ${item.summary ? `
            <p class="text-xs text-slate-600 line-clamp-2 ${item.language === 'ar' ? 'arabic-text' : ''}">
              ${escapeHtml(item.summary)}
            </p>
          ` : ''}

          ${item.keywords && item.keywords.length > 0 ? `
            <div class="flex items-center gap-1 text-[10px] text-slate-400 pt-0.5 flex-wrap">
              <span>Keywords:</span>
              ${item.keywords.map(k => `<span class="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">${escapeHtml(k)}</span>`).join('')}
            </div>
          ` : ''}
        </article>
      `).join('');
    }

    function setCategory(cat) {
      activeCat = cat;
      document.querySelectorAll('.cat-tab').forEach(b => {
        if (b.dataset.cat === cat) {
          b.className = "cat-tab active px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-medium whitespace-nowrap transition";
        } else {
          b.className = "cat-tab px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap transition";
        }
      });
      renderNews();
    }

    function toggleTicker() {
      const track = document.getElementById('tickerTrack');
      const btn = document.getElementById('tickerBtn');
      if (tickerRunning) {
        track.classList.add('is-paused');
        btn.innerText = '▶ Play';
        tickerRunning = false;
      } else {
        track.classList.remove('is-paused');
        btn.innerText = '⏸ Pause';
        tickerRunning = true;
      }
    }

    function setTickerSpeed(speed) {
      const allowedSpeeds = new Set(['60s', '120s', '180s', '300s']);
      document.getElementById('tickerTrack').dataset.speed = allowedSpeeds.has(speed) ? speed : '180s';
    }

    function toggleModal(id) {
      const m = document.getElementById(id);
      m.classList.toggle('hidden');
      if (id === 'sourcesModal') renderSourcesList();
      if (id === 'keywordsModal') renderKeywordsUI();
      if (id === 'wordsModal') renderWordsUI();
      if (id === 'historyModal') renderHistoryStats();
    }

    function populateSourceDropdown() {
      const select = document.getElementById('sourceSelect');
      const uniqueSources = [...new Set(sources.map(s => s.name))];
      select.innerHTML = '<option value="all">All Sources (' + uniqueSources.length + ')</option>' +
        uniqueSources.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      document.getElementById('sourceCountBadge').innerText = sources.length;
      document.getElementById('modalSourceCount').innerText = sources.length;
    }

    function renderSourcesList() {
      const container = document.getElementById('sourcesListUI');
      container.innerHTML = sources.map(s => `
        <div class="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="min-w-0 flex-1 pr-2">
            <div class="font-medium text-slate-800 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${s.enabled ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
              <span>${escapeHtml(s.name)}</span>
            </div>
            <div class="text-[10px] text-slate-400 truncate max-w-sm font-mono">${escapeHtml(s.url)}</div>
          </div>
          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <select data-source-id="${escapeHtml(s.id)}" data-change-action="set-source-region" class="bg-slate-50 border border-slate-300 rounded px-1 py-0.5 text-xs" title="Source region">
              ${REGIONS.map(region => `<option value="${region}" ${s.region === region ? 'selected' : ''}>${region.toUpperCase()}</option>`).join('')}
            </select>
            <button data-source-id="${escapeHtml(s.id)}" data-action="toggle-source" class="text-xs px-2 py-0.5 rounded ${s.enabled ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-500'}">
              ${s.enabled ? 'Enabled' : 'Disabled'}
            </button>
            <button data-source-id="${escapeHtml(s.id)}" data-action="remove-source" class="text-red-500 hover:underline text-xs">Remove</button>
          </div>
        </div>
      `).join('');
    }

    function toggleSourceEnable(id) {
      const src = sources.find(s => s.id === id);
      if (src) {
        src.enabled = !src.enabled;
        saveSources();
        renderSourcesList();
      }
    }

    function setSourceRegion(id, region) {
      if (!REGIONS.includes(region)) return;
      const source = sources.find(source => source.id === id);
      if (!source) return;
      source.region = region;
      saveSources();
      renderNews();
    }

    function addSource() {
      const name = document.getElementById('newSrcName').value.trim();
      const url = document.getElementById('newSrcUrl').value.trim();
      const priority = parseInt(document.getElementById('newSrcPriority').value, 10) || 8;
      const region = document.getElementById('newSrcRegion').value;
      if (!name || !url) return;
      sources.push({ id: 's-' + Date.now(), name, url, priority, enabled: true, region });
      saveSources();
      document.getElementById('newSrcName').value = '';
      document.getElementById('newSrcUrl').value = '';
      populateSourceDropdown();
      renderSourcesList();
      renderNews();
    }

    function removeSource(id) {
      sources = sources.filter(s => s.id !== id);
      saveSources();
      populateSourceDropdown();
      renderSourcesList();
      renderNews();
    }

    function resetDefaultSources() {
      if (confirm("Reset RSS sources to original verified list?")) {
        sources = JSON.parse(JSON.stringify(VERIFIED_SOURCES));
        saveSources();
        populateSourceDropdown();
        renderSourcesList();
        renderNews();
      }
    }

    function renderWordsUI() {
      for (const type of ['include', 'exclude']) {
        const container = document.getElementById(type + 'WordChips');
        container.innerHTML = wordFilters[type].map((word, index) => `
          <span class="bg-slate-100 border border-slate-200 rounded px-2 py-1 flex items-center gap-1.5">
            <span>${escapeHtml(word)}</span>
            <button data-action="remove-word-filter" data-filter-type="${type}" data-index="${index}" class="text-slate-400 hover:text-red-600" title="Remove phrase">X</button>
          </span>
        `).join('') || '<span class="text-slate-400">No phrases</span>';
      }
      document.getElementById('wordFilterCount').textContent = wordFilters.include.length + wordFilters.exclude.length;
    }

    function addWordFilter(type) {
      if (type !== 'include' && type !== 'exclude') return;
      const input = document.getElementById(type + 'WordInput');
      const word = input.value.trim();
      if (!normalizeFilterText(word)) return;
      if (!wordFilters[type].some(existing => normalizeFilterText(existing) === normalizeFilterText(word))) {
        wordFilters[type].push(word);
        saveWordFilters();
      }
      input.value = '';
      renderWordsUI();
      renderNews();
    }

    function removeWordFilter(type, index) {
      if (type !== 'include' && type !== 'exclude') return;
      wordFilters[type].splice(index, 1);
      saveWordFilters();
      renderWordsUI();
      renderNews();
    }

    function renderKeywordsUI() {
      const tabs = document.getElementById('keywordCatTabs');
      tabs.innerHTML = Object.keys(categories).map(k => `
        <button data-action="select-keyword-category" data-category="${k}" class="px-2.5 py-1 rounded text-xs ${activeModalCat === k ? 'bg-slate-900 text-white font-medium' : 'bg-slate-100 text-slate-600'}">
          ${categories[k].label}
        </button>
      `).join('');

      document.getElementById('currentCatLabel').innerText = `${categories[activeModalCat].label} Keywords:`;
      const chips = document.getElementById('keywordChips');
      chips.innerHTML = categories[activeModalCat].keywords.map((kw, idx) => `
        <span class="bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1 font-mono">
          <span>${kw.w}</span>
          <span class="text-slate-400 text-[10px]">(+${kw.s})</span>
          <button data-action="remove-keyword" data-index="${idx}" class="text-slate-400 hover:text-red-500 ml-1">×</button>
        </span>
      `).join('');
    }

    function selectModalCat(k) {
      activeModalCat = k;
      renderKeywordsUI();
    }

    function addKeyword() {
      const w = document.getElementById('newKwWord').value.trim();
      const s = parseInt(document.getElementById('newKwWeight').value, 10) || 5;
      if (!w) return;
      categories[activeModalCat].keywords.push({ w, s });
      saveCategories();
      document.getElementById('newKwWord').value = '';
      renderKeywordsUI();
    }

    function removeKeyword(idx) {
      categories[activeModalCat].keywords.splice(idx, 1);
      saveCategories();
      renderKeywordsUI();
    }

    function resetDefaultKeywords() {
      if (confirm("Reset keywords and weights to defaults?")) {
        categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        saveCategories();
        renderKeywordsUI();
      }
    }

    function renderHistoryStats() {
      document.getElementById('historyStoredCount').innerText = allArticles.length;
      const raw = localStorage.getItem(LS_ARTICLES_KEY) || '';
      const kb = Math.round(raw.length / 1024);
      document.getElementById('historyStorageSize').innerText = `${kb} KB`;
      const lastFetch = localStorage.getItem(LS_LAST_FETCH_KEY);
      document.getElementById('historyLastSync').innerText = lastFetch ? new Date(lastFetch).toLocaleTimeString() : 'Never';
    }

    function clearHistory() {
      if (confirm("Clear all stored articles from browser memory?")) {
        allArticles = [];
        latestFetchedIds.clear();
        localStorage.removeItem(LS_ARTICLES_KEY);
        renderHistoryStats();
        renderNews();
        renderTicker();
        updateCategoryCounts();
      }
    }

    function bindAppEvents() {
      document.addEventListener('click', event => {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        if (action === 'open-ai') {
          const article = allArticles.find(item => item.id === target.dataset.articleId);
          if (article) void aiAssistant.openArticle(article, target);
        }
        else if (action === 'fetch-feeds') fetchAllFeeds();
        else if (action === 'toggle-modal') toggleModal(target.dataset.modalId);
        else if (action === 'toggle-ticker') toggleTicker();
        else if (action === 'set-category') setCategory(target.dataset.cat);
        else if (action === 'add-source') addSource();
        else if (action === 'reset-sources') resetDefaultSources();
        else if (action === 'toggle-source') toggleSourceEnable(target.dataset.sourceId);
        else if (action === 'remove-source') removeSource(target.dataset.sourceId);
        else if (action === 'add-word-filter') addWordFilter(target.dataset.filterType);
        else if (action === 'remove-word-filter') removeWordFilter(target.dataset.filterType, Number(target.dataset.index));
        else if (action === 'select-keyword-category') selectModalCat(target.dataset.category);
        else if (action === 'add-keyword') addKeyword();
        else if (action === 'remove-keyword') removeKeyword(Number(target.dataset.index));
        else if (action === 'reset-keywords') resetDefaultKeywords();
        else if (action === 'clear-history') clearHistory();
      });

      document.addEventListener('change', event => {
        const target = event.target.closest('[data-change-action]');
        if (!target) return;

        const action = target.dataset.changeAction;
        if (action === 'render-news') renderNews();
        else if (action === 'ticker-speed') setTickerSpeed(target.value);
        else if (action === 'set-source-region') setSourceRegion(target.dataset.sourceId, target.value);
      });

      document.addEventListener('input', event => {
        if (event.target.closest('[data-input-action="render-news"]')) renderNews();
      });
    }

    // Initialize
    const aiAssistant = createAiAssistant({
      getArticleById: articleId => allArticles.find(article => article.id === articleId) || null,
    });
    void aiAssistant.mount();
    bindAppEvents();
    saveSources();
    populateSourceDropdown();
    renderWordsUI();
    updateCategoryCounts();
    renderNews();
    renderTicker();

    // Parallel Live Fetch on initial launch
    fetchAllFeeds();

    // Auto-refresh every 5 minutes in parallel
    setInterval(() => {
      fetchAllFeeds();
    }, 5 * 60 * 1000);
