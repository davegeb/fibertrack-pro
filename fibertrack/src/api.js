import { supabase } from './supabaseClient'

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function fetchTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('start_week', { ascending: true })
  if (error) throw error
  return data.map(dbToTask)
}

export async function upsertTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .upsert(taskToDb(task), { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return dbToTask(data)
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ─── Permits ──────────────────────────────────────────────────────────────────

export async function fetchPermits() {
  const { data, error } = await supabase
    .from('permits')
    .select('*')
    .order('submitted_week', { ascending: true })
  if (error) throw error
  return data.map(dbToPermit)
}

export async function upsertPermit(permit) {
  const { data, error } = await supabase
    .from('permits')
    .upsert(permitToDb(permit), { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return dbToPermit(data)
}

export async function deletePermit(id) {
  const { error } = await supabase.from('permits').delete().eq('id', id)
  if (error) throw error
}

// ─── Mappers (camelCase ↔ snake_case) ────────────────────────────────────────

function taskToDb(t) {
  return {
    id: t.id,
    name: t.name,
    phase: t.phase,
    start_week: t.startWeek,
    duration_weeks: t.durationWeeks,
    resources: t.resources,       // stored as jsonb array
    segments: t.segments,
    notes: t.notes,
  }
}

function dbToTask(row) {
  return {
    id: row.id,
    name: row.name,
    phase: row.phase,
    startWeek: row.start_week,
    durationWeeks: row.duration_weeks,
    resources: row.resources ?? [],
    segments: row.segments ?? '',
    notes: row.notes ?? '',
  }
}

function permitToDb(p) {
  return {
    id: p.id,
    type: p.type,
    segment: p.segment,
    submitted_week: p.submittedWeek,
    approved_week: p.approvedWeek ?? null,
    status: p.status,
    authority: p.authority,
    notes: p.notes,
  }
}

function dbToPermit(row) {
  return {
    id: row.id,
    type: row.type,
    segment: row.segment,
    submittedWeek: row.submitted_week,
    approvedWeek: row.approved_week,
    status: row.status,
    authority: row.authority,
    notes: row.notes ?? '',
  }
}
