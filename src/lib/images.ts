/**
 * Image extraction, sanitization, and allowlist security for Taste Passport.
 * Hotlink only; no proxying, downloading, or caching to disk.
 */

// Hostnames allowlist discovered through inspection of Qloo places & entities
export const ALLOWED_IMAGE_HOSTS = ['images.qloo.com'] as const;

const ALLOWED_HOSTS_SET = new Set<string>(ALLOWED_IMAGE_HOSTS);

export interface RawImageItem {
  url?: string;
  width?: number;
  height?: number;
  type?: string;
  [key: string]: any;
}

/**
 * Sanitizes an image URL:
 * - Must be a valid HTTPS URL
 * - Strictly rejects http:, data:, javascript:, protocol-relative (//)
 * - Must match the ALLOWED_IMAGE_HOSTS allowlist
 * - Returns normalized URL string or null
 */
export function sanitizeImageUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject protocol-relative or dangerous schemes before URL parsing
  if (
    trimmed.startsWith('//') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('http:')
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS_SET.has(hostname)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts a single safe image URL from an entity's properties:
 * - Checks properties.images[], properties.image, entity.images[], entity.image
 * - Prefers an image with width >= 400 if dimensions are present
 * - Otherwise falls back to the first valid sanitized image
 * - Returns https URL or null
 */
export function extractSafeImageUrl(entity: any): string | null {
  if (!entity || typeof entity !== 'object') return null;

  const props = entity.properties || {};
  const imageList: RawImageItem[] = [];

  // 1. properties.images (array)
  if (Array.isArray(props.images)) {
    for (const item of props.images) {
      if (typeof item === 'string') {
        imageList.push({ url: item });
      } else if (item && typeof item === 'object' && typeof item.url === 'string') {
        imageList.push(item);
      }
    }
  }

  // 2. properties.image (object or string)
  if (props.image) {
    if (typeof props.image === 'string') {
      imageList.push({ url: props.image });
    } else if (typeof props.image === 'object' && typeof props.image.url === 'string') {
      imageList.push(props.image);
    }
  }

  // 3. Top-level images (array fallback)
  if (Array.isArray(entity.images)) {
    for (const item of entity.images) {
      if (typeof item === 'string') {
        imageList.push({ url: item });
      } else if (item && typeof item === 'object' && typeof item.url === 'string') {
        imageList.push(item);
      }
    }
  }

  // 4. Top-level image (object or string fallback)
  if (entity.image) {
    if (typeof entity.image === 'string') {
      imageList.push({ url: entity.image });
    } else if (typeof entity.image === 'object' && typeof entity.image.url === 'string') {
      imageList.push(entity.image);
    }
  }

  if (imageList.length === 0) return null;

  // Preference rule: if dimensions exist, prefer width >= 400
  const largeCandidate = imageList.find(
    (img) => typeof img.width === 'number' && img.width >= 400 && sanitizeImageUrl(img.url) !== null
  );

  if (largeCandidate && largeCandidate.url) {
    return sanitizeImageUrl(largeCandidate.url);
  }

  // Otherwise pick the first valid sanitized image
  for (const img of imageList) {
    const validUrl = sanitizeImageUrl(img.url);
    if (validUrl) {
      return validUrl;
    }
  }

  return null;
}

