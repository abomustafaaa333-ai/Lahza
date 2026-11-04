import type { Express } from "express";

/**
 * Map tiles for the taxi map, fetched from OpenStreetMap by the server and cached.
 * OSM's tile policy asks apps to identify themselves and cache; phones fetching
 * tiles directly would send neither, and the server's copy keeps repeat views off OSM.
 */
const UPSTREAM = "https://tile.openstreetmap.org";
const USER_AGENT = "LahzaApp/1.0 (+https://lahza-app.duckdns.org)";
const MAX_CACHED = 3000;
const cache = new Map<string, { body: Buffer; at: number }>();
const DAY = 86_400_000;

export function registerMapTiles(app: Express) {
  app.get("/api/map-tiles/:z/:x/:y.png", async (req, res) => {
    const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
    if (![z, x, y].every(Number.isInteger) || z < 0 || z > 19 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
      res.status(400).end();
      return;
    }
    const key = `${z}/${x}/${y}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 7 * DAY) {
      cache.delete(key); cache.set(key, hit); // keep recently used tiles
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" }).send(hit.body);
      return;
    }
    try {
      const upstream = await fetch(`${UPSTREAM}/${key}.png`, { headers: { "User-Agent": USER_AGENT } , signal: AbortSignal.timeout(10_000) });
      if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) {
        res.status(502).end();
        return;
      }
      const body = Buffer.from(await upstream.arrayBuffer());
      cache.set(key, { body, at: Date.now() });
      while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
      res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" }).send(body);
    } catch {
      res.status(504).end();
    }
  });
}
