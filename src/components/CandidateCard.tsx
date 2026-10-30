'use client';

import React from 'react';
import type { ResolveCandidate } from '@/lib/resolve-service';
import { PlaceImage } from './PlaceImage';

interface CandidateCardProps {
  candidate: ResolveCandidate;
  isSelected: boolean;
  onSelect: () => void;
}

export function CandidateCard({ candidate, isSelected, onSelect }: CandidateCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`candidate-card-box ${isSelected ? 'selected' : ''}`}
    >
      <div className="candidate-top-split">
        <div className="candidate-thumb">
          <PlaceImage
            imageUrl={candidate.imageUrl}
            name={candidate.name}
            aspectRatio="68 / 94"
            type="candidate"
          />
        </div>
        <div className="candidate-meta-text">
          <div className="candidate-name">{candidate.name}</div>
          {candidate.year && (
            <div className="candidate-year-badge">{candidate.year}</div>
          )}
          {candidate.disambiguation ? (
            <span className="candidate-tag-type">{candidate.disambiguation}</span>
          ) : (
            <span className="candidate-tag-type">{candidate.type}</span>
          )}
        </div>
      </div>

      {candidate.description && (
        <div className="candidate-desc">
          {candidate.description}
        </div>
      )}

      <div className="candidate-selection-status">
        {isSelected ? (
          <>
            <svg className="ui-icon" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Selected</span>
          </>
        ) : (
          <>
            <svg className="ui-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
            </svg>
            <span>Click to select</span>
          </>
        )}
      </div>
    </div>
  );
}
