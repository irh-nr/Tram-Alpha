/**
 * Tram - Cloudflare Worker Reverse Proxy for Binance
 *
 * This Worker acts as a secure bridge to Binance when connecting from restricted
 * networks like university Wi-Fi (eduroam) or regions where binance.com is filtered.
 *
 * Features:
 * - Proxies REST API (/api/v3/...) to api.binance.com on standard port 443
 * - Proxies WebSockets (/stream?... and /ws/...) to stream.binance.com on standard port 443
 * - Preserves query parameters, headers, and WebSocket byte pipeline
 * - Adds CORS support for browser-based requests
 */

const TARGET_WS_HOST = "stream.binance.com";
const TARGET_REST_HOST = "api.binance.com";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // 1. WebSocket Stream Proxy (/stream or /ws or Upgrade: websocket header)
    const isWebSocket = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
    const isStreamPath = url.pathname.startsWith("/stream") || url.pathname.startsWith("/ws");

    if (isWebSocket || isStreamPath) {
      const targetWsUrl = new URL(request.url);
      targetWsUrl.hostname = TARGET_WS_HOST;
      targetWsUrl.protocol = "https:";
      targetWsUrl.port = "443";

      // Pass the WebSocket upgrade request to Binance origin
      return fetch(targetWsUrl.toString(), request);
    }

    // 2. REST API Proxy (e.g. /api/v3/klines)
    const targetRestUrl = new URL(request.url);
    targetRestUrl.hostname = TARGET_REST_HOST;
    targetRestUrl.protocol = "https:";
    targetRestUrl.port = "443";

    // Clone headers and preserve host & auth
    const headers = new Headers(request.headers);
    headers.set("Host", TARGET_REST_HOST);

    const modifiedRequest = new Request(targetRestUrl.toString(), {
      method: request.method,
      headers: headers,
      body: request.body,
      redirect: "follow",
    });

    try {
      const response = await fetch(modifiedRequest);

      // Clone response to attach CORS headers
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Failed to connect to Binance upstream", details: err.message }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};

