import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Enhanced AnimeFunSite — UI improvements
// - Dark/light toggle (persisted)
// - Improved header with logo area
// - Search + filter row redesigned with icons
// - Card hover animations, badges, and subtle shadows
// - Skeleton loading for grid
// - Better responsive layout and spacing
// - Accessible buttons and aria labels

export default function AnimeFunSite() {
  const [animeList, setAnimeList] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("af_theme") || "dark");

  const CACHE_KEY = "anime_top_cache_v2";
  const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
  const PAGE_SIZE = 25;

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("af_theme", theme);
  }, [theme]);

  async function fetchPage(p = 1) {
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(`https://api.jikan.moe/v4/top/anime?page=${p}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      if (!json || !json.data) throw new Error("Malformed response");

      const newItems = json.data.map((a) => ({
        id: a.mal_id,
        title: a.title,
        image: a.images?.jpg?.image_url || "",
        type: a.type || "Unknown",
        episodes: a.episodes ?? "?",
        score: a.score ?? "N/A",
        rank: a.rank ?? null,
        synopsis: a.synopsis ?? "No synopsis available.",
      }));

      setAnimeList((prev) => (p === 1 ? newItems : [...prev, ...newItems]));
      setFiltered((prevFiltered) => (p === 1 ? newItems : [...prevFiltered, ...newItems]));

      // update cache
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && parsed.t && Date.now() - parsed.t < CACHE_TTL_MS) {
          const merged = p === 1 ? newItems : [...(parsed.data || []), ...newItems];
          const pages = p === 1 ? 1 : Math.max(parsed.pages || 1, p);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ t: Date.now(), data: merged, pages })
          );
        } else {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ t: Date.now(), data: newItems, pages: p })
          );
        }
      } catch (e) {
        // ignore cache errors
      }

      if ((json.data?.length ?? 0) < PAGE_SIZE) setHasMore(false);
      else setHasMore(true);
    } catch (err) {
      if (err.name === "AbortError") setError("Request timed out");
      else setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function onLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }

  useEffect(() => {
    let mounted = true;

    async function init() {
      setLoading(true);
      setError(null);
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            parsed.t &&
            Date.now() - parsed.t < CACHE_TTL_MS &&
            Array.isArray(parsed.data)
          ) {
            if (!mounted) return;
            setAnimeList(parsed.data);
            setFiltered(parsed.data);
            setPage(parsed.pages || Math.max(1, Math.ceil((parsed.data.length || 0) / PAGE_SIZE)));
            setHasMore((parsed.data.length || 0) % PAGE_SIZE === 0);
            setLoading(false);
            return;
          }
        }

        await fetchPage(1);
        setPage(1);
      } catch (err) {
        if (err.name === "AbortError") setError("Request timed out");
        else setError(err.message || "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    const out = animeList.filter((a) => {
      const matchQuery = q === "" || a.title.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || a.type === typeFilter;
      return matchQuery && matchType;
    });
    setFiltered(out);
  }, [query, typeFilter, animeList]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }

    let mounted = true;
    async function fetchDetail(id) {
      setDetail({ loading: true });
      setError(null);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 7000);
        const res = await fetch(`https://api.jikan.moe/v4/anime/${id}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`Detail API ${res.status}`);
        const json = await res.json();
        if (!json || !json.data) throw new Error("Malformed detail response");

        const d = {
          id: json.data.mal_id,
          title: json.data.title,
          image: json.data.images?.jpg?.image_url || "",
          synopsis: json.data.synopsis || "No synopsis available.",
          score: json.data.score ?? "N/A",
          episodes: json.data.episodes ?? "?",
          aired: json.data.aired?.string || "Unknown",
          genres: (json.data.genres || []).map((g) => g.name),
          url: json.data.url,
        };

        if (mounted) setDetail(d);
      } catch (err) {
        if (err.name === "AbortError") setError("Detail request timed out");
        else setError(err.message || "Unknown error");
        if (mounted) setDetail(null);
      }
    }

    fetchDetail(selected);
    return () => (mounted = false);
  }, [selected]);

  function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    window.location.reload();
  }

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  // small UI helpers
  function SkeletonCard() {
    return (
      <div className="animate-pulse rounded-xl overflow-hidden bg-white/4 p-4">
        <div className="h-44 bg-white/6 rounded-md mb-3" />
        <div className="h-4 bg-white/6 rounded w-3/4 mb-2" />
        <div className="h-3 bg-white/6 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-maroon text-gray-100">
      <header className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" fill="url(#g)"/>
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stopColor="#FF7AB6" />
                  <stop offset="1" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div>
            <h1 className="text-3xl font-extrabold">Anime</h1>
            <div className="text-sm opacity-80">Discover top anime</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="px-3 py-2 rounded-lg bg-white/6 hover:bg-white/10"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          <button
            onClick={clearCache}
            className="px-3 py-2 rounded-lg bg-indigo-500 text-white"
            title="Clear cache and reload"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        <section className="bg-white rounded-2xl p-4 mb-6 shadow-xl backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center gap-3 ">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-3 opacity-60" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anime by title..."
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-black placeholder:text-gray-300 outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-400"
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                <option value="TV">TV</option>
                <option value="Movie">Movie</option>
                <option value="Special">Special</option>
                <option value="OVA">OVA</option>
                <option value="Unknown">Unknown</option>
              </select>

              <div className="text-sm text-gray-600">Results: {filtered.length}</div>
            </div>
          </div>
        </section>

        <section>
          {error && (
            <div className="bg-red-600/20 border border-red-400/30 p-3 rounded-md text-sm mb-4">
              Error: {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {loading && animeList.length === 0
              ? // show skeletons for initial load
                Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
              : filtered.map((a) => (
                  <motion.article
                    key={a.id}
                    layout
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.99 }}
                    className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-white/4 to-white/6 shadow-lg hover:shadow-2xl transition-shadow"
                  >
                    <div className="relative">
                      <img
                        src={a.image}
                        alt={a.title}
                        className="w-full h-56 object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400'%3E%3Crect width='100%25' height='100%25' fill='%23444466'/%3E%3Ctext x='50%25' y='50%25' fill='%23fff' dominant-baseline='middle' text-anchor='middle' font-size='20'%3EImage not available%3C/text%3E%3C/svg%3E";
                        }}
                      />

                      <div className="absolute left-3 top-3 bg-black/50 px-2 py-1 rounded-full text-xs">#{a.rank ?? "-"}</div>
                      <div className="absolute right-3 top-3 bg-indigo-500 px-2 py-1 rounded-full text-xs">{a.type}</div>
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold truncate">{a.title}</h3>
                        <div className="text-sm font-medium">{a.score}</div>
                      </div>

                      <p className="text-sm opacity-80 line-clamp-3">{a.synopsis}</p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs text-gray-300">{a.episodes} eps</div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelected(a.id)}
                            className="px-3 py-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-sm text-white"
                            aria-label={`View details for ${a.title}`}
                          >
                            View
                          </button>

                          <button
                            onClick={() => navigator.clipboard?.writeText(a.title)}
                            className="px-3 py-1 rounded-full bg-white/6 text-sm"
                            aria-label={`Copy title ${a.title}`}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
          </div>

          <div className="mt-8 flex items-center justify-center">
            {loading && animeList.length > 0 && <div className="text-sm opacity-80">Loading more…</div>}

            {!loading && hasMore && (
              <button
                onClick={onLoadMore}
                className="px-6 py-3 rounded-full bg-pink text-white shadow-lg hover:brightness-105"
              >
                Load more
              </button>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selected && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />

            <motion.div
              key={selected}
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="relative z-50 max-w-4xl w-full bg-white/6 rounded-2xl overflow-hidden shadow-2xl backdrop-blur p-6 text-gray-100"
            >
              <div className="flex gap-6 flex-col md:flex-row">
                <div className="w-full md:w-1/3 flex-shrink-0">
                  {detail?.loading ? (
                    <div className="h-64 bg-white/6 rounded-md" />
                  ) : (
                    <img
                      src={detail?.image || animeList.find((x) => x.id === selected)?.image}
                      alt={detail?.title}
                      className="w-full h-64 object-cover rounded-md"
                    />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">{detail?.title || "Loading…"}</h2>
                      <div className="text-sm opacity-80 mt-1">{detail?.genres?.join(" • ")}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm">Score</div>
                      <div className="text-xl font-semibold">{detail?.score ?? "—"}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm leading-relaxed max-h-60 overflow-auto">{detail?.synopsis || "Synopsis not available."}</div>

                  <div className="mt-6 flex items-center gap-3">
                    <a
                      href={detail?.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-lg bg-indigo text-white text-sm"
                    >
                      Open on MyAnimeList
                    </a>

                    <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg bg-white/6 text-sm">
                      Close
                    </button>
                  </div>

                  {error && <div className="mt-4 text-sm text-red-300">{error}</div>}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto mt-10 text-center text-xs opacity-80">
        <div>Data via Jikan API (https://api.jikan.moe) — cached locally for a better experience.</div>
        <div className="mt-2">Made with care for anime fans — tweak styles in Tailwind as you like.</div>
      </footer>
    </div>
  );
}
