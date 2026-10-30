'use client';

import React from 'react';
import type { TasteVsBaseline as TasteVsBaselineType } from '@/lib/pipeline';

interface TasteVsBaselineProps {
  data?: TasteVsBaselineType;
}

export function TasteVsBaseline({ data }: TasteVsBaselineProps) {
  // Render ONLY if result.tasteVsBaseline exists with data; otherwise render nothing.
  if (!data || !data.tasteTop || data.tasteTop.length === 0) {
    return null;
  }

  const destination = data.destination || 'destination';

  return (
    <section className="baseline-card" style={{ marginTop: '50px' }}>
      <div className="baseline-header-area">
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '1.65rem', fontWeight: 700 }}>
            Your taste vs a generic {destination} area
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)', margin: 0, maxWidth: '680px', lineHeight: 1.5 }}>
            The most common cuisine tags among the top 50 places Qloo returned for your taste, compared with the same query using no taste signals. A place can carry several tags.
          </p>
        </div>

        {/* Legend using the exact two labels */}
        <div
          style={{
            fontSize: '0.82rem',
            color: 'var(--color-ink-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'var(--color-terracotta)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Your taste</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'var(--color-teal)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>Generic {destination} baseline</span>
          </div>
        </div>
      </div>

      <div className="baseline-grid">
        {/* Left Column: Your Taste Profile */}
        <div className="baseline-column-panel">
          <div className="baseline-panel-title-row">
            <div className="baseline-panel-title">
              <svg className="ui-icon" style={{ color: 'var(--color-terracotta)' }} viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>Your taste</span>
            </div>
            <span className="baseline-pill-indicator taste">TOP 50 PLACES</span>
          </div>

          <div>
            {data.tasteTop.map((item, idx) => {
              const pct = Math.min(100, Math.round((item.count / 50) * 100));
              return (
                <div key={idx} className="graph-bar-row">
                  <div className="graph-bar-label">
                    <span>{item.tagName}</span>
                    <span className="graph-bar-count">{item.count} / 50</span>
                  </div>
                  <div className="graph-bar-track">
                    <div
                      className="graph-bar-fill terracotta"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Generic Destination Baseline */}
        <div className="baseline-column-panel">
          <div className="baseline-panel-title-row">
            <div className="baseline-panel-title">
              <svg className="ui-icon" style={{ color: 'var(--color-teal)' }} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Generic {destination} baseline</span>
            </div>
            <span className="baseline-pill-indicator generic">TOP 50 PLACES</span>
          </div>

          <div>
            {data.baselineTop.map((item, idx) => {
              const pct = Math.min(100, Math.round((item.count / 50) * 100));
              return (
                <div key={idx} className="graph-bar-row">
                  <div className="graph-bar-label">
                    <span>{item.tagName}</span>
                    <span className="graph-bar-count">{item.count} / 50</span>
                  </div>
                  <div className="graph-bar-track">
                    <div
                      className="graph-bar-fill teal"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
