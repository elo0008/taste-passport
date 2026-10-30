'use client';

import React from 'react';
import type { FavoriteSignalCheck } from '@/lib/cuisine-inference';

interface SignalCheckProps {
  signals: FavoriteSignalCheck[];
  destination?: string;
}

export function SignalCheck({ signals, destination = 'destination' }: SignalCheckProps) {
  if (!signals || signals.length === 0) return null;

  return (
    <section className="signal-check-container" style={{ marginTop: '50px' }}>
      <div className="signal-check-header">
        <div className="passport-stamp" style={{ marginBottom: '8px' }}>
          Per-favorite check
        </div>
        <h3 id="signalCheckHeading" style={{ margin: '0 0 6px 0', fontSize: '1.65rem', fontWeight: 700 }}>
          Signal Check
        </h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)', margin: 0 }}>
          Shows which cuisines appear most often among each favorite&apos;s own top 50 places in {destination} area.
        </p>
      </div>

      <div className="signal-check-cards-grid-2col">
        {signals.map((sig, idx) => {
          const isConsistent = sig.isConsistent;

          if (!isConsistent) {
            // Pulled in a different direction: spans full row, muted warm grey, no red, no error icon
            return (
              <div
                key={idx}
                className="signal-card-box different-direction-card"
                style={{ gridColumn: '1 / -1' }}
              >
                <div className="signal-card-top">
                  <div className="signal-entity-name">
                    <svg className="ui-icon" style={{ color: 'var(--color-ink-muted)' }} viewBox="0 0 24 24">
                      <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                      <line x1="7" y1="2" x2="7" y2="22" />
                      <line x1="17" y1="2" x2="17" y2="22" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                    <span>{sig.favoriteName}</span>
                  </div>

                  <span className="signal-status-pill muted">
                    Different direction
                  </span>
                </div>

                {sig.topTags && sig.topTags.length > 0 && (
                  <div className="signal-badges-row">
                    {sig.topTags.map((tag, tagIdx) => (
                      <span key={tagIdx} className="signal-count-chip muted">
                        <span>{tag.tagName}</span>
                        <strong style={{ marginLeft: '4px' }}>{tag.count} / 50</strong>
                      </span>
                    ))}
                  </div>
                )}

                <div className="signal-body-text-muted">
                  Pulled in a different direction (not used for the categories above)
                </div>
              </div>
            );
          }

          // Consistent card
          return (
            <div key={idx} className="signal-card-box consistent-card">
              <div className="signal-card-top">
                <div className="signal-entity-name">
                  <svg className="ui-icon" style={{ color: 'var(--color-teal)' }} viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                    <line x1="7" y1="2" x2="7" y2="22" />
                    <line x1="17" y1="2" x2="17" y2="22" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                  </svg>
                  <span>{sig.favoriteName}</span>
                </div>

                <span className="signal-status-pill consistent">
                  <svg className="ui-icon" style={{ width: '13px', height: '13px' }} viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Consistent</span>
                </span>
              </div>

              {sig.topTags && sig.topTags.length > 0 && (
                <div className="signal-badges-row">
                  {sig.topTags.map((tag, tagIdx) => (
                    <span key={tagIdx} className="signal-count-chip">
                      <span>{tag.tagName}</span>
                      <strong style={{ marginLeft: '4px' }}>{tag.count} / 50</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Caption explaining counts */}
      <div className="signal-grid-caption">
        Counts reflect the number of places among the top 50 returned by Qloo for that favorite alone that carry each cuisine tag. Favorites that pull in a different direction from your overall profile are excluded from final category assembly.
      </div>
    </section>
  );
}
