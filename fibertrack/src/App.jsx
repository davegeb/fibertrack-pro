import { useState, useEffect, useMemo } from 'react'
import {
  fetchProjects, upsertProject, deleteProject as apiDeleteProject,
  fetchTasks, upsertTask, deleteTask as apiDeleteTask,
  fetchPermits, upsertPermit, deletePermit as apiDeletePermit,
} from './api'

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = [
  'Survey & Design', 'Permitting', 'Mobilization', 'Civil / Trenching',
  'Conduit Installation', 'Fiber Pulling', 'Splicing & Testing', 'Closeout',
]
const PHASE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
]
const RESOURCES = [
  { id: 'r1', name: 'Survey Crew A',        type: 'Crew',      capacity: 4 },
  { id: 'r2', name: 'Permitting Specialist', type: 'Staff',     capacity: 1 },
  { id: 'r3', name: 'Trenching Crew B',      type: 'Crew',      capacity: 6 },
  { id: 'r4', name: 'Conduit Crew C',        type: 'Crew',      capacity: 5 },
  { id: 'r5', name: 'Fiber Splicing Crew D', type: 'Crew',      capacity: 3 },
  { id: 'r6', name: 'Project Manager',       type: 'Staff',     capacity: 1 },
  { id: 'r7', name: 'Backhoe #1',            type: 'Equipment', capacity: 1 },
  { id: 'r8', name: 'Cable Puller #2',       type: 'Equipment', capacity: 1 },
]
const PERMIT_TYPES = [
  'ROW Permit', 'Traffic Control', 'Environmental',
  'Building Access', 'Utility Crossing', 'Municipal Approval',
]

const WEEK_WIDTH  = 32
const phaseColorMap = Object.fromEntries(PHASES.map((p, i) => [p, PHASE_COLORS[i]]))

const TEMPLATE_TASKS = [
  { name: 'Route Survey & As-builts',     phase: 'Survey & Design',      startWeek: 1,  durationWeeks: 3, resources: ['r1','r6'], segments: 'All' },
  { name: 'Engineering & Design',          phase: 'Survey & Design',      startWeek: 2,  durationWeeks: 4, resources: ['r6'],      segments: 'All' },
  { name: 'ROW & Municipal Permits',       phase: 'Permitting',           startWeek: 4,  durationWeeks: 6, resources: ['r2','r6'], segments: 'All' },
  { name: 'Traffic Control Plan',          phase: 'Permitting',           startWeek: 5,  durationWeeks: 2, resources: ['r2'],      segments: 'All' },
  { name: 'Equipment Mobilization',        phase: 'Mobilization',         startWeek: 9,  durationWeeks: 1, resources: ['r7','r8'], segments: 'All' },
  { name: 'Crew Onboarding & Safety',      phase: 'Mobilization',         startWeek: 9,  durationWeeks: 1, resources: ['r6'],      segments: 'All' },
  { name: 'Trenching – Phase 1',           phase: 'Civil / Trenching',    startWeek: 10, durationWeeks: 4, resources: ['r3','r7'], segments: 'Seg 1–2' },
  { name: 'Trenching – Phase 2',           phase: 'Civil / Trenching',    startWeek: 14, durationWeeks: 4, resources: ['r3','r7'], segments: 'Seg 3–4' },
  { name: 'Conduit Install – Phase 1',     phase: 'Conduit Installation', startWeek: 11, durationWeeks: 4, resources: ['r4'],      segments: 'Seg 1–2' },
  { name: 'Conduit Install – Phase 2',     phase: 'Conduit Installation', startWeek: 15, durationWeeks: 4, resources: ['r4'],      segments: 'Seg 3–4' },
  { name: 'Fiber Pull',                    phase: 'Fiber Pulling',        startWeek: 16, durationWeeks: 4, resources: ['r8'],      segments: 'All' },
  { name: 'Splicing & OTDR Testing',       phase: 'Splicing & Testing',   startWeek: 20, durationWeeks: 4, resources: ['r5'],      segments: 'All' },
  { name: 'Documentation & Redlines',      phase: 'Closeout',             startWeek: 23, durationWeeks: 2, resources: ['r6'],      segments: 'All' },
  { name: 'Final Inspection & Acceptance', phase: 'Closeout',             startWeek: 25, durationWeeks: 1, resources: ['r6','r2'], segments: 'All' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return 'id_' + Math.random().toString(36).slice(2, 9) }

const inputCls     = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'
const btnPrimary   = 'px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const btnSecondary = 'px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors'
const btnDanger    = 'px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors'

const healthColors = {
  'On Track': 'bg-emerald-100 text-emerald-800',
  'At Risk':  'bg-amber-100 text-amber-800',
  'Delayed':  'bg-red-100 text-red-800',
}
const healthDot = {
  'On Track': 'bg-emerald-500',
  'At Risk':  'bg-amber-500',
  'Delayed':  'bg-red-500',
}
const statusColors = {
  Approved:    'bg-emerald-100 text-emerald-800',
  Pending:     'bg-amber-100 text-amber-800',
  'In Review': 'bg-blue-100 text-blue-800',
  Denied:      'bg-red-100 text-red-800',
}
const projectStatusColors = {
  Active:    'bg-indigo-100 text-indigo-700',
  Planning:  'bg-gray-100 text-gray-600',
  'On Hold': 'bg-amber-100 text-amber-700',
  Complete:  'bg-emerald-100 text-emerald-700',
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )
}

function Toast({ message, type = 'error', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-3 ${type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
      <span>{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`bg-white rounded-2xl shadow-2xl w-full mx-4 overflow-hidden ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-light leading-none">×</button>
        </div>
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

// ─── Project Modal ────────────────────────────────────────────────────────────

function ProjectModal({ project, onSave, onDelete, onClose, saving }) {
  const isEdit = !!project
  const [useTemplate, setUseTemplate] = useState(!isEdit)
  const [form, setForm] = useState(project || {
    name: '', description: '', location: '',
    startWeek: 1, totalWeeks: 28, currentWeek: 1,
    status: 'Planning', health: 'On Track',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={isEdit ? 'Edit Project' : 'New Project'} onClose={onClose} wide>
      <Field label="Project Name">
        <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Downtown Fiber Backbone" />
      </Field>
      <Field label="Description">
        <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief project scope…" />
      </Field>
      <Field label="Location / Route">
        <input className={inputCls} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Downtown Core – Segments 1–5" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Total Weeks">
          <input type="number" className={inputCls} min={4} max={104} value={form.totalWeeks} onChange={e => set('totalWeeks', +e.target.value)} />
        </Field>
        <Field label="Current Week">
          <input type="number" className={inputCls} min={1} value={form.currentWeek} onChange={e => set('currentWeek', +e.target.value)} />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
            {['Planning', 'Active', 'On Hold', 'Complete'].map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Health">
        <div className="flex gap-2">
          {['On Track', 'At Risk', 'Delayed'].map(h => (
            <button key={h} type="button"
              onClick={() => set('health', h)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${form.health === h ? healthColors[h] + ' border-transparent' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {h}
            </button>
          ))}
        </div>
      </Field>
      {!isEdit && (
        <Field label="Starting Tasks">
          <div className="flex gap-2">
            {[
              { val: true,  label: '📋 Use standard template', sub: '14 pre-built tasks across all phases' },
              { val: false, label: '✏️ Blank project',         sub: 'Add tasks manually from scratch' },
            ].map(opt => (
              <button key={String(opt.val)} type="button"
                onClick={() => setUseTemplate(opt.val)}
                className={`flex-1 p-3 rounded-xl border text-left transition-all ${useTemplate === opt.val ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="text-sm font-semibold text-gray-800">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        </Field>
      )}
      <div className="flex gap-2 pt-2">
        <button className={btnPrimary} disabled={saving || !form.name}
          onClick={() => onSave({ ...form, id: form.id || uid() }, useTemplate)}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
        </button>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        {isEdit && <button className={`${btnDanger} ml-auto`} disabled={saving} onClick={() => onDelete(project.id)}>Delete Project</button>}
      </div>
    </Modal>
  )
}

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ task, onSave, onDelete, onClose, saving }) {
  const [form, setForm] = useState(task || {
    name: '', phase: PHASES[0], startWeek: 1, durationWeeks: 2, resources: [], segments: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleRes = id => set('resources', form.resources.includes(id) ? form.resources.filter(r => r !== id) : [...form.resources, id])

  return (
    <Modal title={task ? 'Edit Task' : 'Add Task'} onClose={onClose}>
      <Field label="Task Name">
        <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Conduit Install – Seg 3" />
      </Field>
      <Field label="Phase">
        <select className={inputCls} value={form.phase} onChange={e => set('phase', e.target.value)}>
          {PHASES.map(p => <option key={p}>{p}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Week"><input type="number" className={inputCls} min={1} value={form.startWeek} onChange={e => set('startWeek', +e.target.value)} /></Field>
        <Field label="Duration (weeks)"><input type="number" className={inputCls} min={1} value={form.durationWeeks} onChange={e => set('durationWeeks', +e.target.value)} /></Field>
      </div>
      <Field label="Segment(s)">
        <input className={inputCls} value={form.segments} onChange={e => set('segments', e.target.value)} placeholder="e.g. Seg 1–3 or All" />
      </Field>
      <Field label="Assigned Resources">
        <div className="grid grid-cols-2 gap-1 mt-1">
          {RESOURCES.map(r => (
            <label key={r.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border text-xs transition-colors ${form.resources.includes(r.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="checkbox" className="accent-indigo-600" checked={form.resources.includes(r.id)} onChange={() => toggleRes(r.id)} />
              {r.name}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-2">
        <button className={btnPrimary} disabled={saving || !form.name} onClick={() => onSave({ ...form, id: form.id || uid() })}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        {task && <button className={`${btnDanger} ml-auto`} disabled={saving} onClick={() => onDelete(task.id)}>Delete</button>}
      </div>
    </Modal>
  )
}

// ─── Permit Modal ─────────────────────────────────────────────────────────────

function PermitModal({ permit, onSave, onDelete, onClose, saving }) {
  const [form, setForm] = useState(permit || {
    type: PERMIT_TYPES[0], segment: '', submittedWeek: 1, approvedWeek: null, status: 'Pending', authority: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={permit ? 'Edit Permit' : 'Add Permit'} onClose={onClose}>
      <Field label="Permit Type">
        <select className={inputCls} value={form.type} onChange={e => set('type', e.target.value)}>
          {PERMIT_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <Field label="Authority / Agency">
        <input className={inputCls} value={form.authority} onChange={e => set('authority', e.target.value)} placeholder="e.g. City DOT" />
      </Field>
      <Field label="Segment(s)">
        <input className={inputCls} value={form.segment} onChange={e => set('segment', e.target.value)} placeholder="e.g. Seg 1–3" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Submitted (Week)"><input type="number" className={inputCls} min={1} value={form.submittedWeek} onChange={e => set('submittedWeek', +e.target.value)} /></Field>
        <Field label="Approved (Week)"><input type="number" className={inputCls} min={1} value={form.approvedWeek ?? ''} onChange={e => set('approvedWeek', e.target.value === '' ? null : +e.target.value)} placeholder="Pending…" /></Field>
      </div>
      <Field label="Status">
        <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
          {['Pending', 'In Review', 'Approved', 'Denied'].map(s => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Notes">
        <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
      </Field>
      <div className="flex gap-2 pt-2">
        <button className={btnPrimary} disabled={saving} onClick={() => onSave({ ...form, id: form.id || uid() })}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className={btnSecondary} onClick={onClose}>Cancel</button>
        {permit && <button className={`${btnDanger} ml-auto`} disabled={saving} onClick={() => onDelete(permit.id)}>Delete</button>}
      </div>
    </Modal>
  )
}

// ─── Portfolio Dashboard ──────────────────────────────────────────────────────

function PortfolioCard({ project, tasks, permits, onClick }) {
  const total     = tasks.length
  const completed = tasks.filter(t => t.startWeek + t.durationWeeks - 1 < project.currentWeek).length
  const pct       = total ? Math.round((completed / total) * 100) : 0
  const blockers  = permits.filter(p => p.status !== 'Approved').length
  const active    = tasks.filter(t => t.startWeek <= project.currentWeek && t.startWeek + t.durationWeeks - 1 >= project.currentWeek).length
  const endWeek   = total ? Math.max(...tasks.map(t => t.startWeek + t.durationWeeks - 1)) : project.totalWeeks

  const phaseProgress = PHASES.map(phase => {
    const pt   = tasks.filter(t => t.phase === phase)
    if (!pt.length) return null
    const done = pt.filter(t => t.startWeek + t.durationWeeks - 1 < project.currentWeek).length
    return { phase, color: phaseColorMap[phase], pct: Math.round((done / pt.length) * 100) }
  }).filter(Boolean)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer overflow-hidden" onClick={() => onClick(project)}>
      {/* Card header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-bold text-gray-900 text-base leading-tight">{project.name}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${projectStatusColors[project.status]}`}>{project.status}</span>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${healthColors[project.health]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${healthDot[project.health]}`} />
              {project.health}
            </span>
          </div>
        </div>
        {project.location && <p className="text-xs text-gray-500 flex items-center gap-1">📍 {project.location}</p>}
        {project.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{project.description}</p>}
      </div>

      {/* Progress bar */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-gray-600">Overall Progress</span>
          <span className="text-xs font-bold text-indigo-600">{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
          <span>Week {project.currentWeek} of {endWeek}</span>
          <span>{completed}/{total} tasks complete</span>
        </div>
      </div>

      {/* Phase mini-bars */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="grid grid-cols-4 gap-1.5">
          {phaseProgress.map(({ phase, color, pct: pp }) => (
            <div key={phase} title={`${phase}: ${pp}%`}>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-0.5">
                <div className="h-1.5 rounded-full transition-all" style={{ width: `${pp}%`, backgroundColor: color }} />
              </div>
              <div className="text-xs text-gray-400 truncate" style={{ fontSize: 9 }}>{phase.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 py-3 grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{active}</div>
          <div className="text-xs text-gray-400">Active tasks</div>
        </div>
        <div className="text-center border-x border-gray-100">
          <div className={`text-lg font-bold ${blockers > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{blockers}</div>
          <div className="text-xs text-gray-400">Permit blockers</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{endWeek}</div>
          <div className="text-xs text-gray-400">Total weeks</div>
        </div>
      </div>
    </div>
  )
}

function PortfolioDashboard({ projects, allTasks, allPermits, onOpenProject, onNewProject, loading }) {
  const activeProjects  = projects.filter(p => p.status === 'Active').length
  const atRisk          = projects.filter(p => p.health === 'At Risk' || p.health === 'Delayed').length
  const totalBlockers   = allPermits.filter(p => p.status !== 'Approved').length
  const overallPct      = projects.length ? Math.round(
    projects.reduce((sum, proj) => {
      const pt   = allTasks.filter(t => t.projectId === proj.id)
      const done = pt.filter(t => t.startWeek + t.durationWeeks - 1 < proj.currentWeek).length
      return sum + (pt.length ? done / pt.length : 0)
    }, 0) / projects.length * 100
  ) : 0

  return (
    <div className="space-y-6">
      {/* Portfolio KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Projects',    value: projects.length, sub: `${activeProjects} active`,               color: 'indigo' },
          { label: 'Portfolio Progress',value: `${overallPct}%`, sub: 'avg across all projects',               color: 'blue' },
          { label: 'Projects At Risk',  value: atRisk,           sub: `${projects.length - atRisk} on track`,  color: atRisk > 0 ? 'amber' : 'emerald' },
          { label: 'Permit Blockers',   value: totalBlockers,    sub: 'across all projects',                   color: totalBlockers > 0 ? 'red' : 'emerald' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Project cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">Projects</h2>
          <button className={btnPrimary} onClick={onNewProject}>+ New Project</button>
        </div>
        {loading ? <Spinner /> : projects.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <div className="text-4xl mb-3">🔌</div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No projects yet</h3>
            <p className="text-sm text-gray-400 mb-4">Create your first fiber conduit project to get started.</p>
            <button className={btnPrimary} onClick={onNewProject}>+ New Project</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(proj => (
              <PortfolioCard
                key={proj.id}
                project={proj}
                tasks={allTasks.filter(t => t.projectId === proj.id)}
                permits={allPermits.filter(p => p.projectId === proj.id)}
                onClick={onOpenProject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Gantt Chart ──────────────────────────────────────────────────────────────

function GanttChart({ tasks, onTaskClick, currentWeek, totalWeeks }) {
  const LABEL_W = 260
  const weeks   = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const grouped = PHASES.map(phase => ({
    phase, color: phaseColorMap[phase],
    tasks: tasks.filter(t => t.phase === phase),
  })).filter(g => g.tasks.length > 0)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ minWidth: LABEL_W + totalWeeks * WEEK_WIDTH }}>
        <div style={{ minWidth: LABEL_W, width: LABEL_W }} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200 flex items-center">Task</div>
        <div className="flex">
          {weeks.map(w => (
            <div key={w} style={{ width: WEEK_WIDTH, minWidth: WEEK_WIDTH }}
              className={`text-center text-xs py-2 font-medium border-r border-gray-100 ${w === currentWeek ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>{w}</div>
          ))}
        </div>
      </div>
      {grouped.map(({ phase, color, tasks: pTasks }) => (
        <div key={phase}>
          <div className="flex items-center border-b border-gray-100" style={{ minWidth: LABEL_W + totalWeeks * WEEK_WIDTH, backgroundColor: color + '18' }}>
            <div style={{ minWidth: LABEL_W, width: LABEL_W }} className="px-4 py-1.5 flex items-center gap-2 border-r border-gray-200">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{phase}</span>
            </div>
            <div style={{ width: totalWeeks * WEEK_WIDTH }} />
          </div>
          {pTasks.map(task => {
            const left  = (task.startWeek - 1) * WEEK_WIDTH
            const width = task.durationWeeks * WEEK_WIDTH
            const resoNames = task.resources.map(rid => RESOURCES.find(r => r.id === rid)?.name).filter(Boolean).join(', ')
            return (
              <div key={task.id} className="flex items-center border-b border-gray-100 hover:bg-gray-50 group" style={{ minWidth: LABEL_W + totalWeeks * WEEK_WIDTH, height: 40 }}>
                <div style={{ minWidth: LABEL_W, width: LABEL_W }} className="px-4 flex items-center border-r border-gray-200 h-full min-w-0">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{task.name}</div>
                    {task.segments && <div className="text-xs text-gray-400 truncate">{task.segments}</div>}
                  </div>
                </div>
                <div className="relative" style={{ width: totalWeeks * WEEK_WIDTH, height: 40 }}>
                  {weeks.map(w => (
                    <div key={w} className={`absolute top-0 h-full border-r ${w === currentWeek ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100'}`}
                      style={{ left: (w - 1) * WEEK_WIDTH, width: WEEK_WIDTH }} />
                  ))}
                  <div
                    className="absolute top-2 rounded cursor-pointer shadow-sm flex items-center px-2 text-white text-xs font-medium overflow-hidden hover:brightness-90"
                    style={{ left, width: Math.max(width - 4, 4), height: 24, backgroundColor: color }}
                    title={`${task.name}\nWeek ${task.startWeek}–${task.startWeek + task.durationWeeks - 1}\n${resoNames}`}
                    onClick={() => onTaskClick(task)}
                  >
                    {width > 60 ? task.name : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Resource Panel ───────────────────────────────────────────────────────────

function ResourcePanel({ tasks, totalWeeks }) {
  const weeks = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const util  = RESOURCES.map(res => ({
    ...res,
    weekLoad: weeks.map(w => {
      const active = tasks.filter(t => t.resources.includes(res.id) && w >= t.startWeek && w < t.startWeek + t.durationWeeks)
      return { count: active.length, tasks: active.map(t => t.name) }
    }),
  }))

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ minWidth: 220 + totalWeeks * WEEK_WIDTH }}>
        <div style={{ minWidth: 220, width: 220 }} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Resource</div>
        <div className="flex">{weeks.map(w => <div key={w} style={{ width: WEEK_WIDTH, minWidth: WEEK_WIDTH }} className="text-center text-xs py-2 font-medium text-gray-400 border-r border-gray-100">{w}</div>)}</div>
      </div>
      {util.map(res => (
        <div key={res.id} className="flex items-center border-b border-gray-100 hover:bg-gray-50" style={{ height: 38 }}>
          <div style={{ minWidth: 220, width: 220 }} className="px-4 flex items-center gap-2 border-r border-gray-200 h-full">
            <div>
              <div className="text-xs font-medium text-gray-800">{res.name}</div>
              <div className="text-xs text-gray-400">{res.type}</div>
            </div>
          </div>
          <div className="flex" style={{ minWidth: totalWeeks * WEEK_WIDTH }}>
            {res.weekLoad.map((load, i) => (
              <div key={i} style={{ width: WEEK_WIDTH, minWidth: WEEK_WIDTH }} className="border-r border-gray-100 h-full flex items-center justify-center" title={load.tasks.join('\n') || 'Available'}>
                {load.count > 0 && <span className={`text-xs font-bold rounded px-1 ${load.count > res.capacity ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>{load.count}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Permits Panel ────────────────────────────────────────────────────────────

function PermitsPanel({ permits, onAdd, onEdit }) {
  const summary = { Approved: 0, 'In Review': 0, Pending: 0, Denied: 0 }
  permits.forEach(p => { if (summary[p.status] !== undefined) summary[p.status]++ })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(summary).map(([label, count]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gray-800">{count}</div>
            <span className={`text-xs font-medium mt-1 px-2 py-0.5 rounded-full inline-block ${statusColors[label] || 'bg-gray-100 text-gray-600'}`}>{label}</span>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 text-sm">Permit Log</h3>
          <button className={btnPrimary} onClick={onAdd}>+ Add Permit</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <tr>{['Type','Authority','Segment','Submitted','Approved','Status',''].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {permits.map(p => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{p.type}</td>
                <td className="px-4 py-2.5 text-gray-600">{p.authority}</td>
                <td className="px-4 py-2.5 text-gray-500">{p.segment}</td>
                <td className="px-4 py-2.5 text-gray-500">Wk {p.submittedWeek}</td>
                <td className="px-4 py-2.5 text-gray-500">{p.approvedWeek ? `Wk ${p.approvedWeek}` : <span className="italic text-gray-300">—</span>}</td>
                <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[p.status] || 'bg-gray-100 text-gray-500'}`}>{p.status}</span></td>
                <td className="px-4 py-2.5"><button className="text-xs text-indigo-600 hover:underline" onClick={() => onEdit(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Project Overview ─────────────────────────────────────────────────────────

function ProjectOverview({ project, tasks, permits }) {
  const cw         = project.currentWeek
  const total      = tasks.length
  const completed  = tasks.filter(t => t.startWeek + t.durationWeeks - 1 < cw).length
  const active     = tasks.filter(t => t.startWeek <= cw && t.startWeek + t.durationWeeks - 1 >= cw).length
  const endWeek    = total ? Math.max(...tasks.map(t => t.startWeek + t.durationWeeks - 1)) : project.totalWeeks
  const pct        = total ? Math.round((completed / total) * 100) : 0
  const blockers   = permits.filter(p => p.status !== 'Approved').length

  const phaseProgress = PHASES.map(phase => {
    const pt   = tasks.filter(t => t.phase === phase)
    if (!pt.length) return null
    const done = pt.filter(t => t.startWeek + t.durationWeeks - 1 < cw).length
    return { phase, color: phaseColorMap[phase], pct: Math.round((done / pt.length) * 100), total: pt.length, done }
  }).filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Progress',        value: `${pct}%`,     sub: `${completed} of ${total} tasks`,              color: 'indigo' },
          { label: 'Active Tasks',    value: active,        sub: `Week ${cw} of ${endWeek}`,                    color: 'blue' },
          { label: 'Total Duration',  value: `${endWeek}w`, sub: `~${Math.ceil(endWeek / 4.33)} months`,        color: 'violet' },
          { label: 'Permit Blockers', value: blockers,      sub: `${permits.filter(p => p.status === 'Approved').length}/${permits.length} approved`, color: blockers > 0 ? 'amber' : 'emerald' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-3xl font-bold text-${color}-600`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-4">Phase Progress</h3>
        <div className="space-y-3">
          {phaseProgress.map(({ phase, color, pct: pp, total: tot, done }) => (
            <div key={phase}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-gray-700">{phase}</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">{done}/{tot} · {pp}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pp}%`, backgroundColor: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">Upcoming Tasks (Next 4 Weeks)</h3>
        <div className="space-y-2">
          {tasks.filter(t => t.startWeek > cw && t.startWeek <= cw + 4).sort((a, b) => a.startWeek - b.startWeek).map(t => (
            <div key={t.id} className="flex items-center gap-3 text-sm">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phaseColorMap[t.phase] }} />
              <span className="text-gray-700 flex-1">{t.name}</span>
              <span className="text-xs text-gray-400 font-medium">Wk {t.startWeek}</span>
            </div>
          ))}
          {!tasks.filter(t => t.startWeek > cw && t.startWeek <= cw + 4).length && (
            <p className="text-sm text-gray-400 italic">No tasks starting in the next 4 weeks.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Project View (single project) ───────────────────────────────────────────

const PROJECT_TABS = ['Overview', 'Gantt Chart', 'Resources', 'Permits']

function ProjectView({ project, tasks, permits, onBack, onEditProject, onSaveTask, onDeleteTask, onSavePermit, onDeletePermit, onUpdateProject, saving }) {
  const [activeTab,   setActiveTab]   = useState('Overview')
  const [taskModal,   setTaskModal]   = useState(null)
  const [permitModal, setPermitModal] = useState(null)
  const [filterPhase, setFilterPhase] = useState('All')
  const [search,      setSearch]      = useState('')

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const mp = filterPhase === 'All' || t.phase === filterPhase
    const ms = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.segments.toLowerCase().includes(search.toLowerCase())
    return mp && ms
  }), [tasks, filterPhase, search])

  return (
    <div>
      {/* Project sub-header */}
      <div className="bg-white border-b border-gray-200 mb-6 -mx-6 px-6 py-3">
        <div className="max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors font-medium">
              ← All Projects
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-800">{project.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthColors[project.health]}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${healthDot[project.health]}`} />
              {project.health}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {/* Current week control */}
              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                Week:
                <input type="number" min={1} max={project.totalWeeks} value={project.currentWeek}
                  onChange={e => onUpdateProject({ ...project, currentWeek: +e.target.value })}
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-center font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </label>
              <button className={btnSecondary} onClick={onEditProject} style={{ padding: '6px 12px', fontSize: 12 }}>⚙ Edit Project</button>
              {activeTab === 'Gantt Chart' && <button className={btnPrimary} onClick={() => setTaskModal('new')} style={{ padding: '6px 12px', fontSize: 12 }}>+ Add Task</button>}
              {(activeTab === 'Gantt Chart' || activeTab === 'Resources') && (
                <>
                  <input className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 w-36"
                    placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
                  <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none" value={filterPhase} onChange={e => setFilterPhase(e.target.value)}>
                    <option>All</option>
                    {PHASES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {PROJECT_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'Overview'     && <ProjectOverview project={project} tasks={tasks} permits={permits} />}
      {activeTab === 'Gantt Chart'  && <GanttChart tasks={filteredTasks} currentWeek={project.currentWeek} totalWeeks={project.totalWeeks} onTaskClick={t => setTaskModal(t)} />}
      {activeTab === 'Resources'    && <ResourcePanel tasks={filteredTasks} totalWeeks={project.totalWeeks} />}
      {activeTab === 'Permits'      && <PermitsPanel permits={permits} onAdd={() => setPermitModal('new')} onEdit={p => setPermitModal(p)} />}

      {/* Modals */}
      {taskModal && <TaskModal task={taskModal === 'new' ? null : taskModal} saving={saving} onSave={onSaveTask} onDelete={onDeleteTask} onClose={() => setTaskModal(null)} />}
      {permitModal && <PermitModal permit={permitModal === 'new' ? null : permitModal} saving={saving} onSave={onSavePermit} onDelete={onDeletePermit} onClose={() => setPermitModal(null)} />}
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [projects,       setProjects]       = useState([])
  const [allTasks,       setAllTasks]       = useState([])   // { ...task, projectId }
  const [allPermits,     setAllPermits]     = useState([])
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [toast,          setToast]          = useState(null)
  const [activeProject,  setActiveProject]  = useState(null)
  const [projectModal,   setProjectModal]   = useState(null)

  const showToast = (message, type = 'success') => setToast({ message, type })

  // Load all projects + their tasks/permits
  useEffect(() => {
    fetchProjects()
      .then(async projs => {
        setProjects(projs)
        const taskArrays   = await Promise.all(projs.map(p => fetchTasks(p.id)))
        const permitArrays = await Promise.all(projs.map(p => fetchPermits(p.id)))
        setAllTasks(taskArrays.flatMap((tasks, i) => tasks.map(t => ({ ...t, projectId: projs[i].id }))))
        setAllPermits(permitArrays.flatMap((permits, i) => permits.map(p => ({ ...p, projectId: projs[i].id }))))
      })
      .catch(err => showToast('Failed to load: ' + err.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  // ── Project actions ──────────────────────────────────────────────────────────

  const handleSaveProject = async (project, useTemplate) => {
    setSaving(true)
    try {
      const saved = await upsertProject(project)
      const isNew = !projects.find(p => p.id === saved.id)
      setProjects(ps => isNew ? [saved, ...ps] : ps.map(p => p.id === saved.id ? saved : p))

      // Seed template tasks for new projects
      if (isNew && useTemplate) {
        const templateTasks = TEMPLATE_TASKS.map(t => ({ ...t, id: uid(), notes: '' }))
        const savedTasks = await Promise.all(templateTasks.map(t => upsertTask(t, saved.id)))
        setAllTasks(ts => [...ts, ...savedTasks.map(t => ({ ...t, projectId: saved.id }))])
      }

      setProjectModal(null)
      if (isNew) setActiveProject(saved)
      showToast(isNew ? 'Project created!' : 'Project updated.')
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDeleteProject = async (id) => {
    setSaving(true)
    try {
      await apiDeleteProject(id)
      setProjects(ps => ps.filter(p => p.id !== id))
      setAllTasks(ts => ts.filter(t => t.projectId !== id))
      setAllPermits(ps => ps.filter(p => p.projectId !== id))
      setProjectModal(null)
      setActiveProject(null)
      showToast('Project deleted.')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleUpdateProject = async (updated) => {
    try {
      const saved = await upsertProject(updated)
      setProjects(ps => ps.map(p => p.id === saved.id ? saved : p))
      setActiveProject(saved)
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    }
  }

  // ── Task actions ─────────────────────────────────────────────────────────────

  const handleSaveTask = async (task) => {
    if (!activeProject) return
    setSaving(true)
    try {
      const saved = await upsertTask(task, activeProject.id)
      setAllTasks(ts => {
        const exists = ts.find(t => t.id === saved.id)
        return exists
          ? ts.map(t => t.id === saved.id ? { ...saved, projectId: activeProject.id } : t)
          : [...ts, { ...saved, projectId: activeProject.id }]
      })
      showToast('Task saved.')
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDeleteTask = async (id) => {
    setSaving(true)
    try {
      await apiDeleteTask(id)
      setAllTasks(ts => ts.filter(t => t.id !== id))
      showToast('Task deleted.')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  // ── Permit actions ───────────────────────────────────────────────────────────

  const handleSavePermit = async (permit) => {
    if (!activeProject) return
    setSaving(true)
    try {
      const saved = await upsertPermit(permit, activeProject.id)
      setAllPermits(ps => {
        const exists = ps.find(p => p.id === saved.id)
        return exists
          ? ps.map(p => p.id === saved.id ? { ...saved, projectId: activeProject.id } : p)
          : [...ps, { ...saved, projectId: activeProject.id }]
      })
      showToast('Permit saved.')
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDeletePermit = async (id) => {
    setSaving(true)
    try {
      await apiDeletePermit(id)
      setAllPermits(ps => ps.filter(p => p.id !== id))
      showToast('Permit deleted.')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const currentTasks   = activeProject ? allTasks.filter(t => t.projectId === activeProject.id)   : []
  const currentPermits = activeProject ? allPermits.filter(p => p.projectId === activeProject.id) : []

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Global header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-3">
          <button onClick={() => setActiveProject(null)} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">F</div>
            <div>
              <div className="text-sm font-bold text-gray-800 leading-tight">FiberTrack Pro</div>
              <div className="text-xs text-gray-400">Conduit &amp; Fiber Project Scheduler</div>
            </div>
          </button>
          {!activeProject && (
            <div className="ml-auto">
              <button className={btnPrimary} onClick={() => setProjectModal('new')}>+ New Project</button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {loading ? <Spinner /> : activeProject ? (
          <ProjectView
            project={activeProject}
            tasks={currentTasks}
            permits={currentPermits}
            saving={saving}
            onBack={() => setActiveProject(null)}
            onEditProject={() => setProjectModal(activeProject)}
            onSaveTask={handleSaveTask}
            onDeleteTask={handleDeleteTask}
            onSavePermit={handleSavePermit}
            onDeletePermit={handleDeletePermit}
            onUpdateProject={handleUpdateProject}
          />
        ) : (
          <PortfolioDashboard
            projects={projects}
            allTasks={allTasks}
            allPermits={allPermits}
            onOpenProject={p => setActiveProject(p)}
            onNewProject={() => setProjectModal('new')}
            loading={false}
          />
        )}
      </main>

      {/* Project modal */}
      {projectModal && (
        <ProjectModal
          project={projectModal === 'new' ? null : projectModal}
          saving={saving}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
          onClose={() => setProjectModal(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
