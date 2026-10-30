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
            <span className="rating-star-icon">★</span>
            <span>{place.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="place-content-body">
        <h4 className="place-title">{place.name}</h4>

        {place.address && (
          <div className="place-address">
            📍 {place.address}
          </div>
        )}

        {place.dishes && place.dishes.length > 0 && (
          <div className="dish-chips-row">
            {place.dishes.map((dish, idx) => (
              <span key={idx} className="dish-chip">
                {dish}
              </span>
            ))}
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
