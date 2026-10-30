'use client';

import React, { useState } from 'react';
import type { PassportResult } from '@/lib/pipeline';

interface ResultsSummaryProps {
  result: PassportResult;
  onEditFavorites: () => void;
  onStartOver: () => void;
}

export function ResultsSummary({ result, onEditFavorites, onStartOver }: ResultsSummaryProps) {
  const [copiedToast, setCopiedToast] = useState(false);

  const totalPlaces = result.categories.reduce((acc, cat) => acc + cat.places.length, 0);
  const elapsedSec = (result.meta.ms / 1000).toFixed(1) + 's';
  const qlooCallsText = `${result.meta.qlooCalls} ${result.meta.qlooCalls === 1 ? 'Qloo call' : 'Qloo calls'}`;
  const llmCallsText = `${result.meta.llmCalls} ${result.meta.llmCalls === 1 ? 'LLM call' : 'LLM calls'}`;

  const handleCopyPlan = async () => {
    try {
      const lines: string[] = [];
      lines.push(`Taste Passport for ${result.destination}`);
      lines.push(`Generated: ${new Date().toLocaleDateString()}`);
      lines.push('');
      lines.push('--- FIRST MONTH SETTLING GUIDE ---');
      lines.push(result.firstMonth);
      lines.push('');
      lines.push('--- RECOMMENDED PLACES ---');
      result.categories.forEach((cat) => {
        lines.push(`\n[${cat.title}] (${cat.kindLabel})`);
        lines.push(cat.intro);
        cat.places.forEach((p) => {
          lines.push(`• ${p.name} - ${p.address || 'Address unlisted'}`);
          if (p.rating) lines.push(`  Rating: ★ ${p.rating.toFixed(1)}`);
          if (p.dishes.length > 0) lines.push(`  Dishes: ${p.dishes.join(', ')}`);
          if (p.blurb) lines.push(`  ${p.blurb}`);
          if (p.phone) lines.push(`  Tel: ${p.phone}`);
          if (p.website) lines.push(`  Web: ${p.website}`);
        });
      });

      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  return (
    <div style={{ marginBottom: '36px' }}>
      {/* Notice Banner with neutral info styling */}
      {result.meta.notice && (
        <div className="notice-banner-strip neutral" role="status">
          <svg
            className="ui-icon"
            style={{ color: 'var(--color-ink-muted)', width: '20px', height: '20px' }}
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-ink)', fontWeight: 500 }}>
            {result.meta.notice}
          </div>
        </div>
      )}

      {/* Execution Metrics Bar */}
      <div className="results-meta-bar">
        <span>⚡ <strong>{elapsedSec}</strong></span>
        <span>📡 <strong>{qlooCallsText}</strong></span>
        <span>🤖 <strong>{llmCallsText}</strong></span>

        {result.meta.groundingViolations === 0 && (
          <span
            style={{
              color: 'var(--color-teal)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <svg className="ui-icon" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Every place shown comes from Qloo&apos;s results ({totalPlaces} places from Qloo)
          </span>
        )}

        {result.meta.droppedCategories &&
          result.meta.droppedCategories.map((droppedCat, idx) => (
            <span
              key={idx}
              className="results-meta-tag"
              style={{
                background: 'var(--bg-subtle)',
                color: 'var(--color-ink-muted)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              Not shown: {droppedCat} (did not pass the coherence check)
            </span>
          ))}

        {result.meta.cached && (
          <span className="results-meta-tag" style={{ background: 'var(--color-teal-light)', color: 'var(--color-teal)' }}>
            CACHED
          </span>
        )}
      </div>

      {/* Action Bar matching outlined pill styling across all 3 buttons */}
      <div className="results-actions-top-bar">
        <button
          type="button"
          onClick={onEditFavorites}
          className="btn-action-pill"
        >
          <svg className="ui-icon" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit favorites</span>
        </button>

        <button
          type="button"
          onClick={onStartOver}
          className="btn-action-pill"
        >
          <svg className="ui-icon" viewBox="0 0 24 24">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <span>Start over</span>
        </button>

        <button
          type="button"
          onClick={handleCopyPlan}
          className="btn-action-pill"
        >
          <svg className="ui-icon" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy plan as text</span>
        </button>
      </div>

      {/* Copied Toast */}
      {copiedToast && (
        <div className="toast-pill" role="status">
          <svg className="ui-icon" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Copied</span>
        </div>
      )}
    </div>
  );
}
