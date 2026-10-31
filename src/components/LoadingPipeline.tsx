'use client';

import React, { useEffect, useState } from 'react';
import type { PipelineProgressEvent } from '@/lib/pipeline';

interface LoadingPipelineProps {
  currentProgress: PipelineProgressEvent | null;
  onCancel: () => void;
}

interface StageInfo {
  stepNum: number;
  tag: string;
  title: string;
  defaultDescription: string;
}

const STAGES_MAP: Record<string, StageInfo> = {
  resolving: {
    stepNum: 1,
    tag: 'Step 1 of 4',
    title: 'Resolving Cultural Entities',
    defaultDescription: 'Locating matches across the Qloo taste graph.',
  },
  inferring_cuisines: {
    stepNum: 2,
    tag: 'Step 2 of 4',
    title: 'Inferring Regional Cuisines',
    defaultDescription: 'Comparing destination baseline to extract enriched cuisines.',
  },
  querying_places: {
    stepNum: 3,
    tag: 'Step 3 of 4',
    title: 'Retrieving Places & Lift',
    defaultDescription: 'Fetching top places and calculating verified taste lift.',
  },
  writing: {
    stepNum: 4,
    tag: 'Step 4 of 4',
    title: 'Synthesizing Settling Guide',
    defaultDescription: 'Generating grounded settling guide using verified place attributes.',
  },
};

export function LoadingPipeline({ currentProgress, onCancel }: LoadingPipelineProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const stageKey = currentProgress?.stage || 'resolving';
  const stageInfo = STAGES_MAP[stageKey] || {
    stepNum: 1,
    tag: 'Processing',
    title: 'Building Taste Passport',
    defaultDescription: 'Connecting to taste intelligence graph...',
  };

  const progressPercent = Math.min(100, Math.max(10, stageInfo.stepNum * 25));
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
  const isDelayed = elapsedMs >= 20000;

  return (
    <div className="loading-pipeline-view">
      <div className="pipeline-stage-card fixed-height-card">
        {/* Progress header: Step n of 4 + thin progress line (No dots) */}
        <div className="pipeline-progress-header">
          <div className="pipeline-step-label">{stageInfo.tag}</div>
          <div className="pipeline-progress-track">
            <div
              className="pipeline-progress-bar"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Center hero spinner with fixed dimensions */}
        <div className="pipeline-center-hero">
          <div className="pipeline-spinner-ring" />
          <svg className="ui-icon" style={{ width: '36px', height: '36px' }} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Stage tag, 1-line title with ellipsis, fixed 2-line description area */}
        <div className="pipeline-stage-tag">{stageInfo.tag.toUpperCase()}</div>
        <h3
          id="loadingHeading"
          tabIndex={-1}
          className="pipeline-stage-title"
          title={stageInfo.title}
        >
          {stageInfo.title}
        </h3>

        {/* Fixed 2-line description box; shows delayed notice inside after 20s without layout shift */}
        <div className="pipeline-stage-desc-fixed">
          {isDelayed ? (
            <span style={{ color: 'var(--color-terracotta)', fontWeight: 600 }}>
              Still working, Qloo queries are in progress
            </span>
          ) : (
            currentProgress?.message || stageInfo.defaultDescription
          )}
        </div>

        {/* Fixed timer and cancel dock at bottom */}
        <div className="pipeline-bottom-dock">
          <div className="pipeline-elapsed-timer">
            <svg className="ui-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Elapsed: {elapsedSeconds}s</span>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            style={{ minHeight: '44px', padding: '0 24px', fontSize: '0.88rem', touchAction: 'manipulation' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
