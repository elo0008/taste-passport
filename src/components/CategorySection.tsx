'use client';

import React from 'react';
import type { FinalCategory } from '@/lib/pipeline';
import { PlaceCard } from './PlaceCard';

interface CategorySectionProps {
  category: FinalCategory;
  categoryIndex?: number;
}

export function CategorySection({ category, categoryIndex }: CategorySectionProps) {
  const isGrocery = category.kind === 'grocery';
  const slugId = `category-${category.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <section className="category-section-block" id={slugId}>
      <div className="category-header-row">
        <div className="category-title-group">
          <h3 className="category-title">{category.title}</h3>
          <span
            className={`category-kind-badge ${isGrocery ? 'grocery' : 'inferred'}`}
          >
            {category.kindLabel}
          </span>
          <span className="category-badge-pill">
            {category.badge}
          </span>
          {!isGrocery && category.tasteLiftBadge && (
            <span
              className="category-badge-pill"
              style={{
                background: category.rawTasteLift < 0.3 ? 'var(--bg-subtle)' : 'var(--color-teal-light)',
                color: category.rawTasteLift < 0.3 ? 'var(--color-ink-muted)' : 'var(--color-teal)',
                borderColor: category.rawTasteLift < 0.3 ? 'var(--color-hairline)' : 'rgba(15, 92, 92, 0.2)',
              }}
            >
              {category.tasteLiftBadge}
            </span>
          )}
        </div>
      </div>

      <p className="category-intro">{category.intro}</p>

      <div className="place-cards-grid">
        {category.places.map((place) => (
          <PlaceCard key={place.id} place={place} />
        ))}
      </div>
    </section>
  );
}
