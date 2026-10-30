'use client';

import React from 'react';
import type { FinalCategory, FinalPlace } from '@/lib/pipeline';

interface FirstMonthPlanProps {
  firstMonthText: string;
  categories: FinalCategory[];
}

interface ParsedWeek {
  weekNum: number;
  title: string;
  copy: string;
  mentionedPlaces: { id: string; name: string }[];
}

export function FirstMonthPlan({ firstMonthText, categories }: FirstMonthPlanProps) {
  // Collect all places across categories for cross-referencing
  const allPlaces: FinalPlace[] = [];
  categories.forEach((cat) => {
    cat.places.forEach((p) => {
      if (!allPlaces.some((existing) => existing.id === p.id)) {
        allPlaces.push(p);
      }
    });
  });

  // Attempt to parse into 4 weeks
  const weeks: ParsedWeek[] = [];
  const weekRegex = /Week\s*([1-4])\s*[:\-–]\s*([^\n\r]+)([\s\S]*?)(?=(?:Week\s*[1-4]\s*[:\-–]|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = weekRegex.exec(firstMonthText)) !== null) {
    const num = parseInt(match[1], 10);
    const title = match[2].trim();
    const copy = match[3].trim();

    const fullWeekText = `${title} ${copy}`.toLowerCase();
    const mentioned = allPlaces
      .filter((p) => fullWeekText.includes(p.name.toLowerCase()))
      .map((p) => ({ id: p.id, name: p.name }));

    weeks.push({
      weekNum: num,
      title,
      copy,
      mentionedPlaces: mentioned,
    });
  }

  // If regex found weeks, render as 4 week cards
  if (weeks.length > 0) {
    return (
      <section className="settling-guide-section">
        <div className="settling-guide-header">
          <div className="passport-stamp teal" style={{ marginBottom: '8px' }}>
            Itinerary
          </div>
          <h3>First Month Settling Guide</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
            A 4-week roadmap to help you establish roots through familiar comfort flavors. Click any venue to view its details below.
          </p>
        </div>

        <div className="settling-guide-grid">
          {weeks.map((w) => (
            <article key={w.weekNum} className="week-settling-card">
              <span className="week-card-badge">Week {w.weekNum}</span>
              <h4 className="week-card-title">{w.title}</h4>
              <p className="week-card-copy">{w.copy}</p>

              {w.mentionedPlaces.length > 0 && (
                <div className="week-places-list">
                  {w.mentionedPlaces.map((pl) => (
                    <a
                      key={pl.id}
                      href={`#place-${pl.id}`}
                      className="week-place-anchor"
                    >
                      <span>{pl.name}</span>
                      <svg className="ui-icon" viewBox="0 0 24 24">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Fallback: render as single formatted editorial card if week regex doesn't match
  return (
    <section className="settling-guide-section">
      <div className="settling-guide-header">
        <div className="passport-stamp teal" style={{ marginBottom: '8px' }}>
          Itinerary
        </div>
        <h3>First Month Settling Guide</h3>
      </div>
      <div
        className="week-settling-card"
        style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}
      >
        <p className="week-card-copy" style={{ margin: 0 }}>
          {firstMonthText}
        </p>
      </div>
    </section>
  );
}
