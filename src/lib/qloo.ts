export class QlooApiError extends Error {
  public readonly status?: number;
  public readonly endpoint: string;

  constructor(message: string, options?: { status?: number; endpoint?: string }) {
    // Ensure that even if someone accidentally passes an API key in a string, we strip potential secrets
    const sanitizedMessage = QlooApiError.sanitize(message);
    super(sanitizedMessage);
    this.name = 'QlooApiError';
    this.status = options?.status;
    this.endpoint = options?.endpoint ? QlooApiError.sanitize(options.endpoint) : '';
    Object.setPrototypeOf(this, QlooApiError.prototype);
  }

  public static sanitize(str: string): string {
    const key = process.env.QLOO_API_KEY;
    let sanitized = str;
    if (key && key.length > 4) {
      sanitized = sanitized.split(key).join('[REDACTED]');
    }
    if (sanitized.includes('<html') || sanitized.includes('<!DOCTYPE') || sanitized.includes('<body')) {
      sanitized = sanitized.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return sanitized;
  }
}

export interface QlooEntity {
  entity_id: string;
  name: string;
  subtype?: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface QlooTag {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SearchParams {
  query: string;
  types?: string;
  take?: number;
}

export interface TagsParams {
  query: string;
  take?: number;
}

export interface InsightsParams {
  filterType?: string; // defaults to 'urn:entity:place'
  signalEntities?: string[] | string;
  filterTags?: string;
  filterLocationQuery?: string;
  take?: number;
  offset?: number;
}

export interface QlooClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
  debug?: boolean;
}

export class QlooClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly debug: boolean;

  constructor(config?: QlooClientConfig) {
    const key = config?.apiKey || process.env.QLOO_API_KEY;
    if (!key) {
      throw new QlooApiError('QLOO_API_KEY environment variable is missing or empty');
    }
    this.apiKey = key;
    this.baseUrl = (config?.baseUrl || 'https://hackathon.api.qloo.com').replace(/\/+$/, '');
    this.timeoutMs = config?.timeoutMs ?? 15000;
    this.maxRetries = config?.maxRetries ?? 3;
    this.fetchFn = config?.fetchFn || globalThis.fetch;
    this.debug = config?.debug ?? (process.env.DEBUG_QLOO === 'true' || process.env.DEBUG === 'true');
  }

  private async request<T>(endpoint: string, queryParams: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    }

    if (this.debug) {
      // Log ONLY endpoint and query string - NEVER log headers or API keys
      console.log(`[QLOO DEBUG] ${endpoint}?${url.searchParams.toString()}`);
    }

    let attempt = 0;
    let delay = 300;

    while (attempt <= this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await this.fetchFn(url.toString(), {
          method: 'GET',
          headers: {
            'X-Api-Key': this.apiKey,
            Accept: 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.status === 429 || res.status >= 500) {
          if (attempt <= this.maxRetries) {
            // Exponential backoff with jitter
            const backoff = delay * Math.pow(2, attempt - 1) + Math.random() * 100;
            await new Promise((resolve) => setTimeout(resolve, backoff));
            continue;
          }
          if (res.status === 429) {
            throw new QlooApiError(`Rate limit exceeded (429) after ${this.maxRetries} retries`, {
              status: 429,
              endpoint,
            });
          }
        }

        if (!res.ok) {
          let errText = '';
          try {
            errText = await res.text();
          } catch {
            errText = res.statusText;
          }
          if (errText.includes('<html') || errText.includes('<!DOCTYPE') || errText.includes('<body')) {
            errText = res.statusText || 'Server Error';
          }
          throw new QlooApiError(`Request failed with status ${res.status}: ${errText}`, {
            status: res.status,
            endpoint,
          });
        }

        const data = (await res.json()) as T;
        return data;
      } catch (err: unknown) {
        clearTimeout(timer);
        if (err instanceof QlooApiError) {
          throw err;
        }

        const isAbort = (err as Error)?.name === 'AbortError';
        const msg = isAbort ? `Request timeout after ${this.timeoutMs}ms` : (err as Error)?.message || 'Network error';

        if (attempt <= this.maxRetries && !isAbort) {
          const backoff = delay * Math.pow(2, attempt - 1) + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        throw new QlooApiError(`Request to ${endpoint} failed: ${msg}`, { endpoint });
      }
    }

    throw new QlooApiError(`Request failed after ${this.maxRetries} attempts`, { endpoint });
  }

  /**
   * Search for entities by name and optionally type.
   * If types is provided but returns empty results, automatically retries without types.
   */
  async search(params: SearchParams): Promise<QlooEntity[]> {
    const queryParams: Record<string, string | number | undefined> = {
      query: params.query,
      take: params.take ?? 3,
    };
    if (params.types) {
      queryParams.types = params.types;
    }

    const response = await this.request<any>('/search', queryParams);
    let entities: QlooEntity[] = [];

    if (Array.isArray(response)) {
      entities = response;
    } else if (response && Array.isArray(response.results)) {
      entities = response.results;
    } else if (response && Array.isArray(response.entities)) {
      entities = response.entities;
    } else if (response && Array.isArray(response.data)) {
      entities = response.data;
    }

    // "Retry without `types` if empty."
    if (entities.length === 0 && params.types) {
      const retryResponse = await this.request<any>('/search', {
        query: params.query,
        take: params.take ?? 3,
      });

      if (Array.isArray(retryResponse)) {
        entities = retryResponse;
      } else if (retryResponse && Array.isArray(retryResponse.results)) {
        entities = retryResponse.results;
      } else if (retryResponse && Array.isArray(retryResponse.entities)) {
        entities = retryResponse.entities;
      } else if (retryResponse && Array.isArray(retryResponse.data)) {
        entities = retryResponse.data;
      }
    }

    return entities;
  }

  /**
   * Find tags matching keyword query.
   * GET /v2/tags?filter.query=<keyword>
   */
  async tags(params: TagsParams): Promise<QlooTag[]> {
    const queryParams: Record<string, string | number | undefined> = {
      'filter.query': params.query,
    };
    if (params.take) {
      queryParams.take = params.take;
    }

    const response = await this.request<any>('/v2/tags', queryParams);
    if (Array.isArray(response)) {
      return response;
    } else if (response?.results?.tags && Array.isArray(response.results.tags)) {
      return response.results.tags;
    } else if (response && Array.isArray(response.results)) {
      return response.results;
    } else if (response && Array.isArray(response.tags)) {
      return response.tags;
    } else if (response && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  /**
   * Insights call.
   * GET /v2/insights with:
   * filter.type=urn:entity:place
   * signal.interests.entities=<comma-separated entity_ids>
   * filter.tags=<tag id>
   * filter.location.query=<city>
   * take=10
   */
  async insights(params: InsightsParams): Promise<any> {
    const queryParams: Record<string, string | number | undefined> = {
      'filter.type': params.filterType || 'urn:entity:place',
    };

    if (params.signalEntities) {
      queryParams['signal.interests.entities'] = Array.isArray(params.signalEntities)
        ? params.signalEntities.join(',')
        : params.signalEntities;
    }

    if (params.filterTags) {
      queryParams['filter.tags'] = params.filterTags;
    }

    if (params.filterLocationQuery) {
      queryParams['filter.location.query'] = params.filterLocationQuery;
    }

    if (params.take) {
      queryParams.take = params.take;
    }

    if (params.offset !== undefined) {
      queryParams.offset = params.offset;
    }

    return await this.request<any>('/v2/insights', queryParams);
  }
}
