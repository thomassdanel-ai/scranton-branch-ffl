import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { sendEmail } from '@/lib/email/resend';
import { buildInviteEmail, buildReminderEmail } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const supabase = createServiceClient();
    const { leagueId, type } = await req.json();

    if (!leagueId || !['invite', 'reminder'].includes(type)) {
      return NextResponse.json({ error: 'leagueId and type (invite|reminder) required' }, { status: 400 });
    }

    // Get league with season info
    const { data: league } = await supabase
      .from('leagues')
      .select('id, name, sleeper_league_id, sleeper_invite_link, season_id, seasons(year)')
      .eq('id', leagueId)
      .single();

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    if (!league.sleeper_invite_link) {
      return NextResponse.json({ error: 'League has no Sleeper invite link' }, { status: 400 });
    }

    const seasonYear = (league.seasons as unknown as { year: string })?.year ?? '';

    // Get member_seasons joined with members
    let query = supabase
      .from('member_seasons')
      .select('id, invite_sent_at, enrollment_status, members(full_name, email)')
      .eq('league_id', leagueId);

    if (type === 'invite') {
      query = query.is('invite_sent_at', null);
    } else {
      // Reminder: already invited but not enrolled
      query = query.not('invite_sent_at', 'is', null).in('enrollment_status', ['pending', 'invited']);
    }

    const { data: memberSeasons } = await query;
    if (!memberSeasons || memberSeasons.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: 'No members to email' });
    }

    let sent = 0;
    let failed = 0;

    for (const ms of memberSeasons) {
      const member = ms.members as unknown as { full_name: string; email: string } | null;
      if (!member?.email) { failed++; continue; }

      const html = type === 'invite'
        ? buildInviteEmail({
            memberName: member.full_name,
            leagueName: league.name,
            sleeperInviteLink: league.sleeper_invite_link,
            seasonYear,
          })
        : buildReminderEmail({
            memberName: member.full_name,
            leagueName: league.name,
            sleeperInviteLink: league.sleeper_invite_link,
            enrolledCount: 0, // filled below
            totalCount: 0,
          });

      // For reminders, get enrollment counts
      if (type === 'reminder') {
        const { count: enrolledCount } = await supabase
          .from('member_seasons')
          .select('id', { count: 'exact', head: true })
          .eq('league_id', leagueId)
          .eq('enrollment_status', 'enrolled');

        const { count: totalCount } = await supabase
          .from('member_seasons')
          .select('id', { count: 'exact', head: true })
          .eq('league_id', leagueId);

        // Re-build with actual counts
        const reminderHtml = buildReminderEmail({
          memberName: member.full_name,
          leagueName: league.name,
          sleeperInviteLink: league.sleeper_invite_link,
          enrolledCount: enrolledCount ?? 0,
          totalCount: totalCount ?? 0,
        });

        const result = await sendEmail({
          to: member.email,
          subject: `Reminder: Join ${league.name} on Sleeper`,
          html: reminderHtml,
        });

        if (result.success) {
          await supabase.from('member_seasons').update({ reminder_sent_at: new Date().toISOString() }).eq('id', ms.id);
          sent++;
        } else { failed++; }
        continue;
      }

      const result = await sendEmail({
        to: member.email,
        subject: `You're in! Join ${league.name} on Sleeper`,
        html,
      });

      if (result.success) {
        await supabase.from('member_seasons').update({
          invite_sent_at: new Date().toISOString(),
          enrollment_status: 'invited',
        }).eq('id', ms.id);
        sent++;
      } else { failed++; }
    }

    return NextResponse.json({ sent, failed });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
