'use client';

import React from 'react';
import type { FavoriteResolveResult, ResolveCandidate } from '@/lib/resolve-service';
import type { FavoriteItemState } from './FavoritesForm';
import { CandidateCard } from './CandidateCard';

interface Step2DisambiguationProps {
  destination: string;
  favorites: FavoriteItemState[];
  resolveResults: FavoriteResolveResult[];
  onSelectCandidate: (favIndex: number, candidate: ResolveCandidate) => void;
  onSkipFavorite: (favIndex: number) => void;
  onBack: () => void;
  onBuildPassport: () => void;
  building: boolean;
}

export function Step2Disambiguation({
  destination,
  favorites,
  resolveResults,
  onSelectCandidate,
  onSkipFavorite,
  onBack,
  onBuildPassport,
  building,
}: Step2DisambiguationProps) {
  // Count how many non-skipped favorites remain
  const activeFavoritesCount = favorites.length;
  const canSkip = activeFavoritesCount > 2;

  return (
    <div className="step2-wrapper">
      <div className="container">
        <div className="step2-header-block">
          <div className="passport-stamp" style={{ marginBottom: '12px' }}>
            Step 2: Disambiguation
          </div>
          <h2>Step 2: Confirm Your Cultural Matches</h2>
          <p style={{ color: 'var(--color-ink-muted)' }}>
            Select the exact edition you mean for each favorite before building recommendations for the {destination} area:
          </p>
        </div>

        <div>
          {resolveResults.map((r, favIdx) => {
            const currentFav = favorites[favIdx];
            if (!currentFav) return null;

            return (
              <div key={favIdx} className="step2-group-card">
                <div className="step2-group-title-row">
                  <div className="step2-group-title">
                    <span style={{ color: 'var(--color-terracotta)', fontWeight: 800 }}>
                      {favIdx + 1}.
                    </span>
                    <span>&ldquo;{r.inputName}&rdquo;</span>
                    <span className="candidate-tag-type">{r.inputType}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSkipFavorite(favIdx)}
                    disabled={!canSkip || building}
                    className="btn-secondary"
                    style={{ minHeight: '38px', padding: '0 16px', fontSize: '0.84rem' }}
                    title={
                      canSkip
                        ? 'Remove this favorite from the recommendation pipeline'
                        : 'At least 2 favorites are required to build a passport'
                    }
                  >
                    Skip this favorite
                  </button>
                </div>

                {r.candidates.length === 0 ? (
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px dashed var(--color-hairline-strong)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      color: 'var(--color-ink-muted)',
                      fontSize: '0.88rem',
                    }}
                  >
                    No direct match found in Qloo taste graph for &ldquo;{r.inputName}&rdquo;.
                    You can continue with this favorite or skip it above.
                  </div>
                ) : (
                  <div className="step2-candidates-grid" role="radiogroup" aria-label={`Candidates for ${r.inputName}`}>
                    {r.candidates.map((cand) => {
                      const isSelected = currentFav.selectedEntityId === cand.entityId;
                      return (
                        <CandidateCard
                          key={cand.entityId}
                          candidate={cand}
                          isSelected={isSelected}
                          onSelect={() => onSelectCandidate(favIdx, cand)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="step2-actions-bar">
          <button
            type="button"
            onClick={onBack}
            disabled={building}
            className="btn-secondary"
          >
            ← Back to Step 1
          </button>

          <button
            type="button"
            onClick={onBuildPassport}
            disabled={building || activeFavoritesCount < 2}
            className="btn-primary-large"
          >
            {building ? (
              <>
                <svg className="ui-icon" style={{ animation: 'spinRing 2s linear infinite' }} viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Building Taste Passport...</span>
              </>
            ) : (
              <>
                <span>Build Passport for {destination} Area</span>
                <svg className="ui-icon" viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
