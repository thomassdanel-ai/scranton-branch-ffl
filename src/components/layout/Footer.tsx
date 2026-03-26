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
      <footer className="mt-auto border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-text-muted text-sm">
              {ORG_NAME} — {currentYear} Season
            </p>
            <p className="text-text-muted text-xs">
              Scranton Branch —{' '}
              <span className="italic">A Dunder Mifflin Production</span>
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Link
                href="/admin"
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Commissioner Panel
              </Link>
              <span className="text-text-muted text-xs">•</span>
              <button
                onClick={() => setShowToby(true)}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                HR Compliance
              </button>
              <span className="text-text-muted text-xs">•</span>
              <span className="text-xs text-text-muted">
                Powered by Sleeper API
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Toby Modal */}
      {showToby && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowToby(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative glass-card p-6 sm:p-8 max-w-sm w-full text-center space-y-4 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-32 h-32 rounded-lg overflow-hidden border border-white/10">
              <Image
                src="/images/toby.jpg"
                alt="Toby Flenderson, HR Representative"
                width={128}
                height={128}
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-red-400 font-bold text-sm leading-snug">
              Reminder that there can be absolutely no gambling or wagering in relation to this league.
            </p>
            <p className="text-text-muted text-xs">
              Don&apos;t make Toby come out of the annex.
            </p>
            <button
              onClick={() => setShowToby(false)}
              className="px-4 py-2 bg-bg-tertiary text-text-secondary text-xs rounded-lg hover:bg-white/10 transition-colors border border-white/10"
            >
              Go back to the annex, Toby.
            </button>
          </div>
        </div>
      )}
    </>
  );
}
