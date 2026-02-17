import { supabase } from './supabaseClient'

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function fetchProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map(dbToProject)
}

export async function upsertProject(project) {
  const { data, error } = await supabase
    .from('projects')
    .upsert(projectToDb(project), { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return dbToProject(data)
}

export async function deleteProject(id) {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw error
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function fetchTasks(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('start_week', { ascending: true })
  if (error) throw error
  return data.map(dbToTask)
}

export async function upsertTask(task, projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .upsert({ ...taskToDb(task), project_id: projectId }, { onConflict: 'id' })
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

export async function fetchPermits(projectId) {
  const { data, error } = await supabase
    .from('permits')
    .select('*')
    .eq('project_id', projectId)
    .order('submitted_week', { ascending: true })
  if (error) throw error
  return data.map(dbToPermit)
}

export async function upsertPermit(permit, projectId) {
  const { data, error } = await supabase
    .from('permits')
    .upsert({ ...permitToDb(permit), project_id: projectId }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return dbToPermit(data)
}

export async function deletePermit(id) {
  const { error } = await supabase.from('permits').delete().eq('id', id)
  if (error) throw error
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function projectToDb(p) {
  return {
    id:           p.id,
    name:         p.name,
    description:  p.description,
    location:     p.location,
    start_week:   p.startWeek,
    total_weeks:  p.totalWeeks,
    current_week: p.currentWeek,
    status:       p.status,
    health:       p.health,
  }
}

function dbToProject(row) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description ?? '',
    location:    row.location ?? '',
    startWeek:   row.start_week,
    totalWeeks:  row.total_weeks,
    currentWeek: row.current_week,
    status:      row.status,
    health:      row.health,
    createdAt:   row.created_at,
  }
}

function taskToDb(t) {
  return {
    id:             t.id,
    name:           t.name,
    phase:          t.phase,
    start_week:     t.startWeek,
    duration_weeks: t.durationWeeks,
    resources:      t.resources,
    segments:       t.segments,
    notes:          t.notes,
  }
}

function dbToTask(row) {
  return {
    id:            row.id,
    name:          row.name,
    phase:         row.phase,
    startWeek:     row.start_week,
    durationWeeks: row.duration_weeks,
    resources:     row.resources ?? [],
    segments:      row.segments ?? '',
    notes:         row.notes ?? '',
  }
}

function permitToDb(p) {
  return {
    id:             p.id,
    type:           p.type,
    segment:        p.segment,
    submitted_week: p.submittedWeek,
    approved_week:  p.approvedWeek ?? null,
    status:         p.status,
    authority:      p.authority,
    notes:          p.notes,
  }
}

function dbToPermit(row) {
  return {
    id:            row.id,
    type:          row.type,
    segment:       row.segment,
    submittedWeek: row.submitted_week,
    approvedWeek:  row.approved_week,
    status:        row.status,
    authority:     row.authority,
    notes:         row.notes ?? '',
  }
}
