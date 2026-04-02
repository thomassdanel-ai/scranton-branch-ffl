'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Step1StartSeason from './steps/Step1StartSeason';
import Step2Cohorts from './steps/Step2Cohorts';
import Step3Registrations from './steps/Step3Registrations';
import Step4ConfigureAndAssign from './steps/Step4ConfigureAndAssign';
import Step5DraftOrder from './steps/Step5DraftOrder';
import Step6SleeperLinking from './steps/Step6SleeperLinking';

// Shared types used across steps
export type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
  num_leagues: number;
  roster_size_per_league: number;
};

export type League = {
  id: string;
  name: string;
  short_name: string;
  color: string;
  position: number;
  sleeper_league_id: string | null;
};

export type Member = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  status: string;
};

export type MemberSeason = {
  id: string;
  member_id: string;
  league_id: string;
  draft_position: number | null;
  onboard_status: string;
  sleeper_roster_id: string | null;
  sleeper_display_name: string | null;
};

export type Cohort = {
  id: string;
  name: string;
  color: string;
  status: string;
  invite_token: string;
  settings: Record<string, unknown>;
  season_registrations: { count: number }[];
};

export type Registration = {
  id: string;
  status: string;
  registered_at: string;
  member_id: string;
  cohort_id: string;
  members: { full_name: string; display_name: string | null; email: string };
};

export type DraftBoard = {
  id: string;
  league_id: string;
  sleeper_draft_id: string | null;
  status: string;
};

export type StepCompletion = {
  season: boolean;
  cohorts: boolean;
  registrations: boolean;
  leagues: boolean;
  draft: boolean;
  sleeper: boolean;
};

export type FlashFn = (msg: string, type: 'error' | 'success') => void;

type ProgressData = {
  season: Season | null;
  nextSeasonNumber: number;
  leagues: League[];
  cohorts: Cohort[];
  registrationsByCohort: Record<string, Registration[]>;
  confirmedMemberCount: number;
  totalRegisteredCount: number;
  members: Member[];
  memberSeasons: MemberSeason[];
  draftBoards: DraftBoard[];
  currentStep: number;
  stepCompletion: StepCompletion;
};

const STEPS = [
  { num: 1, label: 'Start Season' },
  { num: 2, label: 'Cohorts & Invites' },
  { num: 3, label: 'Review Registrations' },
  { num: 4, label: 'Configure & Assign' },
  { num: 5, label: 'Draft Order' },
  { num: 6, label: 'Sleeper Linking' },
];

export default function SeasonSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [viewingStep, setViewingStep] = useState<number | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);

  const flash: FlashFn = useCallback((msg, type) => {
    setFlashMsg({ text: msg, type });
  }, []);

  const dismissFlash = useCallback(() => setFlashMsg(null), []);

  const fetchProgress = useCallback(async () => {
    const res = await fetch('/api/admin/setup/progress');
    if (res.status === 401) {
      router.push('/admin');
      return;
    }
    const data: ProgressData = await res.json();
    setProgress(data);
    setLoading(false);
    setViewingStep(null);
  }, [router]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  if (loading || !progress) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading wizard...</p>
      </div>
    );
  }

  const p = progress;
  const { currentStep } = p;
  const activeViewStep = viewingStep ?? currentStep;
  const isWizardComplete = currentStep >= 7;

  function handleStepClick(stepNum: number) {
    if (stepNum <= currentStep) {
      setViewingStep(stepNum);
    }
  }

  async function onComplete() {
    await fetchProgress();
  }

  function renderStep() {
    if (isWizardComplete) {
      return (
        <div className="glass-card p-8 text-center space-y-3">
          <div className="text-4xl">&#127942;</div>
          <p className="text-accent-green text-xl font-bold">
            Season {p.season!.season_number} Setup Complete!
          </p>
          <p className="text-text-muted text-sm">
            Status: {p.season!.status} | {p.leagues.length} leagues | {p.memberSeasons.length} members assigned
          </p>
          <Link
            href="/admin"
            className="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      );
    }

    switch (activeViewStep) {
      case 1:
        return (
          <Step1StartSeason
            season={p.season}
            nextSeasonNumber={p.nextSeasonNumber}
            flash={flash}
            onComplete={onComplete}
          />
        );
      case 2:
        return (
          <Step2Cohorts
            season={p.season}
            cohorts={p.cohorts}
            flash={flash}
            onComplete={onComplete}
            isReview={currentStep > 2}
          />
        );
      case 3:
        return (
          <Step3Registrations
            season={p.season}
            cohorts={p.cohorts}
            registrationsByCohort={p.registrationsByCohort}
            confirmedMemberCount={p.confirmedMemberCount}
            totalRegisteredCount={p.totalRegisteredCount}
            memberSeasons={p.memberSeasons}
            flash={flash}
            onComplete={onComplete}
            isReview={currentStep > 3}
          />
        );
      case 4:
        return (
          <Step4ConfigureAndAssign
            season={p.season!}
            leagues={p.leagues}
            members={p.members}
            memberSeasons={p.memberSeasons}
            confirmedMemberCount={p.confirmedMemberCount}
            flash={flash}
            onComplete={onComplete}
            isReview={currentStep > 4}
          />
        );
      case 5:
        return (
          <Step5DraftOrder
            season={p.season!}
            leagues={p.leagues}
            members={p.members}
            memberSeasons={p.memberSeasons}
            draftBoards={p.draftBoards}
            flash={flash}
            onComplete={onComplete}
            isReview={currentStep > 5}
          />
        );
      case 6:
        return (
          <Step6SleeperLinking
            season={p.season!}
            leagues={p.leagues}
            members={p.members}
            memberSeasons={p.memberSeasons}
            draftBoards={p.draftBoards}
            flash={flash}
            onComplete={onComplete}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/admin" className="text-text-muted text-sm hover:text-white transition-colors">
          &larr; Back to Admin
        </Link>
        <h1 className="text-2xl font-extrabold text-white mt-1">Season Setup Wizard</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {STEPS.map((s) => {
          const isCompleted = s.num < currentStep;
          const isCurrent = s.num === currentStep && !isWizardComplete;
          const isViewing = s.num === activeViewStep;
          const isClickable = s.num <= currentStep;

          return (
            <button
              key={s.num}
              onClick={() => handleStepClick(s.num)}
              disabled={!isClickable}
              className={`flex-1 text-center py-2 text-xs font-medium rounded transition-colors ${
                isViewing && isCompleted
                  ? 'bg-accent-green/30 text-accent-green ring-2 ring-accent-green/50'
                  : isViewing && isCurrent
                    ? 'bg-primary ring-2 ring-primary/50 text-white'
                    : isCompleted
                      ? 'bg-accent-green/20 text-accent-green cursor-pointer hover:bg-accent-green/30'
                      : isCurrent
                        ? 'bg-primary text-white'
                        : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              }`}
            >
              {isCompleted ? '\u2713 ' : ''}{s.num}. {s.label}
            </button>
          );
        })}
      </div>

      {/* Flash messages */}
      {flashMsg && (
        <div
          className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm ${
            flashMsg.type === 'error'
              ? 'text-accent-red bg-red-500/10'
              : 'text-accent-green bg-green-500/10'
          }`}
        >
          <span>{flashMsg.text}</span>
          <button
            onClick={dismissFlash}
            className="ml-4 text-lg leading-none opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Active step */}
      {renderStep()}
    </div>
  );
}
