import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { requireCohortAccess } from '@/lib/auth-scope';

// Cohort settings is stored as JSONB; constrain the shape + numeric bounds so
// the body can't be stuffed with arbitrary/oversized fields.
const SettingsSchema = z
  .object({
    maxCapacity: z.number().int().min(0).max(1000).optional(),
    // `description` is surfaced in a few places; keep it bounded.
    description: z.string().max(2_000).optional(),
  })
  .strict();

const PutSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    status: z.enum(['draft', 'open', 'closed', 'archived']).optional(),
    settings: SettingsSchema.optional(),
  })
  .strict();

// PUT: Update cohort (name, color, status, settings)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await requireCohortAccess(user, params.id);

    const supabase = createServiceClient();
    const raw = await req.json();
    const parsed = PutSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const body = parsed.data;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.color !== undefined) updates.color = body.color;
    if (body.status !== undefined) updates.status = body.status;
    if (body.settings !== undefined) updates.settings = body.settings;

    const { data, error } = await supabase
      .from('cohorts')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cohort: data });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof Error && err.message.includes('Forbidden')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }
}
