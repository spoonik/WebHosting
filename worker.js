/**
 * memo-sync Worker
 * 
 * KV namespace: NOTES_KV
 * Secret (環境変数): SECRET_TOKEN
 *
 * デプロイ手順は README_SETUP.md を参照。
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'X-Token, Content-Type, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
};

function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export default {
  async fetch(request, env) {

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Auth
    const token = request.headers.get('X-Token');
    if (!env.SECRET_TOKEN || token !== env.SECRET_TOKEN) {
      return new Response('Unauthorized', {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
      });
    }

    const key = 'notes_v1'; // データキー固定（単一ユーザー）

    // ── GET ──────────────────────────────────────────
    if (request.method === 'GET') {
      const value = await env.NOTES_KV.get(key);

      if (value === null) {
        return new Response(JSON.stringify({ notes: [], updatedAt: 0 }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const etag = `"${simpleHash(value)}"`;
      const ifNoneMatch = request.headers.get('If-None-Match');

      if (ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers: CORS_HEADERS });
      }

      return new Response(value, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'ETag': etag,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── PUT ──────────────────────────────────────────
    if (request.method === 'PUT') {
      const body = await request.text();

      // 最低限のバリデーション
      try { JSON.parse(body); } catch {
        return new Response('Bad JSON', {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
        });
      }

      await env.NOTES_KV.put(key, body);

      const etag = `"${simpleHash(body)}"`;
      return new Response('ok', {
        status: 200,
        headers: { ...CORS_HEADERS, 'ETag': etag },
      });
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: CORS_HEADERS,
    });
  },
};
