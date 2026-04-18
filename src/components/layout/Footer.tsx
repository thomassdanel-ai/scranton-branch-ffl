'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ORG_NAME } from '@/config/constants';
import { useLeagueConfig } from '@/components/providers/ConfigProvider';

export default function Footer() {
  const [showToby, setShowToby] = useState(false);
  const { seasonYear } = useLeagueConfig();
  const currentYear = seasonYear || new Date().getFullYear().toString();

  return (
    <>
      <footer
        className="mt-auto"
        style={{
          borderTop: 'var(--hairline)',
          background: 'var(--ink-1)',
        }}
      >
        <div className="wrap">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6">
            <div className="flex items-center gap-3">
              <span
                className="topnav__brand-mark"
                aria-hidden
                style={{ width: 22, height: 22 }}
              />
              <div className="flex flex-col leading-tight">
                <span
                  className="font-mono text-[12px] font-semibold"
                  style={{ color: 'var(--ink-7)' }}
                >
                  {ORG_NAME}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.12em]"
                  style={{ color: 'var(--ink-5)' }}
                >
                  {currentYear} SEASON · A DUNDER MIFFLIN PRODUCTION
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/admin" className="label hover:text-[var(--accent-live)]">
                Commissioner
              </Link>
              <span style={{ color: 'var(--ink-4)' }}>/</span>
              <button
                type="button"
                onClick={() => setShowToby(true)}
                className="label hover:text-[var(--accent-danger)]"
              >
                HR Compliance
              </button>
              <span style={{ color: 'var(--ink-4)' }}>/</span>
              <span className="label">Sleeper API</span>
            </div>
          </div>
        </div>
      </footer>

      {showToby && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowToby(false)}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'oklch(0 0 0 / 0.72)', backdropFilter: 'blur(4px)' }}
          />
          <div
            className="relative surface-raised p-6 sm:p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-32 h-32 overflow-hidden"
                style={{
                  borderRadius: 'var(--r-3)',
                  border: 'var(--hairline-strong)',
                }}
              >
                <Image
                  src="/images/toby.jpg"
                  alt="Toby Flenderson, HR Representative"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="chip chip--danger">HR Compliance Notice</span>
              <p
                className="font-serif italic text-[15px] leading-snug"
                style={{ color: 'var(--ink-8)' }}
              >
                Reminder that there can be absolutely no gambling or wagering in
                relation to this league.
              </p>
              <p className="label">Don&apos;t make Toby come out of the annex.</p>
              <button
                type="button"
                onClick={() => setShowToby(false)}
                className="btn btn--sm"
              >
                Go back to the annex, Toby.
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
