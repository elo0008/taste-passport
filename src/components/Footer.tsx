'use client';

import React from 'react';

export function Footer() {
  const repoUrl = process.env.NEXT_PUBLIC_REPO_URL;

  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <span>Powered by the Qloo API.</span>
        {repoUrl && (
          <>
            <span>•</span>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer-link"
            >
              Source on GitHub
            </a>
          </>
        )}
      </div>
    </footer>
  );
}

