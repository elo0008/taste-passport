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

  const parseWeekCards = (): ParsedWeekCard[] => {
    const cards: ParsedWeekCard[] = [];
    const weekSplitRegex = /(?:^|\b)Week\s*([1-4])(?:\s*[:\-–]\s*|\s+)([\s\S]*?)(?=(?:\bWeek\s*[1-4]|$))/gi;
    let match: RegExpExecArray | null;

    while ((match = weekSplitRegex.exec(firstMonthText)) !== null) {
      const num = parseInt(match[1], 10);
      const bodyText = match[2].trim();
      const cleanBody = bodyText.replace(/^[:\-–]\s*/, '').trim();
      const rawSentence = bodyText.startsWith(':') || bodyText.startsWith('-') || bodyText.startsWith('–')
        ? `Week ${num}: ${cleanBody}`
        : `Week ${num} ${cleanBody}`;
      const fullSentence = rawSentence.replace(/\[cite:?\s*\d*\]/gi, '').trim();

      const existingCard = cards.find((c) => c.weekNum === num);

      // If a card for this week already exists (e.g. "Week 1: Title. Week 1 narrative..."):
      if (existingCard) {
        // If existing card had short text, it might have been a title
        const existingClean = existingCard.sentence.replace(/^Week\s*\d\s*[:\-–]?\s*/i, '').replace(/[.]+$/, '').trim();
        if (existingClean.length > 0 && existingClean.length < 45 && !existingClean.includes(' begins with') && !existingClean.includes(' visit')) {
          existingCard.heading = existingClean;
        }

        // Use the longer, descriptive sentence
        if (fullSentence.length > existingCard.sentence.length) {
          existingCard.sentence = fullSentence;
        } else {
          existingCard.sentence = `${existingCard.sentence} ${fullSentence}`;
        }

        // Supplement places and ensure exactly 2 places
        const extraPlaces = allPlaces.filter((p) =>
          fullSentence.toLowerCase().includes(p.name.toLowerCase())
        );
        const mergedPlaces = [
          ...extraPlaces,
          ...existingCard.places.filter((p) => !extraPlaces.some((ep) => ep.id === p.id)),
        ];
        existingCard.places = mergedPlaces.slice(0, 2);
        continue;
      }

      const weekIdx = num - 1;

      // Check if body starts with a title like "Title. Week N begins..."
      let derivedTitle = '';
      const titleMatch = cleanBody.match(/^([A-Z][^.!?\n]{3,40})(?:[.!?]|\s*–)\s*(.*)$/);
      if (
        titleMatch &&
        !titleMatch[1].toLowerCase().startsWith('visit') &&
        !titleMatch[1].toLowerCase().startsWith('sample') &&
        !titleMatch[1].toLowerCase().startsWith('begin') &&
        !titleMatch[1].toLowerCase().startsWith('start')
      ) {
        derivedTitle = titleMatch[1].trim();
      }

      // 1. Direct match: check if place name appears in the sentence
      let matchedPlaces = allPlaces.filter((p) =>
        fullSentence.toLowerCase().includes(p.name.toLowerCase())
      );

      // 2. Keyword/stem match if direct match didn't find at least 2 places
      if (matchedPlaces.length < 2) {
        const existingIds = new Set(matchedPlaces.map((p) => p.id));
        const keywordMatched = allPlaces.filter((p) => {
          if (existingIds.has(p.id)) return false;
          const words = p.name
            .toLowerCase()
            .split(/[\s,–\-\(\)\/\&]+/)
            .filter(
              (w) =>
                w.length > 3 &&
                ![
                  'restaurant',
                  'cuisine',
                  'kitchen',
                  'house',
                  'bhavan',
                  'dhaba',
                  'dining',
                  'grill',
                  'cafe',
                  'foods',
                  'market',
                  'hotel',
                  'indian',
                  'south',
                  'north',
                  'toronto',
                  'scarborough',
                  'markham',
                ].includes(w)
            );
          return words.some((word) => {
            const re = new RegExp(`\\b${word}\\b`, 'i');
            return re.test(fullSentence);
          });
        });
        matchedPlaces = [...matchedPlaces, ...keywordMatched];
      }

      // 3. Guaranteed allocation from corresponding category or allPlaces
      if (matchedPlaces.length < 2) {
        const existingIds = new Set(matchedPlaces.map((p) => p.id));
        const catPlaces = categories[weekIdx]?.places || [];
        for (const p of catPlaces) {
          if (!existingIds.has(p.id)) {
            matchedPlaces.push(p);
            existingIds.add(p.id);
            if (matchedPlaces.length >= 2) break;
          }
        }
      }

      if (matchedPlaces.length < 2) {
        const existingIds = new Set(matchedPlaces.map((p) => p.id));
        for (const p of allPlaces) {
          if (!existingIds.has(p.id)) {
            matchedPlaces.push(p);
            existingIds.add(p.id);
            if (matchedPlaces.length >= 2) break;
          }
        }
      }

      const finalPlaces = matchedPlaces.slice(0, 2);

      // Editorial card title: derivedTitle > category title > matched place category
      let heading = derivedTitle || '';
      if (!heading && categories[weekIdx]?.title) {
        heading = categories[weekIdx].title;
      } else if (!heading && finalPlaces.length > 0) {
        const parentCategory = categories.find((c) =>
          c.places.some((p) => p.id === finalPlaces[0].id)
        );
        if (parentCategory) {
          heading = parentCategory.title;
        }
      }
      if (!heading) {
        heading = 'Featured Culinary Highlights';
      }

      cards.push({
        weekNum: num,
        heading,
        sentence: fullSentence,
        places: finalPlaces,
      });
    }

    // Fallback if regex found fewer than 2 weeks: parse sentences
    if (cards.length < 2) {
      const sentences = firstMonthText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.replace(/\[cite:?\s*\d*\]/gi, '').trim())
        .filter((s) => s.length > 5);

      if (sentences.length >= 2) {
        sentences.slice(0, 4).forEach((sent, idx) => {
          const num = idx + 1;
          const weekIdx = idx;
          const cleanSent = sent.startsWith(`Week ${num}`) ? sent : `Week ${num}: ${sent}`;

          let matchedPlaces = allPlaces.filter((p) =>
            cleanSent.toLowerCase().includes(p.name.toLowerCase())
          );
          if (matchedPlaces.length < 2) {
            const existingIds = new Set(matchedPlaces.map((p) => p.id));
            const catPlaces = categories[weekIdx]?.places || [];
            for (const p of catPlaces) {
              if (!existingIds.has(p.id)) {
                matchedPlaces.push(p);
                existingIds.add(p.id);
                if (matchedPlaces.length >= 2) break;
              }
            }
          }
          if (matchedPlaces.length < 2) {
            const existingIds = new Set(matchedPlaces.map((p) => p.id));
            for (const p of allPlaces) {
              if (!existingIds.has(p.id)) {
                matchedPlaces.push(p);
                existingIds.add(p.id);
                if (matchedPlaces.length >= 2) break;
              }
            }
          }

          const heading = categories[weekIdx]?.title || 'Featured Culinary Highlights';

          cards.push({
            weekNum: num,
            heading,
            sentence: cleanSent,
            places: matchedPlaces.slice(0, 2),
          });
        });
      }
    }

    return cards;
  };

  const weekCards = parseWeekCards();

  // If parsed 2 or more weeks
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

              <div className="week-places-list">
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
                    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
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
