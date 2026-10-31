'use client';

import React from 'react';

export function Header() {
  return (
    <header
      className="site-header"
      role="banner"
      style={{
        borderBottom: '1px solid var(--color-hairline)',
        background: 'rgba(250, 246, 239, 0.94)',
        backdropFilter: 'blur(14px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: 'var(--font-display)',
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--color-terracotta-light)',
              border: '1.5px solid var(--color-terracotta)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-terracotta)',
              flexShrink: 0,
            }}
          >
            <svg className="ui-icon" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <span>Taste Passport</span>
          <span
            className="header-subtitle"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.82rem',
              color: 'var(--color-ink-muted)',
              fontWeight: 400,
            }}
          >
            | Cultural Relocation Guide
          </span>
        </div>
      </div>
    </header>
  );
}
