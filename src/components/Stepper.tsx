'use client';

import React from 'react';

interface StepperProps {
  currentStep: 1 | 2 | 3;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <nav className="stepper-nav" id="stepperNav" aria-label="Passport Creation Steps">
      <div className="container stepper-track">
        {/* Step 1 */}
        <div
          className={`step-item ${currentStep === 1 ? 'active' : ''} ${
            currentStep > 1 ? 'completed' : ''
          }`}
        >
          <span className="step-badge" aria-hidden="true">
            {currentStep > 1 ? (
              <svg style={{ width: '12px', height: '12px', strokeWidth: 3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              '1'
            )}
          </span>
          <span className="step-label">Destination &amp; Favorites</span>
        </div>

        <div className={`step-line ${currentStep > 1 ? 'filled' : ''}`} aria-hidden="true" />

        {/* Step 2 */}
        <div
          className={`step-item ${currentStep === 2 ? 'active' : ''} ${
            currentStep > 2 ? 'completed' : ''
          }`}
        >
          <span className="step-badge" aria-hidden="true">
            {currentStep > 2 ? (
              <svg style={{ width: '12px', height: '12px', strokeWidth: 3 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              '2'
            )}
          </span>
          <span className="step-label">Confirm Cultural Matches</span>
        </div>

        <div className={`step-line ${currentStep > 2 ? 'filled' : ''}`} aria-hidden="true" />

        {/* Step 3 */}
        <div className={`step-item ${currentStep === 3 ? 'active' : ''}`}>
          <span className="step-badge" aria-hidden="true">
            3
          </span>
          <span className="step-label">Taste Passport</span>
        </div>
      </div>
    </nav>
  );
}
