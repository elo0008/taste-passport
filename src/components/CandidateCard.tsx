'use client';

import React from 'react';
import type { ResolveCandidate } from '@/lib/resolve-service';
import { PlaceImage } from './PlaceImage';

interface CandidateCardProps {
  candidate: ResolveCandidate;
  isSelected: boolean;
  onSelect: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function CandidateCard({ candidate, isSelected, onSelect, onKeyDown }: CandidateCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onSelect();
    } else if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={`candidate-card-clean ${isSelected ? 'selected' : ''}`}
    >
      {/* Selection indication: ONLY a tick mark badge in top-right corner of selected card */}
      {isSelected && (
        <div className="candidate-tick-badge" aria-label="Selected" title="Selected">
          <svg className="ui-icon" style={{ width: '14px', height: '14px' }} viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            {candidate.year && (
              <span className="candidate-year-pill">{candidate.year}</span>
            )}
            <div className="candidate-name">{candidate.name}</div>
          </div>

          {(candidate.disambiguation || candidate.type) && (
            <span className="candidate-tag-type">
              {candidate.disambiguation || candidate.type}
            </span>
          )}

          {candidate.description && (
            <div className="candidate-desc-clamped">
              {candidate.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
