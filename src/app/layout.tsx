import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Taste Passport',
  description: 'Discover places tailored to your taste profile powered by Qloo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        {children}
      </body>
    </html>
  );
}

