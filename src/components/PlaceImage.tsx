'use client';

import React, { useState } from 'react';

interface PlaceImageProps {
  imageUrl?: string | null;
  name: string;
  aspectRatio?: string;
  type?: 'place' | 'candidate';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const PALETTES = [
  { bg1: '#0F5C5C', bg2: '#0B4646', accent: '#E8A33D' },
  { bg1: '#D86028', bg2: '#B4492F', accent: '#F5A623' },
  { bg1: '#15222B', bg2: '#2B3B46', accent: '#D86028' },
  { bg1: '#E8A33D', bg2: '#D86028', accent: '#0F5C5C' },
  { bg1: '#0F5C5C', bg2: '#2D7364', accent: '#FAF6EF' },
];

export function PlaceImage({
  imageUrl,
  name,
  aspectRatio = '16 / 10',
  type = 'place',
}: PlaceImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const hash = hashString(name);
  const palette = PALETTES[hash % PALETTES.length];

  const showRealImage = Boolean(imageUrl && !failed);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        overflow: 'hidden',
        background: 'var(--bg-subtle)',
        borderRadius: type === 'candidate' ? 'var(--radius-sm)' : undefined,
      }}
    >
      {showRealImage ? (
        <>
          {/* Skeleton/Placeholder while loading */}
          {!loaded && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${palette.bg1} 0%, ${palette.bg2} 100%)`,
                opacity: 0.15,
              }}
              aria-hidden="true"
            />
          )}
          <img
            src={imageUrl!}
            alt={name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: loaded ? 1 : 0,
              transition: 'opacity 300ms cubic-bezier(0.2, 0.7, 0.2, 1)',
            }}
          />
        </>
      ) : (
        /* Deterministic palette-constrained gradient placeholder */
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${palette.bg1} 0%, ${palette.bg2} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: palette.accent,
          }}
        >
          {type === 'candidate' ? (
            <svg
              style={{ width: '40%', height: '40%', opacity: 0.85 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          ) : (
            <svg
              style={{ width: '30%', height: '30%', opacity: 0.85 }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
