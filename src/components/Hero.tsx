'use client';

import React from 'react';

interface HeroProps {
  destination?: string;
}

export function Hero({ destination }: HeroProps) {
  const destLabel = destination && destination.trim() ? destination.trim() : 'destination';

  return (
    <section
      className="hero-whole-frame"
      style={{
        padding: '40px 0 60px',
        position: 'relative',
      }}
    >
      <div className="container">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '48px',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {/* Hero Left Copy */}
          <div>
            <div className="passport-stamp teal" style={{ marginBottom: '16px' }}>
              <span>For people moving cities</span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.2rem, 4.4vw, 3.4rem)',
                lineHeight: 1.15,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--color-ink)',
                marginBottom: '20px',
              }}
            >
              Move anywhere. Find the places your{' '}
              <em
                style={{
                  fontStyle: 'italic',
                  color: 'var(--color-terracotta)',
                  textDecoration: 'underline wavy var(--color-saffron) 3px',
                  textUnderlineOffset: '6px',
                }}
              >
                taste points to
              </em>
              .
            </h1>
            <p
              style={{
                fontSize: '1.1rem',
                lineHeight: 1.65,
                color: 'var(--color-ink-muted)',
                marginBottom: '24px',
                maxWidth: '560px',
              }}
            >
              Enter your destination and 3 to 8 favorites from home to see where your taste points.
            </p>
            <div
              style={{
                fontSize: '0.94rem',
                color: 'var(--color-teal)',
                fontWeight: 600,
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg className="ui-icon" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Qloo picks the cuisines and the places. AI only writes the descriptions.</span>
            </div>
            <div>
              <a href="#step1Section" className="btn-primary-large">
                <span>Begin Your Passport</span>
                <svg className="ui-icon" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              </a>
            </div>
          </div>

          {/* Hero Right: Cultural Taste Affinity Map Illustration */}
          <div
            style={{
              background: '#FCFAF6',
              border: '1.5px solid #ECE5D8',
              borderRadius: 'var(--radius-xl)',
              padding: '24px',
              boxShadow:
                '0 2px 4px rgba(71, 57, 36, 0.03), 0 14px 28px rgba(71, 57, 36, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
              position: 'relative',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            {/* Top Compass: Static (Motion budget rule: no spin) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: '4px',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  style={{ width: '64px', height: '64px' }}
                  viewBox="0 0 100 100"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="32"
                    stroke="#B8B09F"
                    strokeWidth="1.2"
                    strokeDasharray="2 3"
                    opacity="0.8"
                  />
                  <line
                    x1="50"
                    y1="6"
                    x2="50"
                    y2="94"
                    stroke="#B8B09F"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.85"
                  />
                  <line
                    x1="6"
                    y1="50"
                    x2="94"
                    y2="50"
                    stroke="#B8B09F"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.85"
                  />
                  <circle cx="50" cy="18" r="1.5" fill="#1C4D43" />
                  <circle cx="82" cy="50" r="1.5" fill="#D86534" />
                  <circle cx="50" cy="82" r="1.5" fill="#1C4D43" />
                  <circle cx="18" cy="50" r="1.5" fill="#D86534" />
                </svg>

                <svg
                  style={{
                    position: 'absolute',
                    width: '32px',
                    height: '32px',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
                    pointerEvents: 'none',
                  }}
                  viewBox="0 0 40 40"
                  fill="none"
                  aria-hidden="true"
                >
                  <polygon points="20,5 24,20 20,18" fill="#D86534" />
                  <polygon points="20,5 16,20 20,18" fill="#F19266" />
                  <polygon points="20,35 24,20 20,22" fill="#1C4D43" />
                  <polygon points="20,35 16,20 20,22" fill="#3D7D70" />
                  <circle cx="20" cy="20" r="2.2" fill="#FCFAF6" stroke="#1C4D43" strokeWidth="1.2" />
                </svg>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                  color: '#8E9B9F',
                  marginTop: '4px',
                }}
              >
                From home to {destLabel}
              </span>
            </div>

            {/* Main Stage: Origin -> Arc -> Destination */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                margin: '16px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '220px',
              }}
            >
              {/* SVG Mapping Arc Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <svg
                  style={{ width: '100%', height: '100%' }}
                  viewBox="0 0 740 280"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="heroArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#D86534" />
                      <stop offset="50%" stop-color="#E29938" />
                      <stop offset="100%" stop-color="#1C4D43" />
                    </linearGradient>

                    <filter id="heroSparkGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <path
                    d="M 215 140 C 290 42, 450 42, 525 140"
                    fill="none"
                    stroke="url(#heroArcGrad)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeDasharray="6 6"
                    className="arc-track"
                  />

                  {/* Single Travelling Particle */}
                  <g>
                    <circle r="4.5" fill="#E29938" filter="url(#heroSparkGlow)">
                      <animateMotion
                        repeatCount="indefinite"
                        dur="2.4s"
                        path="M 215 140 C 290 42, 450 42, 525 140"
                        keyPoints="0;1"
                        keyTimes="0;1"
                      />
                    </circle>
                    <circle r="2" fill="#FFFFFF">
                      <animateMotion
                        repeatCount="indefinite"
                        dur="2.4s"
                        path="M 215 140 C 290 42, 450 42, 525 140"
                        keyPoints="0;1"
                        keyTimes="0;1"
                      />
                    </circle>
                  </g>
                </svg>
              </div>

              {/* LEFT: Cultural Origin (Handi) */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 20,
                  width: '48%',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '140px',
                    height: '130px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    style={{ width: '120px', height: '110px' }}
                    viewBox="0 0 160 140"
                    fill="none"
                    aria-hidden="true"
                  >
                    <ellipse cx="80" cy="124" rx="56" ry="12" fill="#E8DEC9" />
                    <ellipse
                      cx="80"
                      cy="120"
                      rx="58"
                      ry="11"
                      fill="none"
                      stroke="#C7BC9F"
                      strokeWidth="1.8"
                      strokeDasharray="2 2"
                    />
                    <ellipse cx="80" cy="119" rx="54" ry="9" fill="#F4EEDF" />

                    <defs>
                      <linearGradient id="potGradHero" x1="20%" y1="0%" x2="80%" y2="100%">
                        <stop offset="0%" stop-color="#E97746" />
                        <stop offset="60%" stop-color="#D86534" />
                        <stop offset="100%" stop-color="#9E3C14" />
                      </linearGradient>
                      <radialGradient id="rimGleamHero" cx="50%" cy="30%" r="50%">
                        <stop offset="0%" stop-color="#FFF2E2" />
                        <stop offset="100%" stop-color="#DE7948" />
                      </radialGradient>
                    </defs>

                    <path
                      d="M 36,75 C 34,102 54,116 80,116 C 106,116 126,102 124,75 C 122,66 114,64 114,64 L 46,64 C 46,64 38,66 36,75 Z"
                      fill="url(#potGradHero)"
                    />
                    <ellipse cx="80" cy="64" rx="38" ry="7" fill="url(#rimGleamHero)" stroke="#B34B1D" strokeWidth="1" />
                    <ellipse cx="80" cy="64" rx="33" ry="5.5" fill="#EE9B3E" />
                  </svg>
                </div>
                <h2
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'var(--color-ink)',
                    textTransform: 'uppercase',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Cultural Origin</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#D86534',
                    }}
                  />
                </h2>
              </div>

              {/* RIGHT: Destination Haven (Cloche) */}
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 20,
                  width: '48%',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '140px',
                    height: '130px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    style={{ width: '125px', height: '110px' }}
                    viewBox="0 0 170 140"
                    fill="none"
                    aria-hidden="true"
                  >
                    <defs>
                      <radialGradient id="clocheGradHero" cx="40%" cy="35%" r="65%">
                        <stop offset="0%" stop-color="#2D7364" />
                        <stop offset="55%" stop-color="#1C4D43" />
                        <stop offset="100%" stop-color="#0E2D27" />
                      </radialGradient>
                    </defs>

                    <ellipse cx="85" cy="120" rx="64" ry="10" fill="#E8DEC9" />
                    <ellipse cx="85" cy="116" rx="62" ry="9" fill="#FFFFFF" stroke="#1C4D43" strokeWidth="1.8" />
                    <path
                      d="M 39,114 A 46 46 0 0 1 131,114 C 131,120.5 39,120.5 39,114 Z"
                      fill="url(#clocheGradHero)"
                      stroke="#123B33"
                      strokeWidth="1.2"
                    />
                    <circle cx="85" cy="62" r="5" fill="#E29938" stroke="#B97820" strokeWidth="0.8" />
                  </svg>
                </div>

                <h2
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: '#1C4D43',
                    textTransform: 'uppercase',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Destination Haven</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#1C4D43',
                    }}
                  />
                </h2>
              </div>
            </div>

            {/* Card Footer Status */}
            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(230, 223, 211, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.82rem',
                color: 'var(--color-ink-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    position: 'relative',
                    display: 'flex',
                    width: '10px',
                    height: '10px',
                  }}
                >
                  <span
                    className="live-ping"
                    style={{
                      position: 'absolute',
                      display: 'inline-flex',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: '#1C4D43',
                      opacity: 0.75,
                    }}
                  />
                  <span
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#1C4D43',
                    }}
                  />
                </span>
                <span style={{ fontWeight: 500, color: 'var(--color-ink)' }}>
                  Destination: {destLabel}
                </span>
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-ink-faint)' }}>
                READY
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
