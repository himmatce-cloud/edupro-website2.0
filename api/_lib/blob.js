import { put, list } from '@vercel/blob';
export async function readJson(path) {
  const { blobs } = await list({ prefix: path });
  const b = blobs.find(x => x.pathname === path);
  if (!b) return null;
  const r = await fetch(b.url + '?t=' + Date.now());
  return r.ok ? r.json() : null;
}
export const writeJson = (path, data) => put(path, JSON.stringify(data), {
  access: 'public', addRandomSuffix: false, allowOverwrite: true,
  contentType: 'application/json', cacheControlMaxAge: 60 });
