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
          className="step1-form-card"
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
                flexWrap: 'wrap',
                gap: '4px',
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
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                inputMode="text"
                style={{
                  width: '100%',
                  height: '52px',
                  minHeight: '48px',
                  padding: '0 18px 0 48px',
                  background: 'var(--bg-page)',
                  border: '1.5px solid var(--color-hairline-strong)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-ink)',
                  fontSize: '16px',
                  touchAction: 'manipulation',
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
                    minHeight: '36px',
                    padding: '6px 14px',
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: 'var(--color-ink)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all var(--transition-fast)',
                    touchAction: 'manipulation',
                  }}
                >
                  <svg style={{ width: '13px', height: '13px', color: 'var(--color-terracotta)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span>{preset.label}</span>
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
              className="fav-items-grid"
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
                    className="fav-row-card"
                    style={{
                      background: isEditingThis ? 'var(--color-saffron-light)' : 'var(--bg-surface-elevated)',
                      border: isEditingThis
                        ? '1.5px solid var(--color-saffron)'
                        : '1.5px solid var(--color-hairline-strong)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div className="fav-row-main">
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
                      <div className="fav-name-col" style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="fav-name-text"
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
                          className="fav-type-badge-desktop"
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

                    <div className="fav-actions-group">
                      <div
                        className="fav-type-badge-mobile"
                        style={{
                          fontSize: '0.74rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--color-ink-muted)',
                        }}
                      >
                        {getTypeLabel(fav.type)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(idx)}
                          aria-label={`Edit ${fav.name}`}
                          className="fav-action-btn"
                        >
                          <svg style={{ width: '15px', height: '15px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(idx)}
                          disabled={favorites.length <= 3}
                          aria-label={`Delete ${fav.name}`}
                          className="fav-action-btn"
                          style={{
                            color: favorites.length <= 3 ? '#cbd5e1' : 'var(--color-brick)',
                            cursor: favorites.length <= 3 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <svg style={{ width: '15px', height: '15px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add / Edit Dock Card */}
            {(canAddMore || editingIndex !== null) && (
              <div
                className="fav-dock-card"
                style={{
                  background: 'rgba(250, 248, 245, 0.85)',
                  border: '1.5px dashed #D6CEC3',
                  borderRadius: '16px',
                  padding: '22px 24px',
                }}
              >
                <div
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--color-ink)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
                  <span>{editingIndex !== null ? 'Edit favorite' : 'Add another favorite'}</span>
                </div>

                <div
                  className="fav-dock-inputs"
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <input
                    type="text"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder="Name of favorite..."
                    aria-label="Name of favorite"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitDock();
                      }
                    }}
                    style={{
                      flex: '1 1 240px',
                      height: '48px',
                      minHeight: '48px',
                      padding: '0 16px',
                      background: '#FFFFFF',
                      border: '1px solid #E5DFD5',
                      borderRadius: '12px',
                      color: 'var(--color-ink)',
                      fontSize: '16px',
                      outline: 'none',
                      touchAction: 'manipulation',
                    }}
                  />

                  <select
                    value={inputType}
                    onChange={(e) => setInputType(e.target.value as FavoriteType)}
                    aria-label="Category of favorite"
                    className="fav-dock-select"
                    style={{
                      width: '180px',
                      height: '48px',
                      minHeight: '48px',
                      padding: '0 16px',
                      background: '#FFFFFF',
                      border: '1px solid #E5DFD5',
                      borderRadius: '12px',
                      color: 'var(--color-ink)',
                      fontSize: '16px',
                      outline: 'none',
                      touchAction: 'manipulation',
                    }}
                  >
                    <option value="movie">Movie</option>
                    <option value="artist">Artist / Musician</option>
                    <option value="person">Author / Person</option>
                    <option value="tv_show">TV Show</option>
                  </select>

                  <div className="fav-dock-btn-group" style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleSubmitDock}
                      className="btn-dock-submit"
                      style={{
                        height: '48px',
                        minHeight: '48px',
                        padding: '0 24px',
                        background: 'var(--color-terracotta)',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        border: 'none',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(216, 96, 40, 0.25)',
                        touchAction: 'manipulation',
                      }}
                    >
                      <svg style={{ width: '15px', height: '15px', strokeWidth: 2.5 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{editingIndex !== null ? 'Save Changes' : 'Add Favorite'}</span>
                    </button>
                    {editingIndex !== null && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        style={{
                          height: '48px',
                          minHeight: '48px',
                          padding: '0 16px',
                          background: '#FFFFFF',
                          border: '1px solid #E5DFD5',
                          borderRadius: '12px',
                          fontSize: '0.92rem',
                          color: 'var(--color-ink-muted)',
                          cursor: 'pointer',
                          touchAction: 'manipulation',
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
                      marginTop: '12px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    role="alert"
                  >
                    <svg style={{ width: '14px', height: '14px', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>{validationError}</span>
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
              style={{
                width: '100%',
                minHeight: '48px',
                height: '52px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '1.02rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--color-teal)',
                color: '#FFFFFF',
                border: 'none',
                cursor: canFindMatches ? 'pointer' : 'not-allowed',
                boxShadow: '0 2px 8px rgba(19, 78, 74, 0.2)',
                touchAction: 'manipulation',
              }}
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
                  <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

          {/* How It Works Disclosure Box (Collapsible on mobile) */}
          <details
            className="how-it-works-details"
            style={{
              marginTop: '36px',
              paddingTop: '20px',
              borderTop: '1px solid var(--color-hairline)',
            }}
          >
            <summary
              className="how-it-works-summary"
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                userSelect: 'none',
              }}
            >
              <span>How it works / What this does not do:</span>
              <svg className="how-it-works-chevron" style={{ width: '18px', height: '18px', color: 'var(--color-ink-muted)', transition: 'transform 200ms ease' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </summary>
            <ul
              style={{
                paddingLeft: '20px',
                fontSize: '0.88rem',
                color: 'var(--color-ink-muted)',
                lineHeight: 1.7,
                marginTop: '12px',
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
          </details>
        </div>
      </div>
    </section>
  );
}
