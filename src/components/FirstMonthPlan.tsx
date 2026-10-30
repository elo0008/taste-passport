'use client';

import React from 'react';
import type { FinalCategory, FinalPlace } from '@/lib/pipeline';

interface FirstMonthPlanProps {
  firstMonthText: string;
  categories: FinalCategory[];
}

interface ParsedWeekCard {
  weekNum: number;
  heading: string;
  sentence: string;
  places: FinalPlace[];
}

export function FirstMonthPlan({ firstMonthText, categories }: FirstMonthPlanProps) {
  // Collect all unique places across categories
  const allPlaces: FinalPlace[] = [];
  categories.forEach((cat) => {
    cat.places.forEach((p) => {
      if (!allPlaces.some((existing) => existing.id === p.id)) {
        allPlaces.push(p);
      }
    });
  });

  const handlePlaceScroll = (e: React.MouseEvent, placeId: string) => {
    e.preventDefault();
    const el = document.getElementById(`place-${placeId}`);
    if (el) {
      const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: isReduced ? 'instant' : 'smooth', block: 'center' });
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', `#place-${placeId}`);
      }
    }
  };

  // Parse into weeks by the "Week N" prefix
  const weekCards: ParsedWeekCard[] = [];
  const weekSplitRegex = /(?:^|\b)Week\s*([1-4])(?:\s*[:\-–]\s*|\s+)([\s\S]*?)(?=(?:\bWeek\s*[1-4]|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = weekSplitRegex.exec(firstMonthText)) !== null) {
    const num = parseInt(match[1], 10);
    const bodyText = match[2].trim();
    const fullSentence = `Week ${num} ${bodyText.startsWith(':') || bodyText.startsWith('-') ? bodyText.slice(1).trim() : bodyText}`;

    // Exact match of place names in this sentence
    const foundPlaces = allPlaces.filter((p) =>
      fullSentence.toLowerCase().includes(p.name.toLowerCase())
    );

    // FIX 4: Use the title of the category that contains the first place named; if none, just "Week N"
    let heading = `Week ${num}`;
    if (foundPlaces.length > 0) {
      const firstPlace = foundPlaces[0];
      const parentCategory = categories.find((c) =>
        c.places.some((p) => p.id === firstPlace.id)
      );
      if (parentCategory) {
        heading = parentCategory.title;
      }
    }

    weekCards.push({
      weekNum: num,
      heading,
      sentence: fullSentence,
      places: foundPlaces,
    });
  }

  // If parsed 4 or more weeks, or at least 2 weeks
  if (weekCards.length >= 2) {
    return (
      <section className="settling-guide-section" style={{ marginTop: '24px' }}>
        <div className="settling-guide-header">
          <div className="passport-stamp teal" style={{ marginBottom: '8px' }}>
            ITINERARY
          </div>
          <h2 id="resultsHeading" tabIndex={-1} style={{ margin: '0 0 6px 0', fontSize: '1.65rem', fontWeight: 700, outline: 'none' }}>
            First Month Settling Guide
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)', margin: 0 }}>
            A four-week plan built only from the places below. Select a place to jump to its card.
          </p>
        </div>

        <div className="settling-guide-grid">
          {weekCards.map((w) => (
            <article key={w.weekNum} className="week-settling-card">
              <span className="week-card-badge">WEEK {w.weekNum}</span>
              <h4 className="week-card-title">{w.heading}</h4>
              <p className="week-card-copy">{w.sentence}</p>

              <div className="week-places-list" style={w.places.length === 0 ? { borderTop: 'none' } : undefined}>
                {w.places.map((pl) => (
                  <a
                    key={pl.id}
                    href={`#place-${pl.id}`}
                    onClick={(e) => handlePlaceScroll(e, pl.id)}
                    className="week-place-anchor"
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pl.name}
                    </span>
                    <svg className="ui-icon" viewBox="0 0 24 24">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </a>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  // Fallback: render single card with full text
  return (
    <section className="settling-guide-section" style={{ marginTop: '24px' }}>
      <div className="settling-guide-header">
        <div className="passport-stamp teal" style={{ marginBottom: '8px' }}>
          ITINERARY
        </div>
        <h2 id="resultsHeading" tabIndex={-1} style={{ margin: '0 0 6px 0', fontSize: '1.65rem', fontWeight: 700, outline: 'none' }}>
          First Month Settling Guide
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)', margin: 0 }}>
          A four-week plan built only from the places below. Select a place to jump to its card.
        </p>
      </div>

      <div className="week-settling-card" style={{ marginTop: '16px' }}>
        <p className="week-card-copy" style={{ margin: 0 }}>
          {firstMonthText}
        </p>
      </div>
    </section>
  );
}
