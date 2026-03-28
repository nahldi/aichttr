import { useState, useEffect, useMemo } from 'react';
import { api } from '../lib/api';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
const MAX_CACHE = 200;
const PREVIEW_TTL_MS = 10 * 60 * 1000;

type UrlPreviewData = {
  title: string;
  description: string;
  image: string;
  site_name: string;
};

type CacheEntry = {
  value: UrlPreviewData | null;
  expiresAt: number;
};

// Cache previews to avoid re-fetching while allowing previews to refresh over time.
const _cache: Record<string, CacheEntry | undefined> = {};
const _cacheOrder: string[] = [];

function _cacheDelete(url: string) {
  delete _cache[url];
  const index = _cacheOrder.indexOf(url);
  if (index !== -1) _cacheOrder.splice(index, 1);
}

function _cacheGet(url: string): UrlPreviewData | null | undefined {
  const entry = _cache[url];
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    _cacheDelete(url);
    return undefined;
  }
  return entry.value;
}

function _cacheSet(url: string, value: UrlPreviewData | null) {
  if (!(url in _cache)) {
    _cacheOrder.push(url);
    if (_cacheOrder.length > MAX_CACHE) {
      const evict = _cacheOrder.shift()!;
      _cacheDelete(evict);
    }
  }
  _cache[url] = {
    value,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  };
}

export function UrlPreviews({ text }: { text: string }) {
  const [previews, setPreviews] = useState<Record<string, UrlPreviewData>>({});

  const urls = useMemo(() => Array.from(new Set(text.match(URL_REGEX) || [])).slice(0, 3), [text]);

  const urlsKey = urls.join('\n');
  useEffect(() => {
    if (urls.length === 0) {
      setPreviews({});
      return;
    }

    let cancelled = false;
    setPreviews(prev => Object.fromEntries(Object.entries(prev).filter(([url]) => urls.includes(url))));

    urls.forEach(async (url) => {
      const cached = _cacheGet(url);
      if (cached !== undefined) {
        if (cached && !cancelled) {
          setPreviews(p => ({ ...p, [url]: cached }));
        }
        return;
      }
      try {
        const data = await api.getUrlPreview(url);
        if (data.title || data.description) {
          _cacheSet(url, data);
          if (!cancelled) setPreviews(p => ({ ...p, [url]: data }));
        } else {
          _cacheSet(url, null);
        }
      } catch {
        _cacheSet(url, null);
      }
    });
    return () => { cancelled = true; };
  }, [urlsKey]); // urlsKey memoizes the extracted URLs from text

  const entries = Object.entries(previews);
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {entries.map(([url, p]) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 p-2.5 rounded-lg bg-surface-container/40 border border-outline-variant/10 hover:border-primary/15 transition-all group max-w-[400px]"
        >
          {p.image && (
            <img
              src={p.image}
              alt=""
              className="w-16 h-16 rounded-md object-cover shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="min-w-0 flex-1">
            {p.site_name && (
              <div className="text-[9px] text-on-surface-variant/40 uppercase tracking-wider font-medium">{p.site_name}</div>
            )}
            <div className="text-[11px] font-semibold text-on-surface group-hover:text-primary transition-colors truncate">{p.title}</div>
            {p.description && (
              <div className="text-[10px] text-on-surface-variant/50 line-clamp-2 mt-0.5">{p.description}</div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
