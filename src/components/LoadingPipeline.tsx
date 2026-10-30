'use client';

import React, { useEffect, useState } from 'react';
import type { PipelineProgressEvent } from '@/lib/pipeline';

interface LoadingPipelineProps {
  currentProgress: PipelineProgressEvent | null;
  onCancel: () => void;
}

interface StageInfo {
  tag: string;
  title: string;
  description: string;
}

const STAGE_DETAILS: Record<string, StageInfo> = {
  resolving: {
    tag: 'STAGE 1 OF 5',
    title: 'Resolving Cultural Entities',
    description: 'Verifying entities against Qloo taste intelligence graph.',
  },
  affinity: {
    tag: 'STAGE 2 OF 5',
    title: 'Querying Qloo Taste Affinity',
    description: 'Fetching cross-domain cultural correlations and cuisine weights.',
  },
  baseline: {
    tag: 'STAGE 3 OF 5',
    title: 'Establishing Destination Baseline',
    description: 'Sampling unguided destination distribution to compute statistical taste lift.',
  },
  reranking: {
    tag: 'STAGE 4 OF 5',
    title: 'Ranking Categories & Venues',
    description: 'Applying hierarchical category assignment and deduplicating places.',
  },
  descriptions: {
    tag: 'STAGE 5 OF 5',
    title: 'Synthesizing First-Month Guide',
    description: 'Generating grounded settling guide using verified place attributes.',
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
  const stageInfo = STAGE_DETAILS[stageKey] || {
    tag: 'PROCESSING',
    title: 'Processing Taste Passport',
    description: currentProgress?.message || 'Connecting to taste intelligence graph...',
  };

  const stagesList = ['resolving', 'affinity', 'baseline', 'reranking', 'descriptions'];
  const currentStageIndex = stagesList.indexOf(stageKey);

  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
  const isDelayed = elapsedMs >= 20000;

  return (
    <div className="loading-pipeline-view">
      <div className="pipeline-stage-card">
        {/* Progress indicators */}
        <div className="pipeline-progress-indicators" aria-label="Pipeline progress stages">
          {stagesList.map((stg, i) => {
            const isDone = currentStageIndex > i;
            const isActive = currentStageIndex === i;
            return (
              <div
                key={stg}
                className={`progress-dot ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                title={stg}
              />
            );
          })}
        </div>

        {/* Center hero spinner */}
        <div className="pipeline-center-hero">
          <div className="pipeline-spinner-ring" />
          <svg className="ui-icon" style={{ width: '38px', height: '38px' }} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polygon points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Stage details */}
        <div className="pipeline-stage-tag">{stageInfo.tag}</div>
        <h3 className="pipeline-stage-title">{stageInfo.title}</h3>
        <p className="pipeline-stage-desc">
          {currentProgress?.message || stageInfo.description}
        </p>

        {/* Timer */}
        <div className="pipeline-elapsed-timer">
          <svg className="ui-icon" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Elapsed: {elapsedSeconds}s</span>
        </div>

        {/* Delayed notice (Task requirement) */}
        {isDelayed && (
          <div className="pipeline-delayed-notice" role="status">
            Still working, Qloo queries are in progress
          </div>
        )}

        {/* Cancel button */}
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          style={{ minHeight: '40px', padding: '0 20px', fontSize: '0.88rem' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
