'use client';

import React from 'react';
import type { FinalPlace } from '@/lib/pipeline';
import { PlaceImage } from './PlaceImage';

interface PlaceCardProps {
  place: FinalPlace;
}

export function PlaceCard({ place }: PlaceCardProps) {
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    place.name + (place.address ? ` ${place.address}` : '')
  )}`;

  const maxDishes = 6;
  const displayedDishes = place.dishes ? place.dishes.slice(0, maxDishes) : [];
  const remainingDishesCount = place.dishes && place.dishes.length > maxDishes ? place.dishes.length - maxDishes : 0;

  return (
    <article className="place-card" id={`place-${place.id}`}>
      <div className="place-image-frame">
        <PlaceImage
          imageUrl={place.imageUrl}
          name={place.name}
          aspectRatio="16 / 10"
          type="place"
        />
        <div className="place-image-scrim" />
        {typeof place.rating === 'number' && (
          <div className="place-rating-badge" title={`Rating: ${place.rating.toFixed(1)}`}>
            <svg style={{ width: '12px', height: '12px', color: '#F59E0B' }} viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>{place.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="place-content-body">
        <h4 className="place-title">{place.name}</h4>

        {place.address && (
          <div
            className="place-address"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            <svg style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '3px', color: 'var(--color-ink-muted)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ userSelect: 'text', WebkitUserSelect: 'text' }}>{place.address}</span>
          </div>
        )}

        {displayedDishes.length > 0 && (
          <div className="dish-chips-row">
            {displayedDishes.map((dish, idx) => (
              <span key={idx} className="dish-chip">
                {dish}
              </span>
            ))}
            {remainingDishesCount > 0 && (
              <span className="dish-chip more-chip" title={place.dishes.slice(maxDishes).join(', ')}>
                +{remainingDishesCount} more
              </span>
            )}
          </div>
        )}

        {place.blurb !== null && (
          <p className="place-blurb">
            {place.blurb}
          </p>
        )}

        <div className="place-actions-row">
          {/* Directions is always available with place name & address */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-icon-circle-btn"
            aria-label={`Get directions to ${place.name}`}
            title="Directions on Google Maps"
            style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', touchAction: 'manipulation' }}
          >
            <svg className="ui-icon" viewBox="0 0 24 24">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </a>

          {/* Website button (only rendered if website exists) */}
          {place.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="action-icon-circle-btn"
              aria-label={`Visit website for ${place.name}`}
              title="Official Website"
              style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', touchAction: 'manipulation' }}
            >
              <svg className="ui-icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </a>
          )}

          {/* Phone button (only rendered if phone exists) */}
          {place.phone && (
            <a
              href={`tel:${place.phone}`}
              className="action-icon-circle-btn"
              aria-label={`Call ${place.phone}`}
              title={`Call ${place.phone}`}
              style={{ width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', touchAction: 'manipulation' }}
            >
              <svg className="ui-icon" viewBox="0 0 24 24">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
