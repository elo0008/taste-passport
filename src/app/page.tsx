'use client';

import React, { useState } from 'react';
import type { PassportResult, PipelineProgressEvent, FavoriteType } from '@/lib/pipeline';
import type { FavoriteResolveResult, ResolveCandidate } from '@/lib/resolve-service';

interface FavoriteRow {
  name: string;
  type: FavoriteType;
  selectedEntityId?: string;
  selectedCandidate?: ResolveCandidate;
}

const DEFAULT_FAVORITES: FavoriteRow[] = [
  { name: 'Premam', type: 'movie' },
  { name: 'Drishyam', type: 'movie' },
  { name: 'A. R. Rahman', type: 'artist' },
  { name: 'K. S. Chithra', type: 'artist' },
  { name: 'Vaikom Muhammad Basheer', type: 'person' },
];

export default function HomePage() {
  const [destination, setDestination] = useState('Toronto');
  const [favorites, setFavorites] = useState<FavoriteRow[]>(DEFAULT_FAVORITES);

  // Resolution state (Task D: User control)
  const [resolving, setResolving] = useState(false);
  const [resolveResults, setResolveResults] = useState<FavoriteResolveResult[] | null>(null);

  // Pipeline execution state
  const [loading, setLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<PipelineProgressEvent | null>(null);
  const [result, setResult] = useState<PassportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddRow = () => {
    if (favorites.length < 8) {
      setFavorites([...favorites, { name: '', type: 'artist' }]);
      setResolveResults(null);
    }
  };

  const handleRemoveRow = (index: number) => {
    if (favorites.length > 3) {
      setFavorites(favorites.filter((_, i) => i !== index));
      setResolveResults(null);
    }
  };

  const handleUpdateRow = (index: number, field: keyof FavoriteRow, value: string) => {
    const updated = [...favorites];
    updated[index] = { ...updated[index], [field]: value };
    setFavorites(updated);
    setResolveResults(null);
  };

  const handlePrefillKerala = () => {
    setDestination('Toronto');
    setFavorites(DEFAULT_FAVORITES);
    setResolveResults(null);
    setError(null);
    setResult(null);
  };

  // Step 1: Find candidate matches (Task D)
  const handleFindMatches = async () => {
    const validFavs = favorites.filter((f) => f.name.trim().length > 0);
    if (validFavs.length < 3) {
      setError('Please provide at least 3 cultural favorites.');
      return;
    }

    setResolving(true);
    setError(null);
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorites: validFavs.map((f) => ({ name: f.name.trim(), type: f.type })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Resolution failed with status ${res.status}`);
      }

      const data = await res.json();
      setResolveResults(data.results);

      // Pre-select top candidate for each
      const updatedFavs = [...favorites];
      data.results.forEach((r: FavoriteResolveResult, idx: number) => {
        if (updatedFavs[idx] && r.candidates.length > 0) {
          updatedFavs[idx].selectedEntityId = r.candidates[0].entityId;
          updatedFavs[idx].selectedCandidate = r.candidates[0];
        }
      });
      setFavorites(updatedFavs);
    } catch (err: any) {
      setError(err.message || 'Failed to search Qloo entity matches');
    } finally {
      setResolving(false);
    }
  };

  const handleSelectCandidate = (favIndex: number, candidate: ResolveCandidate) => {
    const updated = [...favorites];
    updated[favIndex].selectedEntityId = candidate.entityId;
    updated[favIndex].selectedCandidate = candidate;
    setFavorites(updated);
  };

  // Step 2: Build Passport (streamed)
  const handleBuildPassport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentProgress({ type: 'progress', stage: 'resolving', message: 'Connecting to Taste Passport...' });

    try {
      const validFavs = favorites.filter((f) => f.name.trim().length > 0);
      if (validFavs.length < 3) {
        throw new Error('Please provide at least 3 favorites.');
      }

      const payload = {
        destination: destination.trim(),
        favorites: validFavs.map((f) => ({
          name: f.name.trim(),
          type: f.type,
          entityId: f.selectedEntityId,
        })),
      };

      const res = await fetch('/api/passport', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) {
        const data = await res.json();
        throw new Error(data.error || 'Rate limit reached. Maximum 6 requests per hour allowed.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      if (!res.body) {
        throw new Error('No response stream received');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'progress') {
              setCurrentProgress(parsed);
            } else if (parsed.type === 'result') {
              setResult(parsed.data);
              setCurrentProgress(null);
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (err: any) {
            if (err.message) throw err;
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalPlacesCount = result
    ? result.categories.reduce((acc, cat) => acc + cat.places.length, 0)
    : 0;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '1rem' }}>
      <header style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: 800 }}>🌍 Taste Passport</h1>
        <p style={{ margin: 0, fontSize: '1.05rem', color: '#4a5568', fontWeight: 500 }}>
          Places chosen by Qloo's taste data. AI only writes the explanations.
        </p>
      </header>

      {/* Info Accordion / Explainer (Task F) */}
      <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#475569' }}>
        <strong style={{ color: '#1e293b', display: 'block', marginBottom: '0.4rem' }}>
          ℹ️ How it works / What this does not do:
        </strong>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.5 }}>
          <li>Places are chosen and ranked purely by Qloo's taste intelligence graph (no explicit percentage scores are exposed).</li>
          <li>Recommendations cover the broader metropolitan area around the destination city ({destination || 'destination'} area).</li>
          <li>Signals can fail to shift recommendations: see the Signal Check panel to see which favorites actually shaped results.</li>
          <li>Taste Passport discovers cultural culinary resonance; it does not check live opening hours or table availability.</li>
        </ul>
      </section>

      {/* Input Section */}
      <section style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Step 1: Your Destination & Cultural Favorites</h2>
          <button
            type="button"
            onClick={handlePrefillKerala}
            disabled={loading || resolving}
            style={{
              background: '#edf2f7',
              border: '1px solid #cbd5e0',
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: loading || resolving ? 'not-allowed' : 'pointer',
            }}
          >
            ⚡ Example (Kerala to Toronto)
          </button>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
            Destination City:
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setResolveResults(null);
            }}
            placeholder="e.g. Toronto, London, New York"
            required
            disabled={loading}
            style={{
              width: '100%',
              maxWidth: '360px',
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
          <span style={{ fontSize: '0.8rem', color: '#718096', display: 'block', marginTop: '0.25rem' }}>
            Results will cover the broader {destination ? `${destination} area` : 'destination area'}.
          </span>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Cultural Favorites (3 to 8):
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {favorites.map((fav, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={fav.name}
                  onChange={(e) => handleUpdateRow(index, 'name', e.target.value)}
                  placeholder="Artist, movie, author, or show name"
                  required
                  disabled={loading}
                  style={{
                    flex: '1 1 220px',
                    padding: '0.45rem 0.65rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                  }}
                />
                <select
                  value={fav.type}
                  onChange={(e) => handleUpdateRow(index, 'type', e.target.value)}
                  disabled={loading}
                  style={{
                    padding: '0.45rem 0.65rem',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    background: '#fff',
                  }}
                >
                  <option value="artist">Artist / Musician</option>
                  <option value="movie">Movie</option>
                  <option value="tv_show">TV Show</option>
                  <option value="person">Author / Person</option>
                  <option value="podcast">Podcast</option>
                  <option value="brand">Brand</option>
                </select>
                {favorites.length > 3 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(index)}
                    disabled={loading}
                    style={{
                      background: '#fff5f5',
                      color: '#c53030',
                      border: '1px solid #feb2b2',
                      borderRadius: '6px',
                      padding: '0.45rem 0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {favorites.length < 8 && (
            <button
              type="button"
              onClick={handleAddRow}
              disabled={loading}
              style={{
                marginTop: '0.75rem',
                background: '#fff',
                border: '1px dashed #cbd5e0',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              + Add Another Favorite
            </button>
          )}
        </div>

        {/* Match Finder Button */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleFindMatches}
            disabled={resolving || loading}
            style={{
              background: resolving ? '#94a3b8' : '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '0.65rem 1.4rem',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: resolving || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {resolving ? 'Searching Matches...' : '🔍 Find My Matches'}
          </button>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Confirm which movie/adaptation or artist to match before building recommendations.
          </span>
        </div>
      </section>

      {/* Step 2: Confirm Entity Matches (Task D) */}
      {resolveResults && (
        <section style={{ background: '#fff', border: '1px solid #cbd5e0', borderRadius: '8px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem 0' }}>Step 2: Confirm Your Cultural Matches</h2>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#64748b' }}>
            Select the exact version or release for your favorites (e.g. Malayalam original vs Hindi remake):
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {resolveResults.map((r, favIdx) => (
              <div key={favIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                  "{r.inputName}" ({r.inputType}):
                </div>

                {r.candidates.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: '#e53e3e' }}>No direct match found in Qloo taste graph.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                    {r.candidates.map((cand) => {
                      const isSelected = favorites[favIdx]?.selectedEntityId === cand.entityId;
                      return (
                        <div
                          key={cand.entityId}
                          onClick={() => handleSelectCandidate(favIdx, cand)}
                          style={{
                            border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e0',
                            background: isSelected ? '#eff6ff' : '#fff',
                            borderRadius: '6px',
                            padding: '0.65rem 0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.9rem' }}>{cand.name}</strong>
                            {cand.year && (
                              <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                                {cand.year}
                              </span>
                            )}
                          </div>
                          {cand.description && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.3, maxHeight: '2.6em', overflow: 'hidden' }}>
                              {cand.description}
                            </div>
                          )}
                          <div style={{ fontSize: '0.7rem', color: isSelected ? '#1d4ed8' : '#94a3b8', marginTop: '0.25rem', fontWeight: 600 }}>
                            {isSelected ? '✓ Selected' : 'Click to select'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleBuildPassport()}
            disabled={loading}
            style={{
              background: loading ? '#94a3b8' : '#2b6cb0',
              color: '#fff',
              border: 'none',
              padding: '0.75rem 2rem',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Building Taste Passport...' : `✨ Build Passport for ${destination} Area`}
          </button>
        </section>
      )}

      {/* Progress Indicator */}
      {loading && currentProgress && (
        <div style={{ background: '#ebf8ff', border: '1px solid #bee3f8', borderRadius: '8px', padding: '1.25rem', marginBottom: '2rem' }}>
          <div style={{ fontWeight: 600, color: '#2b6cb0', marginBottom: '0.25rem' }}>
            Stage: {currentProgress.stage.replace('_', ' ').toUpperCase()}
          </div>
          <p style={{ margin: 0, color: '#2d3748' }}>{currentProgress.message}</p>
          {currentProgress.total && currentProgress.current !== undefined && (
            <div style={{ marginTop: '0.5rem', background: '#cbd5e0', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  background: '#3182ce',
                  height: '100%',
                  width: `${Math.round((currentProgress.current / currentProgress.total) * 100)}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', color: '#9b2c2c', borderRadius: '8px', padding: '1rem', marginBottom: '2rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div>
          {/* Metadata & Grounding Banner (Task B) */}
          <div style={{ background: '#edf2f7', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem' }}>
            <span>⚡ <strong>{result.meta.ms}ms</strong></span>
            <span>📡 <strong>{result.meta.qlooCalls}</strong> Qloo calls</span>
            <span>🤖 <strong>{result.meta.llmCalls}</strong> LLM calls</span>
            <span style={{ color: '#22543d', background: '#c6f6d5', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
              ✓ Every place shown comes from Qloo's results ({totalPlacesCount} places verified)
            </span>
            {result.meta.cached && (
              <span style={{ background: '#bee3f8', color: '#2b6cb0', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                CACHED
              </span>
            )}
          </div>

          {/* Unresolved Favorites Warning */}
          {result.unresolvedFavorites.length > 0 && (
            <div style={{ background: '#fffaf0', border: '1px solid #feebc8', color: '#7b341e', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              <strong>Note:</strong> Some favorites could not be resolved in the taste graph:
              <ul style={{ margin: '0.25rem 0 0 1.25rem' }}>
                {result.unresolvedFavorites.map((u, i) => (
                  <li key={i}>
                    "{u.name}" ({u.type}): {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* First Month Settling Plan */}
          <section style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem' }}>🗓️ First Month Settling Guide</h3>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#334155' }}>{result.firstMonth}</p>
          </section>

          {/* Signal Check Panel (Task A: Honest Lift) */}
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>🎯 Signal Check (Taste Lift Attribution)</h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Taste lift measures how much this signal shifted recommendations away from generic popular spots in this city.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
              {result.signalCheck.map((sig, i) => {
                const isStrong = sig.status === 'strong';
                const isWeak = sig.status === 'weak';
                const isNone = sig.status === 'none';
                return (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      background: isStrong ? '#f0fff4' : isWeak ? '#fffff0' : '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{sig.name}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: isStrong ? '#c6f6d5' : isWeak ? '#fefcbf' : '#e2e8f0',
                          color: isStrong ? '#22543d' : isWeak ? '#744210' : '#64748b',
                        }}
                      >
                        {sig.favoriteLiftPercent}% lift
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: isNone ? '#64748b' : '#2d3748', marginTop: '0.35rem' }}>
                      {isNone ? 'did not visibly shape results' : `${sig.statusLabel.toUpperCase()} signal • shaped ${sig.matchedCount} top picks`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Categories and Places */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {result.categories.map((cat, i) => (
              <section key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{cat.title}</h3>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: cat.kind === 'home_cuisine' ? '#bee3f8' : cat.kind === 'stretch_cuisine' ? '#feebc8' : '#e9d8fd',
                          color: cat.kind === 'home_cuisine' ? '#2b6cb0' : cat.kind === 'stretch_cuisine' ? '#c05621' : '#6b46c1',
                        }}
                      >
                        {cat.kindLabel.toUpperCase()}
                      </span>
                    </div>

                    {/* Taste Lift Badge (Task A) */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        background: cat.tasteLift < 0.3 ? '#edf2f7' : '#d1fae5',
                        color: cat.tasteLift < 0.3 ? '#475569' : '#065f46',
                      }}
                    >
                      {cat.badge}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568' }}>{cat.intro}</p>
                </div>

                <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {cat.places.map((place) => (
                    <div
                      key={place.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        background: '#fff',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{place.name}</h4>
                          {place.rating && (
                            <span style={{ fontSize: '0.85rem', color: '#d69e2e', fontWeight: 700 }}>
                              ★ {place.rating.toFixed(1)}
                            </span>
                          )}
                        </div>

                        {place.address && (
                          <div style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.5rem' }}>
                            📍 {place.address}
                          </div>
                        )}

                        <p style={{ fontSize: '0.85rem', color: '#2d3748', lineHeight: 1.4, margin: '0.5rem 0' }}>
                          {place.blurb}
                        </p>

                        {place.dishes.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: '#4a5568', marginTop: '0.5rem' }}>
                            <strong>Dishes:</strong> {place.dishes.join(', ')}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '0.75rem', borderTop: '1px solid #edf2f7', paddingTop: '0.5rem' }}>
                        {place.matchedBy.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#718096', display: 'block', marginBottom: '0.2rem' }}>
                              Lifted by:
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {place.matchedBy.map((m, mi) => (
                                <span
                                  key={mi}
                                  style={{
                                    fontSize: '0.7rem',
                                    background: '#e2e8f0',
                                    color: '#2d3748',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '3px',
                                  }}
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                          {place.phone ? (
                            <span style={{ color: '#4a5568' }}>📞 {place.phone}</span>
                          ) : <span />}
                          {place.website && (
                            <a
                              href={place.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#3182ce', textDecoration: 'none', fontWeight: 600 }}
                            >
                              Visit Website →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
