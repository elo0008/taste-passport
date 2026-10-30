'use client';

import React from 'react';
import type { TasteVsBaseline as TasteVsBaselineType } from '@/lib/pipeline';

interface TasteVsBaselineProps {
  data?: TasteVsBaselineType;
}

export function TasteVsBaseline({ data }: TasteVsBaselineProps) {
  if (!data) return null;

  return (
    <section className="baseline-card">
      <div className="baseline-header-area">
        <div>
          <div className="passport-stamp" style={{ marginBottom: '8px' }}>
            Affinity Benchmark
          </div>
          <h3>Taste vs Baseline Comparison</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
            Top cuisines in Qloo&apos;s top 50 places for your taste vs an unguided {data.destination} baseline.
          </p>
        </div>

        <div
          style={{
            fontSize: '0.82rem',
            color: 'var(--color-ink-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
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
            <span>Your Taste</span>
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
            <span>Generic Baseline</span>
          </div>
        </div>
      </div>

      <div className="baseline-grid">
        {/* Left Column: Your Taste Profile */}
        <div className="baseline-column-panel">
          <div className="baseline-panel-title-row">
            <div className="baseline-panel-title">
              <svg className="ui-icon" style={{ color: 'var(--color-terracotta)' }} viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>Your Taste Profile</span>
            </div>
            <span className="baseline-pill-indicator taste">Top 50 Places</span>
          </div>

          <div>
            {data.tasteTop.map((item, idx) => {
              const pct = Math.min(100, Math.round((item.count / 50) * 100));
              return (
                <div key={idx} className="graph-bar-row">
                  <div className="graph-bar-label">
                    <span>{item.tagName}</span>
                    <span>{item.count} / 50</span>
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

        {/* Right Column: Generic Baseline */}
        <div className="baseline-column-panel">
          <div className="baseline-panel-title-row">
            <div className="baseline-panel-title">
              <svg className="ui-icon" style={{ color: 'var(--color-teal)' }} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>Generic {data.destination} Baseline</span>
            </div>
            <span className="baseline-pill-indicator generic">Top 50 Places</span>
          </div>

          <div>
            {data.baselineTop.map((item, idx) => {
              const pct = Math.min(100, Math.round((item.count / 50) * 100));
              return (
                <div key={idx} className="graph-bar-row">
                  <div className="graph-bar-label">
                    <span>{item.tagName}</span>
                    <span>{item.count} / 50</span>
                  </div>
                  <div className="graph-bar-track">
                    <div
                      className="graph-bar-fill"
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
