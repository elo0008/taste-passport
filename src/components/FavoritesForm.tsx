'use client';

import React, { useState } from 'react';
import { FavoriteType } from '@/lib/pipeline';

export interface FavoriteItemState {
  name: string;
  type: FavoriteType;
  selectedEntityId?: string;
  selectedCandidateName?: string;
}

interface FavoritesFormProps {
  destination: string;
  onDestinationChange: (dest: string) => void;
  favorites: FavoriteItemState[];
  onFavoritesChange: (favs: FavoriteItemState[]) => void;
  onFindMatches: () => void;
  resolving: boolean;
}

const PRESET_PROFILES = [
  {
    label: 'Kerala to Toronto',
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as FavoriteType },
      { name: 'Drishyam', type: 'movie' as FavoriteType },
      { name: 'A. R. Rahman', type: 'artist' as FavoriteType },
      { name: 'K. S. Chithra', type: 'artist' as FavoriteType },
      { name: 'Vaikom Muhammad Basheer', type: 'person' as FavoriteType },
    ],
  },
  {
    label: 'Punjabi to London',
    destination: 'London',
    favorites: [
      { name: 'Diljit Dosanjh', type: 'artist' as FavoriteType },
      { name: 'Sholay', type: 'movie' as FavoriteType },
      { name: 'Sidhu Moose Wala', type: 'artist' as FavoriteType },
      { name: 'Jab We Met', type: 'movie' as FavoriteType },
    ],
  },
  {
    label: 'Indie to Toronto',
    destination: 'Toronto',
    favorites: [
      { name: 'Radiohead', type: 'artist' as FavoriteType },
      { name: 'Inception', type: 'movie' as FavoriteType },
      { name: 'Breaking Bad', type: 'tv_show' as FavoriteType },
      { name: 'Fleabag', type: 'tv_show' as FavoriteType },
    ],
  },
];

export function FavoritesForm({
  destination,
  onDestinationChange,
  favorites,
  onFavoritesChange,
  onFindMatches,
  resolving,
}: FavoritesFormProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [inputName, setInputName] = useState('');
  const [inputType, setInputType] = useState<FavoriteType>('movie');
  const [validationError, setValidationError] = useState<string | null>(null);

  const canAddMore = favorites.length < 8;
  const canFindMatches =
    destination.trim().length >= 2 && favorites.length >= 3 && favorites.length <= 8 && !resolving;

  const handleStartEdit = (idx: number) => {
    setEditingIndex(idx);
    setInputName(favorites[idx].name);
    setInputType(favorites[idx].type);
    setValidationError(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setInputName('');
    setInputType('movie');
    setValidationError(null);
  };

  const handleSubmitDock = () => {
    const trimmed = inputName.trim();
    if (!trimmed) {
      setValidationError('Please enter a name for the favorite.');
      return;
    }

    if (editingIndex !== null) {
      const updated = [...favorites];
      updated[editingIndex] = {
        name: trimmed,
        type: inputType,
      };
      onFavoritesChange(updated);
      handleCancelEdit();
    } else {
      if (!canAddMore) {
        setValidationError('Maximum 8 favorites allowed.');
        return;
      }
      onFavoritesChange([
        ...favorites,
        {
          name: trimmed,
          type: inputType,
        },
      ]);
      setInputName('');
      setValidationError(null);
    }
  };

  const handleDelete = (idx: number) => {
    if (favorites.length <= 3) {
      setValidationError('A minimum of 3 favorites is required.');
      return;
    }
    const updated = favorites.filter((_, i) => i !== idx);
    onFavoritesChange(updated);
    if (editingIndex === idx) {
      handleCancelEdit();
    }
  };

  const handleApplyPreset = (preset: (typeof PRESET_PROFILES)[0]) => {
    onDestinationChange(preset.destination);
    onFavoritesChange(preset.favorites.map((f) => ({ ...f })));
    handleCancelEdit();
  };

  const getTypeLabel = (type: FavoriteType) => {
    switch (type) {
      case 'movie':
        return 'Movie';
      case 'artist':
        return 'Artist / Musician';
      case 'person':
        return 'Author / Person';
      case 'tv_show':
        return 'TV Show / Series';
      case 'podcast':
        return 'Podcast';
      case 'brand':
        return 'Brand';
      default:
        return type;
    }
  };

  const getTypeIcon = (type: FavoriteType) => {
    switch (type) {
      case 'artist':
        return (
          <svg className="ui-icon" viewBox="0 0 24 24">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        );
      case 'person':
        return (
          <svg className="ui-icon" viewBox="0 0 24 24">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        );
      case 'tv_show':
        return (
          <svg className="ui-icon" viewBox="0 0 24 24">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
        );
      case 'movie':
      default:
        return (
          <svg className="ui-icon" viewBox="0 0 24 24">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        );
    }
  };

  return (
    <section className="step1-section" id="step1Section" style={{ padding: '40px 0 60px' }}>
      <div className="container">
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px',
            boxShadow: 'var(--shadow-md)',
            marginBottom: '40px',
          }}
        >
          {/* Destination Field */}
          <div style={{ marginBottom: '30px' }}>
            <label
              htmlFor="destinationInput"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--color-ink)',
                marginBottom: '10px',
              }}
            >
              <span>Destination City:</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', fontWeight: 400 }}>
                Results cover the broader metropolitan area
              </span>
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <svg
                className="ui-icon"
                style={{
                  position: 'absolute',
                  left: '18px',
                  color: 'var(--color-terracotta)',
                  fontSize: '1.25rem',
                }}
                viewBox="0 0 24 24"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <input
                id="destinationInput"
                type="text"
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                placeholder="e.g. Toronto, London, New York"
                style={{
                  width: '100%',
                  height: '52px',
                  padding: '0 18px 0 48px',
                  background: 'var(--bg-page)',
                  border: '1.5px solid var(--color-hairline-strong)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-ink)',
                  fontSize: '1rem',
                }}
              />
            </div>

            {/* Example Preset Chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                marginTop: '12px',
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', fontWeight: 500 }}>
                Try an example:
              </span>
              {PRESET_PROFILES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span>⚡ {preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Favorites List */}
          <div style={{ marginBottom: '32px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                Cultural Favorites (3 to 8):
              </span>
              <span
                style={{
                  fontSize: '0.82rem',
                  padding: '4px 12px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-pill)',
                  color: 'var(--color-ink-muted)',
                  fontWeight: 600,
                }}
              >
                {favorites.length} of 8 added
              </span>
            </div>

            {/* Grid of Favorites */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '14px',
                marginBottom: '20px',
              }}
              role="list"
            >
              {favorites.map((fav, idx) => {
                const isEditingThis = editingIndex === idx;
                return (
                  <div
                    key={idx}
                    role="listitem"
                    style={{
                      background: isEditingThis ? 'var(--color-saffron-light)' : 'var(--bg-surface-elevated)',
                      border: isEditingThis
                        ? '1.5px solid var(--color-saffron)'
                        : '1.5px solid var(--color-hairline-strong)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--color-hairline)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-terracotta)',
                          flexShrink: 0,
                        }}
                      >
                        {getTypeIcon(fav.type)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            color: 'var(--color-ink)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {fav.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.74rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--color-ink-muted)',
                          }}
                        >
                          {getTypeLabel(fav.type)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx)}
                        aria-label={`Edit ${fav.name}`}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-ink-muted)',
                          background: 'var(--bg-page)',
                          border: '1px solid var(--color-hairline)',
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(idx)}
                        disabled={favorites.length <= 3}
                        aria-label={`Delete ${fav.name}`}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: favorites.length <= 3 ? '#cbd5e1' : 'var(--color-brick)',
                          background: 'var(--bg-page)',
                          border: '1px solid var(--color-hairline)',
                          cursor: favorites.length <= 3 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add / Edit Dock Card */}
            {(canAddMore || editingIndex !== null) && (
              <div
                style={{
                  background: 'var(--bg-page)',
                  border: '2px dashed var(--color-hairline-strong)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg className="ui-icon" viewBox="0 0 24 24">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>{editingIndex !== null ? 'Edit Favorite' : 'Add Another Favorite'}</span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) auto',
                    gap: '12px',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="Name of artist, movie, show, or author..."
                    aria-label="Name of favorite"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitDock();
                      }
                    }}
                    style={{
                      height: '46px',
                      padding: '0 16px',
                      background: 'var(--bg-surface)',
                      border: '1.5px solid var(--color-hairline-strong)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-ink)',
                      fontSize: '0.95rem',
                    }}
                  />

                  <select
                    value={inputType}
                    onChange={(e) => setInputType(e.target.value as FavoriteType)}
                    aria-label="Category of favorite"
                    style={{
                      height: '46px',
                      padding: '0 14px',
                      background: 'var(--bg-surface)',
                      border: '1.5px solid var(--color-hairline-strong)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-ink)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <option value="movie">Movie</option>
                    <option value="artist">Artist / Musician</option>
                    <option value="person">Author / Person</option>
                    <option value="tv_show">TV Show / Series</option>
                  </select>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSubmitDock}
                      style={{
                        height: '46px',
                        padding: '0 20px',
                        background: 'var(--color-terracotta)',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        borderRadius: 'var(--radius-md)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(216, 96, 40, 0.25)',
                      }}
                    >
                      {editingIndex !== null ? 'Save Changes' : '+ Add'}
                    </button>
                    {editingIndex !== null && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        style={{
                          height: '46px',
                          padding: '0 16px',
                          background: 'var(--bg-subtle)',
                          border: '1px solid var(--color-hairline)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.88rem',
                          color: 'var(--color-ink-muted)',
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {validationError && (
                  <div
                    style={{
                      color: 'var(--color-brick)',
                      fontSize: '0.84rem',
                      marginTop: '10px',
                      fontWeight: 500,
                    }}
                    role="alert"
                  >
                    ⚠️ {validationError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Primary CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              className="btn-primary-large"
              onClick={onFindMatches}
              disabled={!canFindMatches}
            >
              {resolving ? (
                <>
                  <svg className="ui-icon" viewBox="0 0 24 24" style={{ animation: 'spin 1.5s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 60" />
                  </svg>
                  <span>Searching Matches in Taste Graph...</span>
                </>
              ) : (
                <>
                  <span>Find My Matches</span>
                  <svg className="ui-icon" viewBox="0 0 24 24">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', margin: 0 }}>
              Confirm which movie/adaptation or artist to match before building recommendations.
            </p>
          </div>

          {/* How It Works Disclosure Box */}
          <div
            style={{
              marginTop: '36px',
              paddingTop: '24px',
              borderTop: '1px solid var(--color-hairline)',
            }}
          >
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                marginBottom: '12px',
              }}
            >
              How it works / What this does not do:
            </h3>
            <ul
              style={{
                paddingLeft: '20px',
                fontSize: '0.88rem',
                color: 'var(--color-ink-muted)',
                lineHeight: 1.7,
              }}
            >
              <li>Cuisines and places are derived from Qloo taste graph tags and baseline comparison.</li>
              <li>Recommendations cover the broader metropolitan area around the destination city.</li>
              <li>
                Signal self-correction: favorites pulling in an unaligned direction are excluded from the final
                category search and noted in the Signal Check.
              </li>
              <li>
                Discovers cultural dining resonance; drops venues flagged closed by Qloo, but does not check live hours
                or table reservations.
              </li>
              <li>Grocery categories are rule-based and retained only when meeting the coherence gate.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
