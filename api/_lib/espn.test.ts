import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  CACHE_TTL_MS,
  SchemaError,
  UpstreamError,
  clearCache,
  espnUrls,
  fetchEspn,
  isEspnDate,
} from './espn';

const schema = z.object({ events: z.array(z.object({ id: z.string() })) });
const VALID = { events: [{ id: '401909907' }] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A clock the test moves by hand, so cache expiry needs no real waiting. */
function controllableClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

beforeEach(() => {
  clearCache();
});

describe('isEspnDate', () => {
  it('accepts YYYYMMDD and rejects anything else', () => {
    expect(isEspnDate('20261102')).toBe(true);
    expect(isEspnDate('2026-11-02')).toBe(false);
    expect(isEspnDate('')).toBe(false);
    expect(isEspnDate('202611022')).toBe(false);
  });
});

describe('espnUrls', () => {
  it('points only at ESPN hosts', () => {
    const urls = [
      espnUrls.scoreboard('20261102'),
      espnUrls.summary('401909907'),
      espnUrls.standings(),
      espnUrls.teams(),
    ];
    for (const url of urls) {
      expect(new URL(url).hostname).toBe('site.api.espn.com');
    }
  });
});

describe('fetchEspn caching', () => {
  it('does not hit ESPN again inside the cache window', async () => {
    const clock = controllableClock();
    const fetchImpl = vi.fn(async () => jsonResponse(VALID));

    const first = await fetchEspn({
      key: 'k',
      url: 'https://example.test',
      schema,
      now: clock.now,
      fetchImpl,
    });
    const second = await fetchEspn({
      key: 'k',
      url: 'https://example.test',
      schema,
      now: clock.now,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.data).toEqual(VALID);
  });

  it('refetches once the window has passed', async () => {
    const clock = controllableClock();
    const fetchImpl = vi.fn(async () => jsonResponse(VALID));
    const args = {
      key: 'k',
      url: 'https://example.test',
      schema,
      now: clock.now,
      fetchImpl,
    };

    await fetchEspn(args);
    clock.advance(CACHE_TTL_MS + 1);
    const after = await fetchEspn(args);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(after.cached).toBe(false);
  });

  it('keeps the window within the 10-15s the brief asked for', () => {
    expect(CACHE_TTL_MS).toBeGreaterThanOrEqual(10_000);
    expect(CACHE_TTL_MS).toBeLessThanOrEqual(15_000);
  });

  it('caches per key, so two dates do not collide', async () => {
    const clock = controllableClock();
    const fetchImpl = vi.fn(async () => jsonResponse(VALID));

    await fetchEspn({
      key: 'a',
      url: 'https://a.test',
      schema,
      now: clock.now,
      fetchImpl,
    });
    await fetchEspn({
      key: 'b',
      url: 'https://b.test',
      schema,
      now: clock.now,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('fetchEspn validation', () => {
  it('throws a SchemaError naming the field that broke', async () => {
    const fetchImpl = async () => jsonResponse({ events: [{ id: 42 }] });

    const error = await fetchEspn({
      key: 'k',
      url: 'https://example.test',
      schema,
      fetchImpl,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SchemaError);
    expect((error as SchemaError).issues.join()).toMatch(/events\.0\.id/);
  });

  it('logs the failing field path', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = async () => jsonResponse({ events: [{ id: 42 }] });

    await fetchEspn({
      key: 'scoreboard:x',
      url: 'https://e.test',
      schema,
      fetchImpl,
    }).catch(() => undefined);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('scoreboard:x'),
      expect.objectContaining({
        issues: expect.arrayContaining([expect.stringMatching(/id/)]),
      }),
    );
    spy.mockRestore();
  });

  it('never caches a payload that failed validation', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => jsonResponse({ events: [{ id: 42 }] }));
    const args = { key: 'k', url: 'https://example.test', schema, fetchImpl };

    await fetchEspn(args).catch(() => undefined);
    await fetchEspn(args).catch(() => undefined);

    // A bad response must be retried, not served from cache.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

describe('fetchEspn upstream failures', () => {
  it('turns a non-OK response into a 502 UpstreamError', async () => {
    const fetchImpl = async () => jsonResponse({}, 503);

    const error = await fetchEspn({
      key: 'k',
      url: 'https://example.test',
      schema,
      fetchImpl,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(502);
  });

  it('turns a network failure into a 502 rather than leaking the raw error', async () => {
    const fetchImpl = async () => {
      throw new Error('ECONNREFUSED');
    };

    const error = await fetchEspn({
      key: 'k',
      url: 'https://example.test',
      schema,
      fetchImpl,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).status).toBe(502);
  });
});
