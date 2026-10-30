'use client';

import React from 'react';
import type { FavoriteSignalCheck } from '@/lib/cuisine-inference';

interface SignalCheckProps {
  signals: FavoriteSignalCheck[];
}

export function SignalCheck({ signals }: SignalCheckProps) {
  if (!signals || signals.length === 0) return null;

  return (
    <section className="signal-check-container">
      <div className="signal-check-header">
        <div className="passport-stamp" style={{ marginBottom: '8px' }}>
          Attribution Model
        </div>
        <h3>Signal Check (Qloo Taste Attribution)</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
          Shows which regional cuisines were uniquely enriched in Qloo&apos;s taste graph by each favorite alone.
        </p>
      </div>

      <div className="signal-check-cards-grid">
        {signals.map((sig, idx) => {
          const isConsistent = sig.isConsistent;
          return (
            <div
              key={idx}
              className={`signal-card-box ${isConsistent ? 'consistent-card' : 'pulled-card'}`}
            >
              <div className="signal-card-top">
                <div className="signal-entity-name">
                  <svg
                    className="ui-icon"
                    style={{ color: isConsistent ? 'var(--color-teal)' : 'var(--color-brick)' }}
                    viewBox="0 0 24 24"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                    <line x1="7" y1="2" x2="7" y2="22" />
                    <line x1="17" y1="2" x2="17" y2="22" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                  <span>{sig.favoriteName}</span>
                </div>

                <span className={`signal-status-badge ${isConsistent ? 'consistent' : 'pulled'}`}>
                  {isConsistent ? (
                    <>
                      <svg className="ui-icon" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Consistent</span>
                    </>
                  ) : (
                    <>
                      <svg className="ui-icon" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      <span>Pulled elsewhere</span>
                    </>
                  )}
                </span>
              </div>

              {sig.enrichedTags && sig.enrichedTags.length > 0 && (
                <div className="signal-badges-row">
                  {sig.enrichedTags.map((tag, tagIdx) => (
                    <span
                      key={tagIdx}
                      className={`signal-multiplier-tag ${!isConsistent ? 'muted-tag' : ''}`}
                    >
                      <span>{tag.name}</span>
                      <em>{tag.enrichment.toFixed(1)}x</em>
                    </span>
                  ))}
                </div>
              )}

              <div
                className="signal-footnote-text"
                style={{ color: isConsistent ? 'var(--color-ink-muted)' : 'var(--color-brick)' }}
              >
                {sig.summary}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
