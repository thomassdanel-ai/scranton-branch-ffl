import { createServiceClient } from '@/lib/supabase/server';
import { getActiveSeasonId } from '@/lib/config';

async function getPublishedRecaps() {
  const supabase = createServiceClient();
  const seasonId = await getActiveSeasonId();

  // Get latest season if no active
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

export default async function RecapsPage() {
  const recaps = await getPublishedRecaps();

  if (recaps.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-white">Weekly Recaps</h1>
        <div className="glass-card p-8 text-center">
          <p className="text-text-muted">No recaps published yet. Check back after the season starts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-white">Weekly Recaps</h1>
      <div className="space-y-4">
        {recaps.map((recap) => {
          const cohort = recap.cohorts as unknown as { name: string; color: string } | null;
          return (
            <details key={recap.id} className="glass-card overflow-hidden">
              <summary className="p-6 cursor-pointer hover:bg-white/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-white inline">{recap.subject}</h2>
                    <span className="text-text-muted text-sm ml-2">Week {recap.week}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cohort && (
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{ backgroundColor: cohort.color + '20', color: cohort.color }}
                      >
                        {cohort.name}
                      </span>
                    )}
                    <span className="text-text-muted text-xs">
                      {new Date(recap.sent_at!).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </summary>
              <div
                className="p-6 pt-0 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: recap.html_content }}
              />
            </details>
          );
        })}
      </div>
    </div>
  );
}
