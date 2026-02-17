import { useState, useEffect, useMemo } from 'react'
import {
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
  { id: 'r1', name: 'Survey Crew A',         type: 'Crew',      capacity: 4 },
  { id: 'r2', name: 'Permitting Specialist',  type: 'Staff',     capacity: 1 },
  { id: 'r3', name: 'Trenching Crew B',       type: 'Crew',      capacity: 6 },
  { id: 'r4', name: 'Conduit Crew C',         type: 'Crew',      capacity: 5 },
  { id: 'r5', name: 'Fiber Splicing Crew D',  type: 'Crew',      capacity: 3 },
  { id: 'r6', name: 'Project Manager',        type: 'Staff',     capacity: 1 },
  { id: 'r7', name: 'Backhoe #1',             type: 'Equipment', capacity: 1 },
  { id: 'r8', name: 'Cable Puller #2',        type: 'Equipment', capacity: 1 },
]
const PERMIT_TYPES = [
  'ROW Permit', 'Traffic Control', 'Environmental',
  'Building Access', 'Utility Crossing', 'Municipal Approval',
]
const TOTAL_WEEKS = 28
const WEEK_WIDTH  = 32
const phaseColorMap = Object.fromEntries(PHASES.map((p, i) => [p, PHASE_COLORS[i]]))

function uid() { return 'id_' + Math.random().toString(36).slice(2, 9) }

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const inputCls     = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400'
const btnPrimary   = 'px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const btnSecondary = 'px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors'
const btnDanger    = 'px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors'

const statusColors = {
  Approved:  'bg-emerald-100 text-emerald-800',
  Pending:   'bg-amber-100 text-amber-800',
  'In Review': 'bg-blue-100 text-blue-800',
  Denied:    'bg-red-100 text-red-800',
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
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

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-light leading-none">×</button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">{children}</div>
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

// ─── Task Modal ───────────────────────────────────────────────────────────────

function TaskModal({ task, onSave, onDelete, onClose, saving }) {
  const [form, setForm] = useState(task || {
    name: '', phase: PHASES[0], startWeek: 1, durationWeeks: 2, resources: [], segments: '', notes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleRes = id => set('resources', form.resources.includes(id)
    ? form.resources.filter(r => r !== id)
    : [...form.resources, id])

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
        <Field label="Start Week">
          <input type="number" className={inputCls} min={1} max={TOTAL_WEEKS} value={form.startWeek} onChange={e => set('startWeek', +e.target.value)} />
        </Field>
        <Field label="Duration (weeks)">
          <input type="number" className={inputCls} min={1} max={TOTAL_WEEKS} value={form.durationWeeks} onChange={e => set('durationWeeks', +e.target.value)} />
        </Field>
      </div>
      <Field label="Segment(s)">
        <input className={inputCls} value={form.segments} onChange={e => set('segments', e.target.value)} placeholder="e.g. Seg 1–3 or All" />
      </Field>
      <Field label="Assigned Resources">
        <div className="grid grid-cols-2 gap-1 mt-1">
          {RESOURCES.map(r => (
            <label key={r.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border text-xs transition-colors ${form.resources.includes(r.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="checkbox" className="accent-indigo-600" checked={form.resources.includes(r.id)} onChange={() => toggleRes(r.id)} />
              <span>{r.name}</span>
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
        <Field label="Submitted (Week)">
          <input type="number" className={inputCls} min={1} value={form.submittedWeek} onChange={e => set('submittedWeek', +e.target.value)} />
        </Field>
        <Field label="Approved (Week)">
          <input type="number" className={inputCls} min={1} value={form.approvedWeek ?? ''} onChange={e => set('approvedWeek', e.target.value === '' ? null : +e.target.value)} placeholder="Pending…" />
        </Field>
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

// ─── Gantt Chart ──────────────────────────────────────────────────────────────

function GanttChart({ tasks, onTaskClick, currentWeek }) {
  const grouped = PHASES.map(phase => ({
    phase, color: phaseColorMap[phase],
    tasks: tasks.filter(t => t.phase === phase),
  })).filter(g => g.tasks.length > 0)

  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)
  const LABEL_W = 260

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ minWidth: LABEL_W + TOTAL_WEEKS * WEEK_WIDTH }}>
        <div style={{ minWidth: LABEL_W, width: LABEL_W }} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200 flex items-center">Task</div>
        <div className="flex">
          {weeks.map(w => (
            <div key={w} style={{ width: WEEK_WIDTH, minWidth: WEEK_WIDTH }} className={`text-center text-xs py-2 font-medium border-r border-gray-100 ${w === currentWeek ? 'bg-indigo-100 text-indigo-700' : 'text-gray-400'}`}>{w}</div>
          ))}
        </div>
      </div>
      {/* Phase groups */}
      {grouped.map(({ phase, color, tasks: pTasks }) => (
        <div key={phase}>
          <div className="flex items-center border-b border-gray-100" style={{ minWidth: LABEL_W + TOTAL_WEEKS * WEEK_WIDTH, backgroundColor: color + '18' }}>
            <div style={{ minWidth: LABEL_W, width: LABEL_W }} className="px-4 py-1.5 flex items-center gap-2 border-r border-gray-200">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{phase}</span>
            </div>
            <div style={{ width: TOTAL_WEEKS * WEEK_WIDTH }} />
          </div>
          {pTasks.map(task => {
            const left  = (task.startWeek - 1) * WEEK_WIDTH
            const width = task.durationWeeks * WEEK_WIDTH
            const resourceNames = task.resources.map(rid => RESOURCES.find(r => r.id === rid)?.name).filter(Boolean).join(', ')
            return (
              <div key={task.id} className="flex items-center border-b border-gray-100 hover:bg-gray-50 group" style={{ minWidth: LABEL_W + TOTAL_WEEKS * WEEK_WIDTH, height: 40 }}>
                <div style={{ minWidth: LABEL_W, width: LABEL_W }} className="px-4 flex items-center gap-2 border-r border-gray-200 h-full">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{task.name}</div>
                    {task.segments && <div className="text-xs text-gray-400 truncate">{task.segments}</div>}
                  </div>
                </div>
                <div className="relative" style={{ width: TOTAL_WEEKS * WEEK_WIDTH, height: 40 }}>
                  {weeks.map(w => (
                    <div key={w} className={`absolute top-0 h-full border-r ${w === currentWeek ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100'}`} style={{ left: (w - 1) * WEEK_WIDTH, width: WEEK_WIDTH }} />
                  ))}
                  <div
                    className="absolute top-2 rounded cursor-pointer shadow-sm flex items-center px-2 text-white text-xs font-medium overflow-hidden hover:brightness-90"
                    style={{ left, width: Math.max(width - 4, 4), height: 24, backgroundColor: color }}
                    title={`${task.name}\nWeek ${task.startWeek}–${task.startWeek + task.durationWeeks - 1}\n${resourceNames}`}
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

function ResourcePanel({ tasks }) {
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1)
  const utilization = RESOURCES.map(res => ({
    ...res,
    weekLoad: weeks.map(w => {
      const active = tasks.filter(t => t.resources.includes(res.id) && w >= t.startWeek && w < t.startWeek + t.durationWeeks)
      return { count: active.length, tasks: active.map(t => t.name) }
    }),
  }))

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex sticky top-0 z-10 bg-gray-50 border-b border-gray-200" style={{ minWidth: 220 + TOTAL_WEEKS * WEEK_WIDTH }}>
        <div style={{ minWidth: 220, width: 220 }} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200">Resource</div>
        <div className="flex">
          {weeks.map(w => (
            <div key={w} style={{ width: WEEK_WIDTH, minWidth: WEEK_WIDTH }} className="text-center text-xs py-2 font-medium text-gray-400 border-r border-gray-100">{w}</div>
          ))}
        </div>
      </div>
      {utilization.map(res => (
        <div key={res.id} className="flex items-center border-b border-gray-100 hover:bg-gray-50" style={{ height: 38 }}>
          <div style={{ minWidth: 220, width: 220 }} className="px-4 flex items-center gap-2 border-r border-gray-200 h-full">
            <div>
              <div className="text-xs font-medium text-gray-800">{res.name}</div>
              <div className="text-xs text-gray-400">{res.type}</div>
            </div>
          </div>
          <div className="flex" style={{ minWidth: TOTAL_WEEKS * WEEK_WIDTH }}>
            {res.weekLoad.map((load, i) => {
              const over   = load.count > res.capacity
              const active = load.count > 0
              return (
                <div key={i} style={{ width: WEEK_WIDTH, minWidth: WEEK_WIDTH }} className="border-r border-gray-100 h-full flex items-center justify-center" title={load.tasks.join('\n') || 'Available'}>
                  {active && (
                    <span className={`text-xs font-bold rounded px-1 ${over ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>{load.count}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="px-4 py-2 text-xs text-gray-400 flex items-center gap-4">
        <span className="flex items-center gap-1"><span className="inline-block w-5 h-5 rounded bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">1</span> Assigned</span>
        <span className="flex items-center gap-1"><span className="inline-block w-5 h-5 rounded bg-red-100 text-red-700 text-xs flex items-center justify-center font-bold">!</span> Over capacity</span>
      </div>
    </div>
  )
}

// ─── Permits Panel ────────────────────────────────────────────────────────────

function PermitsPanel({ permits, onAdd, onEdit }) {
  const summary = {
    Approved:    permits.filter(p => p.status === 'Approved').length,
    'In Review': permits.filter(p => p.status === 'In Review').length,
    Pending:     permits.filter(p => p.status === 'Pending').length,
    Denied:      permits.filter(p => p.status === 'Denied').length,
  }
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
            <tr>{['Type', 'Authority', 'Segment', 'Submitted', 'Approved', 'Status', ''].map(h => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
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

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel({ tasks, permits, currentWeek }) {
  const totalTasks    = tasks.length
  const completedTasks = tasks.filter(t => t.startWeek + t.durationWeeks - 1 < currentWeek).length
  const activeTasks   = tasks.filter(t => t.startWeek <= currentWeek && t.startWeek + t.durationWeeks - 1 >= currentWeek).length
  const endWeek       = tasks.length ? Math.max(...tasks.map(t => t.startWeek + t.durationWeeks - 1)) : TOTAL_WEEKS
  const pctComplete   = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0
  const permitBlockers = permits.filter(p => p.status !== 'Approved').length

  const phaseProgress = PHASES.map(phase => {
    const pt = tasks.filter(t => t.phase === phase)
    if (!pt.length) return null
    const done = pt.filter(t => t.startWeek + t.durationWeeks - 1 < currentWeek).length
    return { phase, color: phaseColorMap[phase], pct: Math.round((done / pt.length) * 100), total: pt.length, done }
  }).filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Project Progress', value: `${pctComplete}%`,   sub: `${completedTasks} of ${totalTasks} tasks complete`, color: 'indigo' },
          { label: 'Active Tasks',     value: activeTasks,          sub: `Week ${currentWeek} of ${endWeek}`,                 color: 'blue' },
          { label: 'Total Duration',   value: `${endWeek} wks`,     sub: `~${Math.ceil(endWeek / 4.33)} months`,              color: 'violet' },
          { label: 'Permit Blockers',  value: permitBlockers,       sub: `${permits.filter(p => p.status === 'Approved').length} of ${permits.length} approved`, color: permitBlockers > 0 ? 'amber' : 'emerald' },
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
          {phaseProgress.map(({ phase, color, pct, total, done }) => (
            <div key={phase}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-gray-700">{phase}</span>
                </div>
                <span className="text-xs text-gray-500 font-medium">{done}/{total} tasks · {pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-700 text-sm mb-3">Upcoming Tasks (Next 4 Weeks)</h3>
        <div className="space-y-2">
          {tasks
            .filter(t => t.startWeek > currentWeek && t.startWeek <= currentWeek + 4)
            .sort((a, b) => a.startWeek - b.startWeek)
            .map(t => (
              <div key={t.id} className="flex items-center gap-3 text-sm">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phaseColorMap[t.phase] }} />
                <span className="text-gray-700 flex-1">{t.name}</span>
                <span className="text-xs text-gray-400 font-medium">Wk {t.startWeek}</span>
              </div>
            ))}
          {!tasks.filter(t => t.startWeek > currentWeek && t.startWeek <= currentWeek + 4).length && (
            <p className="text-sm text-gray-400 italic">No tasks starting in the next 4 weeks.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Gantt Chart', 'Resources', 'Permits & Milestones']

export default function App() {
  const [tasks,       setTasks]       = useState([])
  const [permits,     setPermits]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [activeTab,   setActiveTab]   = useState('Overview')
  const [currentWeek, setCurrentWeek] = useState(10)
  const [taskModal,   setTaskModal]   = useState(null)
  const [permitModal, setPermitModal] = useState(null)
  const [filterPhase, setFilterPhase] = useState('All')
  const [search,      setSearch]      = useState('')

  // Load data on mount
  useEffect(() => {
    Promise.all([fetchTasks(), fetchPermits()])
      .then(([t, p]) => { setTasks(t); setPermits(p) })
      .catch(err => setToast({ message: 'Failed to load data: ' + err.message, type: 'error' }))
      .finally(() => setLoading(false))
  }, [])

  const showToast = (message, type = 'success') => setToast({ message, type })

  // Task actions
  const handleSaveTask = async (task) => {
    setSaving(true)
    try {
      const saved = await upsertTask(task)
      setTasks(ts => ts.find(t => t.id === saved.id) ? ts.map(t => t.id === saved.id ? saved : t) : [...ts, saved])
      setTaskModal(null)
      showToast('Task saved.')
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDeleteTask = async (id) => {
    setSaving(true)
    try {
      await apiDeleteTask(id)
      setTasks(ts => ts.filter(t => t.id !== id))
      setTaskModal(null)
      showToast('Task deleted.')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  // Permit actions
  const handleSavePermit = async (permit) => {
    setSaving(true)
    try {
      const saved = await upsertPermit(permit)
      setPermits(ps => ps.find(p => p.id === saved.id) ? ps.map(p => p.id === saved.id ? saved : p) : [...ps, saved])
      setPermitModal(null)
      showToast('Permit saved.')
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const handleDeletePermit = async (id) => {
    setSaving(true)
    try {
      await apiDeletePermit(id)
      setPermits(ps => ps.filter(p => p.id !== id))
      setPermitModal(null)
      showToast('Permit deleted.')
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error')
    } finally { setSaving(false) }
  }

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const matchPhase  = filterPhase === 'All' || t.phase === filterPhase
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.segments.toLowerCase().includes(search.toLowerCase())
    return matchPhase && matchSearch
  }), [tasks, filterPhase, search])

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">F</div>
            <div>
              <div className="text-sm font-bold text-gray-800 leading-tight">FiberTrack Pro</div>
              <div className="text-xs text-gray-400">Conduit &amp; Fiber Project Scheduler</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <span>Current Week:</span>
              <input type="number" min={1} max={TOTAL_WEEKS} value={currentWeek} onChange={e => setCurrentWeek(+e.target.value)}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-center font-bold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </label>
            {(activeTab === 'Gantt Chart' || activeTab === 'Resources') && (
              <>
                <input className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 w-40"
                  placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
                <select className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={filterPhase} onChange={e => setFilterPhase(e.target.value)}>
                  <option>All</option>
                  {PHASES.map(p => <option key={p}>{p}</option>)}
                </select>
              </>
            )}
            {activeTab === 'Gantt Chart' && (
              <button className={btnPrimary} onClick={() => setTaskModal('new')}>+ Add Task</button>
            )}
          </div>
        </div>
        <div className="max-w-screen-xl mx-auto px-6 flex gap-1">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {loading ? <Spinner /> : (
          <>
            {activeTab === 'Overview'              && <OverviewPanel tasks={tasks} permits={permits} currentWeek={currentWeek} />}
            {activeTab === 'Gantt Chart'           && <GanttChart tasks={filteredTasks} currentWeek={currentWeek} onTaskClick={t => setTaskModal(t)} />}
            {activeTab === 'Resources'             && <ResourcePanel tasks={filteredTasks} />}
            {activeTab === 'Permits & Milestones'  && <PermitsPanel permits={permits} onAdd={() => setPermitModal('new')} onEdit={p => setPermitModal(p)} />}
          </>
        )}
      </main>

      {/* Modals */}
      {taskModal && (
        <TaskModal task={taskModal === 'new' ? null : taskModal} saving={saving}
          onSave={handleSaveTask} onDelete={handleDeleteTask} onClose={() => setTaskModal(null)} />
      )}
      {permitModal && (
        <PermitModal permit={permitModal === 'new' ? null : permitModal} saving={saving}
          onSave={handleSavePermit} onDelete={handleDeletePermit} onClose={() => setPermitModal(null)} />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
