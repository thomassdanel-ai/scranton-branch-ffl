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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading wizard&hellip;</p>
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
        <div className="wiz-done">
          <div className="wiz-done__emoji">&#127942;</div>
          <p className="wiz-done__title">Season {p.season!.season_number} Setup Complete</p>
          <p className="wiz-done__sub">
            Status: {p.season!.status} &middot; {p.leagues.length} leagues &middot; {p.memberSeasons.length} members assigned
          </p>
          <Link href="/admin" className="btn btn--primary btn--lg" style={{ marginTop: 8 }}>
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
    <div className="col col--lg" style={{ maxWidth: 960 }}>
      <div className="page-head">
        <Link href="/admin" className="back-link">
          <span aria-hidden="true">&larr;</span> Back to Admin
        </Link>
        <h1 className="page-head__title">Season Setup Wizard</h1>
      </div>

      {/* Step indicator */}
      <div className="wiz-nav">
        {STEPS.map((s) => {
          const isCompleted = s.num < currentStep;
          const isCurrent = s.num === currentStep && !isWizardComplete;
          const isViewing = s.num === activeViewStep;
          const isClickable = s.num <= currentStep;

          const cls = ['wiz-step'];
          if (isCompleted) cls.push('wiz-step--done');
          if (isCurrent) cls.push('wiz-step--current');
          if (isViewing) cls.push('wiz-step--viewing');

          return (
            <button
              key={s.num}
              onClick={() => handleStepClick(s.num)}
              disabled={!isClickable}
              className={cls.join(' ')}
            >
              <span className="wiz-step__num">{isCompleted ? '\u2713' : s.num}</span>
              <span className="wiz-step__label">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Flash messages */}
      {flashMsg && (
        <div className={`flash ${flashMsg.type === 'error' ? 'flash--error' : 'flash--success'}`}>
          <span>{flashMsg.text}</span>
          <button onClick={dismissFlash} className="flash__close" aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {/* Active step */}
      {renderStep()}
    </div>
  );
}
