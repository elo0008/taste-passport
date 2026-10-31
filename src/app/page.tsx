'use client';

import React, { useState, useRef } from 'react';
import type { PassportResult, PipelineProgressEvent } from '@/lib/pipeline';
import type { FavoriteResolveResult, ResolveCandidate } from '@/lib/resolve-service';

import { Header } from '@/components/Header';
import { Stepper } from '@/components/Stepper';
import { Hero } from '@/components/Hero';
import { FavoritesForm, type FavoriteItemState } from '@/components/FavoritesForm';
import { Step2Disambiguation } from '@/components/Step2Disambiguation';
import { LoadingPipeline } from '@/components/LoadingPipeline';
import { ResultsSummary } from '@/components/ResultsSummary';
import { FirstMonthPlan } from '@/components/FirstMonthPlan';
import { CategorySection } from '@/components/CategorySection';
import { SignalCheck } from '@/components/SignalCheck';
import { TasteVsBaseline } from '@/components/TasteVsBaseline';
import { RateLimitScreen, ErrorScreen, LimitedCoverageScreen } from '@/components/StateScreens';
import { Footer } from '@/components/Footer';

const DEFAULT_FAVORITES: FavoriteItemState[] = [
  { name: 'Premam', type: 'movie' },
  { name: 'Drishyam', type: 'movie' },
  { name: 'A. R. Rahman', type: 'artist' },
  { name: 'K. S. Chithra', type: 'artist' },
  { name: 'Vaikom Muhammad Basheer', type: 'person' },
];

function scrollToTopAndFocus(headingId: string) {
  if (typeof window === 'undefined') return;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stepper = document.getElementById('stepperNav') || document.querySelector('.stepper-nav');
  if (stepper) {
    stepper.scrollIntoView({ behavior: isReduced ? 'instant' : 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: isReduced ? 'instant' : 'smooth' });
  }

  setTimeout(() => {
    const el = document.getElementById(headingId);
    if (el) {
      el.focus({ preventScroll: true });
    }
  }, 100);
}

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [destination, setDestination] = useState('Toronto');
  const [favorites, setFavorites] = useState<FavoriteItemState[]>(DEFAULT_FAVORITES);

  // Resolution state
  const [resolving, setResolving] = useState(false);
  const [resolveResults, setResolveResults] = useState<FavoriteResolveResult[] | null>(null);

  // Pipeline execution state
  const [loading, setLoading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<PipelineProgressEvent | null>(null);
  const [result, setResult] = useState<PassportResult | null>(null);

  // Error & rate limit states
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle Find Matches (Step 1 -> Step 2)
  const handleFindMatches = async () => {
    const validFavs = favorites.filter((f) => f.name.trim().length > 0);
    if (validFavs.length < 3) {
      setError('Please provide at least 3 cultural favorites.');
      return;
    }

    setResolving(true);
    setError(null);
    setIsRateLimited(false);

    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorites: validFavs.map((f) => ({ name: f.name.trim(), type: f.type })),
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setIsRateLimited(true);
        setRateLimitMessage(data.error || 'Rate limit reached. Maximum 6 requests per hour allowed.');
        scrollToTopAndFocus('stateScreenHeading');
        return;
      }

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
          updatedFavs[idx].selectedCandidateName = r.candidates[0].name;
        }
      });
      setFavorites(updatedFavs);
      setCurrentStep(2);
      scrollToTopAndFocus('step2Heading');
    } catch (err: any) {
      setError(err.message || 'Failed to search Qloo entity matches');
      scrollToTopAndFocus('stateScreenHeading');
    } finally {
      setResolving(false);
    }
  };

  // Step 2 candidate selection
  const handleSelectCandidate = (favIndex: number, candidate: ResolveCandidate) => {
    const updated = [...favorites];
    updated[favIndex].selectedEntityId = candidate.entityId;
    updated[favIndex].selectedCandidateName = candidate.name;
    setFavorites(updated);
  };

  // Step 2 skip favorite
  const handleSkipFavorite = (favIndex: number) => {
    if (favorites.length <= 2) return;
    const updatedFavs = favorites.filter((_, i) => i !== favIndex);
    const updatedResults = resolveResults ? resolveResults.filter((_, i) => i !== favIndex) : null;
    setFavorites(updatedFavs);
    setResolveResults(updatedResults);
  };

  // Step 2 -> Step 1 back navigation
  const handleBackToStep1 = () => {
    setCurrentStep(1);
    setError(null);
    scrollToTopAndFocus('step1Heading');
  };

  // Build Passport execution (Step 2 -> Step 3)
  const handleBuildPassport = async () => {
    setLoading(true);
    setCurrentStep(3);
    setError(null);
    setIsRateLimited(false);
    setResult(null);
    setCurrentProgress({ type: 'progress', stage: 'resolving', message: 'Connecting to Taste Passport...' });
    scrollToTopAndFocus('loadingHeading');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const validFavs = favorites.filter((f) => f.name.trim().length > 0);
      if (validFavs.length < 2) {
        throw new Error('Please provide at least 2 favorites.');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setIsRateLimited(true);
        setRateLimitMessage(data.error || 'Rate limit reached. Maximum 6 requests per hour allowed.');
        scrollToTopAndFocus('stateScreenHeading');
        return;
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
              scrollToTopAndFocus('resultsHeading');
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (err: any) {
            if (err.message) throw err;
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim());
          if (parsed.type === 'result') {
            setResult(parsed.data);
            setCurrentProgress(null);
            scrollToTopAndFocus('resultsHeading');
          } else if (parsed.type === 'error') {
            throw new Error(parsed.error);
          }
        } catch (err: any) {
          if (err.message) throw err;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User deliberately cancelled
        setCurrentStep(2);
        scrollToTopAndFocus('step2Heading');
      } else {
        setError(err.message || 'An unexpected error occurred');
        scrollToTopAndFocus('stateScreenHeading');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Cancel in-flight build
  const handleCancelBuild = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
    setCurrentStep(2);
    scrollToTopAndFocus('step2Heading');
  };

  // Reset / Edit handlers
  const handleEditFavorites = () => {
    setCurrentStep(1);
    setResult(null);
    setResolveResults(null);
    scrollToTopAndFocus('step1Heading');
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setDestination('Toronto');
    setFavorites(DEFAULT_FAVORITES);
    setResolveResults(null);
    setResult(null);
    setError(null);
    setIsRateLimited(false);
    scrollToTopAndFocus('step1Heading');
  };

  const isLimitedCoverage = Boolean(result && result.categories.length < 2);

  return (
    <>
      {/* Motion budget: Single ambient background drift, blur <= 40px, no mix-blend-mode */}
      <div className="dynamic-bg-container" aria-hidden="true">
        <div className="ambient-drift-single" />
      </div>

      <Header />

      <Stepper currentStep={currentStep} />

      <main style={{ minHeight: '80vh', position: 'relative', zIndex: 1 }}>
        {/* Error / Rate limit overlays */}
        {isRateLimited ? (
          <div className="container">
            <RateLimitScreen
              message={rateLimitMessage || undefined}
              onReset={handleStartOver}
            />
          </div>
        ) : error ? (
          <div className="container">
            <ErrorScreen
              error={error}
              onRetry={() => {
                setError(null);
                if (currentStep === 3) setCurrentStep(2);
                scrollToTopAndFocus(currentStep === 3 ? 'step2Heading' : 'step1Heading');
              }}
            />
          </div>
        ) : currentStep === 1 ? (
          /* STEP 1: Hero + Favorites Form */
          <>
            <Hero destination={destination} />
            <FavoritesForm
              destination={destination}
              onDestinationChange={setDestination}
              favorites={favorites}
              onFavoritesChange={setFavorites}
              onFindMatches={handleFindMatches}
              resolving={resolving}
            />
          </>
        ) : currentStep === 2 && resolveResults ? (
          /* STEP 2: Disambiguation Cards */
          <Step2Disambiguation
            destination={destination}
            favorites={favorites}
            resolveResults={resolveResults}
            onSelectCandidate={handleSelectCandidate}
            onSkipFavorite={handleSkipFavorite}
            onBack={handleBackToStep1}
            onBuildPassport={handleBuildPassport}
            building={loading}
          />
        ) : currentStep === 3 && loading ? (
          /* STEP 3: Loading Pipeline View */
          <div className="container">
            <LoadingPipeline
              currentProgress={currentProgress}
              onCancel={handleCancelBuild}
            />
          </div>
        ) : currentStep === 3 && result ? (
          /* STEP 3 RESULTS: Passport Deliverable View */
          <div className="results-view-wrap">
            <div className="container">
              {isLimitedCoverage ? (
                <LimitedCoverageScreen
                  destination={destination}
                  categoryCount={result.categories.length}
                  onAdjust={handleEditFavorites}
                />
              ) : null}

              <ResultsSummary
                result={result}
                onEditFavorites={handleEditFavorites}
                onStartOver={handleStartOver}
              />

              <FirstMonthPlan
                firstMonthText={result.firstMonth}
                categories={result.categories}
              />

              {/* Category Jump Pills */}
              {result.categories.length > 1 && (
                <nav className="category-jump-nav" aria-label="Jump to category">
                  <div className="category-jump-track">
                    {result.categories.map((cat, idx) => {
                      const slugId = `category-${cat.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                      return (
                        <a
                          key={idx}
                          href={`#${slugId}`}
                          className="category-jump-pill"
                          onClick={(e) => {
                            e.preventDefault();
                            const el = document.getElementById(slugId);
                            if (el) {
                              const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                              el.scrollIntoView({ behavior: isReduced ? 'instant' : 'smooth', block: 'start' });
                              if (typeof window !== 'undefined') {
                                window.history.pushState(null, '', `#${slugId}`);
                              }
                            }
                          }}
                        >
                          {cat.title}
                        </a>
                      );
                    })}
                  </div>
                </nav>
              )}

              {result.categories.map((category, idx) => (
                <CategorySection key={idx} category={category} categoryIndex={idx} />
              ))}

              <SignalCheck signals={result.signalCheck} destination={result.destination} />

              {result.tasteVsBaseline && <TasteVsBaseline data={result.tasteVsBaseline} />}
            </div>
          </div>
        ) : null}
      </main>

      <Footer />
    </>
  );
}
