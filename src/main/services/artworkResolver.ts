// In-memory artwork cache and high-res cover resolver
const cache = new Map<string, string>();

export async function resolveArtwork(title: string, artist: string, fallbackThumb?: string): Promise<string> {
  if (fallbackThumb && fallbackThumb.startsWith('data:image')) {
    return fallbackThumb;
  }

  if (!title) return '';

  const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
  const cacheKey = `${cleanTitle}:::${artist}`.toLowerCase();
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const query = encodeURIComponent(`${cleanTitle} ${artist}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`, {
      headers: { 'User-Agent': 'SpotifyDynamicIsland/1.0' },
      signal: AbortSignal.timeout(2500)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        // Upgrade thumbnail from 100x100 to 600x600 HD cover
        const highRes = (item.artworkUrl100 || item.artworkUrl60 || '')
          .replace('100x100bb.jpg', '600x600bb.jpg')
          .replace('60x60bb.jpg', '600x600bb.jpg');
        
        if (highRes) {
          cache.set(cacheKey, highRes);
          return highRes;
        }
      }
    }
  } catch {
    // Network or timeout error; continue to fallback
  }

  if (fallbackThumb) {
    cache.set(cacheKey, fallbackThumb);
    return fallbackThumb;
  }

  return '';
}
