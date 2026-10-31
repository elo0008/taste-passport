'use client';

import React from 'react';

interface RateLimitScreenProps {
  message?: string;
  onReset: () => void;
}

export function RateLimitScreen({ message, onReset }: RateLimitScreenProps) {
  return (
    <div className="state-screen-box">
      <div className="state-screen-icon">
        <svg style={{ width: '42px', height: '42px', color: 'var(--color-saffron)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h3 id="stateScreenHeading" tabIndex={-1} className="state-screen-title">Rate Limit Reached</h3>
      <p className="state-screen-desc">
        {message || 'Maximum 6 requests per hour allowed to protect API quotas. Please wait a short while before generating another passport.'}
      </p>
      <div className="state-screen-actions">
        <button
          type="button"
          onClick={onReset}
          className="btn-secondary btn-state-action"
          style={{ minHeight: '48px', padding: '0 24px', touchAction: 'manipulation' }}
        >
          Return to Input Form
        </button>
      </div>
    </div>
  );
}

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <div className="state-screen-box">
      <div className="state-screen-icon">
        <svg style={{ width: '42px', height: '42px', color: 'var(--color-brick)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h3 id="stateScreenHeading" tabIndex={-1} className="state-screen-title">Something Went Wrong</h3>
      <p className="state-screen-desc">
        {error}
      </p>
      <div className="state-screen-actions">
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary btn-state-action"
          style={{ minHeight: '48px', padding: '0 24px', touchAction: 'manipulation' }}
        >
          ← Try Again
        </button>
      </div>
    </div>
  );
}

interface LimitedCoverageScreenProps {
  destination: string;
  categoryCount: number;
  onAdjust: () => void;
}

export function LimitedCoverageScreen({ destination, categoryCount, onAdjust }: LimitedCoverageScreenProps) {
  return (
    <div className="state-screen-box">
      <div className="state-screen-icon">
        <svg style={{ width: '42px', height: '42px', color: 'var(--color-teal)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <h3 id="stateScreenHeading" tabIndex={-1} className="state-screen-title">Limited Coverage in {destination}</h3>
      <p className="state-screen-desc">
        Qloo found only {categoryCount} distinct category for this profile in the {destination} area.
        Try adding broader cultural artists or exploring a larger destination metropolitan area.
      </p>
      <div className="state-screen-actions">
        <button
          type="button"
          onClick={onAdjust}
          className="btn-secondary btn-state-action"
          style={{ minHeight: '48px', padding: '0 24px', touchAction: 'manipulation' }}
        >
          Adjust Favorites & Destination
        </button>
      </div>
    </div>
  );
}
