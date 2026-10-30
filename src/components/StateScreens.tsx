'use client';

import React from 'react';

interface RateLimitScreenProps {
  message?: string;
  onReset: () => void;
}

export function RateLimitScreen({ message, onReset }: RateLimitScreenProps) {
  return (
    <div className="state-screen-box">
      <div className="state-screen-icon">⏳</div>
      <h3 id="stateScreenHeading" tabIndex={-1} className="state-screen-title">Rate Limit Reached</h3>
      <p className="state-screen-desc">
        {message || 'Maximum 6 requests per hour allowed to protect API quotas. Please wait a short while before generating another passport.'}
      </p>
      <div className="state-screen-actions">
        <button type="button" onClick={onReset} className="btn-secondary">
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
      <div className="state-screen-icon">⚠️</div>
      <h3 id="stateScreenHeading" tabIndex={-1} className="state-screen-title">Something Went Wrong</h3>
      <p className="state-screen-desc">
        {error}
      </p>
      <div className="state-screen-actions">
        <button type="button" onClick={onRetry} className="btn-secondary">
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
      <div className="state-screen-icon">📍</div>
      <h3 id="stateScreenHeading" tabIndex={-1} className="state-screen-title">Limited Coverage in {destination}</h3>
      <p className="state-screen-desc">
        Qloo found only {categoryCount} distinct category for this profile in the {destination} area.
        Try adding broader cultural artists or exploring a larger destination metropolitan area.
      </p>
      <div className="state-screen-actions">
        <button type="button" onClick={onAdjust} className="btn-secondary">
          Adjust Favorites & Destination
        </button>
      </div>
    </div>
  );
}

