import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveSeasonId, getSeasonStatus } from '@/lib/config';
import { sanitizeRecapHtml } from '@/lib/sanitize-html';
import PhaseStrip from '@/components/layout/PhaseStrip';

async function getPublishedRecaps() {
  const supabase = createServiceClient();
  const seasonId = await getActiveSeasonId();

  let sid = seasonId;
  if (!sid) {
    const { data: latest } = await supabase
      .from('seasons')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    sid = latest?.id ?? null;
  }

  if (!sid) return [];

  const { data } = await supabase
    .from('newsletters')
    .select('id, week, subject, html_content, sent_at, cohort_id, cohorts(name, color)')
    .eq('season_id', sid)
    .not('sent_at', 'is', null)
    .order('week', { ascending: false });

  return data ?? [];
}

function formatDate(d: string) {
  try {
    return new Date(d)
      .toLocaleDateString('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric',
      })
      .toUpperCase();
  } catch {
    return '';
  }
}

export default async function RecapsPage() {
  const [recaps, status] = await Promise.all([getPublishedRecaps(), getSeasonStatus()]);
  const latest = recaps[0];
  const rest = recaps.slice(1);

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>RECAPS</b>
      </div>

      <PhaseStrip year={status.year} phase={status.phase} />

      <article className="wrap-article wrap-article--list">
        <div className="masthead">
          <div className="masthead__l">
            <div className="masthead__issue">THE WEEKLY RECAP</div>
            <div className="masthead__date">
              {status.year} SEASON · {recaps.length} {recaps.length === 1 ? 'ISSUE' : 'ISSUES'} PUBLISHED
            </div>
          </div>
          <div className="masthead__r">
            <span className="chip">
              <span>ARCHIVE · OPEN</span>
            </span>
            <span className="label">PUBLIC</span>
          </div>
        </div>

        {recaps.length === 0 ? (
          <div
            className="surface-raised"
            style={{
              padding: 48,
              textAlign: 'center',
              marginTop: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 36,
                letterSpacing: 'var(--tr-wide)',
                color: 'var(--ink-8)',
                textTransform: 'uppercase',
              }}
            >
              NO ISSUES YET
            </div>
            <p style={{ color: 'var(--ink-6)', fontSize: 'var(--fs-14)' }}>
              The commissioner hasn&apos;t sent a recap this season. Check back after Week 1.
            </p>
          </div>
        ) : (
          <>
            {latest && (
              <section style={{ marginBottom: 48 }}>
                <header className="issue-hero">
                  <div className="issue-hero__kicker">
                    <span className="dot" /> WEEK {latest.week} · THE RECAP
                  </div>
                  <h1 className="issue-title">{latest.subject}</h1>
                  <div className="byline">
                    <span>
                      BY <b>THE COMMISSIONER</b>
                    </span>
                    <span>·</span>
                    <span>{latest.sent_at ? formatDate(latest.sent_at) : 'DRAFT'}</span>
                    {(latest.cohorts as unknown as { name: string } | null)?.name && (
                      <>
                        <span>·</span>
                        <span>
                          {(latest.cohorts as unknown as { name: string }).name.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                </header>

                <div
                  className="recap-body"
                  dangerouslySetInnerHTML={{ __html: sanitizeRecapHtml(latest.html_content) }}
                />

                <aside className="hr-compliance">
                  <div className="hr-compliance__img" aria-label="Toby Flenderson" />
                  <div className="hr-compliance__text">
                    <div className="hr-compliance__lab">HR COMPLIANCE · REQUIRED NOTICE</div>
                    <div className="hr-compliance__msg">
                      Reminder that there can be absolutely no gambling or wagering in relation to
                      this league.
                    </div>
                    <div className="hr-compliance__sub">
                      Don&apos;t make Toby come out of the annex.
                    </div>
                  </div>
                </aside>

                <div className="meta-footer">
                  <span>
                    ISSUE № {String(latest.week).padStart(3, '0')} ·{' '}
                    {latest.sent_at ? formatDate(latest.sent_at) : ''}
                  </span>
                </div>
              </section>
            )}

            {rest.length > 0 && (
              <section>
                <div
                  className="label"
                  style={{
                    paddingBottom: 12,
                    borderBottom: 'var(--hairline-strong)',
                    marginBottom: 16,
                  }}
                >
                  EARLIER ISSUES · {rest.length}
                </div>
                {rest.map((recap) => {
                  const cohort = recap.cohorts as unknown as { name: string; color: string } | null;
                  return (
                    <details key={recap.id} className="issue-card">
                      <summary>
                        <span className="issue-card__num">
                          {String(recap.week).padStart(2, '0')}
                        </span>
                        <div className="issue-card__body">
                          <div className="issue-card__title">{recap.subject}</div>
                          <div className="issue-card__meta">
                            <span>WEEK {recap.week}</span>
                            {recap.sent_at && (
                              <>
                                <span>·</span>
                                <span>{formatDate(recap.sent_at)}</span>
                              </>
                            )}
                            {cohort && (
                              <>
                                <span>·</span>
                                <span style={{ color: cohort.color }}>{cohort.name.toUpperCase()}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="issue-card__arrow">›</span>
                      </summary>
                      <div className="issue-card__content">
                        <div
                          className="recap-body"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeRecapHtml(recap.html_content),
                          }}
                        />
                        <aside className="hr-compliance">
                          <div className="hr-compliance__img" aria-label="Toby Flenderson" />
                          <div className="hr-compliance__text">
                            <div className="hr-compliance__lab">HR COMPLIANCE · REQUIRED NOTICE</div>
                            <div className="hr-compliance__msg">
                              Reminder that there can be absolutely no gambling or wagering in
                              relation to this league.
                            </div>
                            <div className="hr-compliance__sub">
                              Don&apos;t make Toby come out of the annex.
                            </div>
                          </div>
                        </aside>
                      </div>
                    </details>
                  );
                })}
              </section>
            )}
          </>
        )}
      </article>
    </>
  );
}
