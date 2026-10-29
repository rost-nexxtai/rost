/** Liveness for the container's health check: the server is up. No page render, no API call. */
export function GET() {
  return new Response('ok', { headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
}

export const dynamic = 'force-dynamic';
