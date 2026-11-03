import { buildHealthReport } from './_lib/health';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  const report = await buildHealthReport();

  return Response.json(report, {
    // A `down` report answers 503 so an uptime monitor sees a failure without
    // having to read the body. The body is a full report either way.
    status: report.status === 'down' ? 503 : 200,
    headers: {
      // Never cached: a stale health report is worse than no health report.
      'cache-control': 'no-store',
      'x-courtside-health': report.status,
    },
  });
}
