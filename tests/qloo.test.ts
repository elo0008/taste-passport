import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QlooClient, QlooApiError } from '@/lib/qloo';

// SYNTHETIC FIXTURES - None of this data comes from Qloo API
const SYNTHETIC_API_KEY = 'synthetic-secret-key-12345';

const SYNTHETIC_FIXTURE_SEARCH_RESULTS = {
  results: [
    {
      entity_id: 'synthetic-ent-001',
      name: 'SYNTHETIC_ARTIST_NAME',
      subtype: 'urn:entity:artist',
      properties: { synthetic_score: 99 },
    },
  ],
};

const SYNTHETIC_FIXTURE_EMPTY_RESULTS = {
  results: [],
};

const SYNTHETIC_FIXTURE_TAGS_RESULTS = {
  success: true,
  results: {
    tags: [
      {
        id: 'urn:tag:genre:place:restaurant:synthetic',
        name: 'Synthetic Restaurant',
      },
    ],
  },
};

const SYNTHETIC_FIXTURE_INSIGHTS_RESULTS = {
  success: true,
  results: {
    entities: [
      {
        entity_id: 'synthetic-place-001',
        name: 'SYNTHETIC_PLACE_NAME',
        subtype: 'urn:entity:place',
        properties: {
          address: '123 Synthetic St, Toronto',
        },
      },
    ],
  },
};

describe('QlooClient (Unit Tests with SYNTHETIC fixtures)', () => {
  const originalEnv = process.env.QLOO_API_KEY;

  beforeEach(() => {
    process.env.QLOO_API_KEY = SYNTHETIC_API_KEY;
  });

  afterEach(() => {
    process.env.QLOO_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it('sends GET method, X-Api-Key header, and query parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SYNTHETIC_FIXTURE_TAGS_RESULTS,
    });

    const client = new QlooClient({
      apiKey: SYNTHETIC_API_KEY,
      fetchFn: mockFetch as any,
    });

    const tags = await client.tags({ query: 'synthetic-query', take: 5 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];

    expect(calledInit.method).toBe('GET');
    expect(calledInit.headers['X-Api-Key']).toBe(SYNTHETIC_API_KEY);

    const parsedUrl = new URL(calledUrl);
    expect(parsedUrl.pathname).toBe('/v2/tags');
    expect(parsedUrl.searchParams.get('filter.query')).toBe('synthetic-query');
    expect(parsedUrl.searchParams.get('take')).toBe('5');
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe('Synthetic Restaurant');
  });

  it('retries on 429 status code and succeeds on subsequent attempt', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          text: async () => 'Rate limit exceeded',
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => SYNTHETIC_FIXTURE_INSIGHTS_RESULTS,
      };
    });

    const client = new QlooClient({
      apiKey: SYNTHETIC_API_KEY,
      fetchFn: mockFetch as any,
      maxRetries: 3,
    });

    const insights = await client.insights({
      filterLocationQuery: 'Toronto',
    });

    expect(callCount).toBe(3);
    expect(insights.results.entities[0].name).toBe('SYNTHETIC_PLACE_NAME');
  });

  it('throws QlooApiError after exhausting 429 retries', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit reached',
    });

    const client = new QlooClient({
      apiKey: SYNTHETIC_API_KEY,
      fetchFn: mockFetch as any,
      maxRetries: 2,
    });

    await expect(client.insights({ filterLocationQuery: 'Toronto' })).rejects.toThrow(QlooApiError);
  });

  it('never leaks the API key in thrown errors even if server reflects it', async () => {
    const serverMessageWithSecret = `Failed to authenticate with key ${SYNTHETIC_API_KEY} at /v2/insights`;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => serverMessageWithSecret,
    });

    const client = new QlooClient({
      apiKey: SYNTHETIC_API_KEY,
      fetchFn: mockFetch as any,
      maxRetries: 0,
    });

    try {
      await client.insights({ filterLocationQuery: 'Toronto' });
      expect.fail('Expected call to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(QlooApiError);
      expect(err.message).not.toContain(SYNTHETIC_API_KEY);
      expect(err.message).toContain('[REDACTED]');
    }
  });

  it('retries search without types parameter when typed search yields no results', async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async (urlStr: string) => {
      callCount++;
      const url = new URL(urlStr);
      if (url.searchParams.has('types')) {
        return {
          ok: true,
          status: 200,
          json: async () => SYNTHETIC_FIXTURE_EMPTY_RESULTS,
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => SYNTHETIC_FIXTURE_SEARCH_RESULTS,
      };
    });

    const client = new QlooClient({
      apiKey: SYNTHETIC_API_KEY,
      fetchFn: mockFetch as any,
    });

    const entities = await client.search({
      query: 'Synthetic Query',
      types: 'urn:entity:artist',
    });

    expect(callCount).toBe(2);
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe('SYNTHETIC_ARTIST_NAME');

    // First call had types
    const firstUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(firstUrl.searchParams.get('types')).toBe('urn:entity:artist');

    // Second call omitted types
    const secondUrl = new URL(mockFetch.mock.calls[1][0]);
    expect(secondUrl.searchParams.has('types')).toBe(false);
  });

  it('insights constructs valid query params and NEVER sends signal.location.query', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SYNTHETIC_FIXTURE_INSIGHTS_RESULTS,
    });

    const client = new QlooClient({
      apiKey: SYNTHETIC_API_KEY,
      fetchFn: mockFetch as any,
    });

    await client.insights({
      filterType: 'urn:entity:place',
      signalEntities: ['ent-1', 'ent-2'],
      filterTags: 'urn:tag:genre:place:restaurant:indian',
      filterLocationQuery: 'Toronto',
      take: 10,
    });

    const [calledUrl] = mockFetch.mock.calls[0];
    const parsedUrl = new URL(calledUrl);

    expect(parsedUrl.searchParams.get('filter.type')).toBe('urn:entity:place');
    expect(parsedUrl.searchParams.get('signal.interests.entities')).toBe('ent-1,ent-2');
    expect(parsedUrl.searchParams.get('filter.tags')).toBe('urn:tag:genre:place:restaurant:indian');
    expect(parsedUrl.searchParams.get('filter.location.query')).toBe('Toronto');
    expect(parsedUrl.searchParams.get('take')).toBe('10');
    expect(parsedUrl.searchParams.has('signal.location.query')).toBe(false);
  });
});
