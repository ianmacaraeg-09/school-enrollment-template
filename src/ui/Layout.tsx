import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { fullName, gradeName } from '../core/logic.ts'
import type { Permission, Role } from '../core/types.ts'
import { Avatar, Card, Modal, StatusBadge, Toasts } from './kit.tsx'

const ICONS: Record<string, string> = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  applications: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
  sections: 'M3 5h18M3 12h18M3 19h18M7 3v4M7 10v4M7 17v4',
  payments: 'M2 6h20v12H2zM2 10h20M6 15h4',
  reports: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14 3h-4l-.6 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  link: 'M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1',
  menu: 'M4 6h16M4 12h16M4 18h16',
  help: 'M9.1 9a3 3 0 115.8 1c0 2-3 2.5-3 4.5M12 18h.01M12 22a10 10 0 100-20 10 10 0 000 20z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
}
export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
      <path d={ICONS[name] ?? ''} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 38 }: { size?: number }) {
  const { config } = useData()
  return (
    <span className="logo" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {config.school.logoText.slice(0, 3)}
    </span>
  )
}

export function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can, role } = useData()
  if (can(perm)) return <>{children}</>
  return (
    <Card title="No access">
      <p>The <strong>{role}</strong> role does not have permission to open this page. Switch role from the sidebar (demo) or ask an administrator.</p>
    </Card>
  )
}

const ROLES: { id: Role; label: string }[] = [
  { id: 'admin', label: 'Administrator' },
  { id: 'registrar', label: 'Registrar' },
  { id: 'cashier', label: 'Cashier' },
]

/** Type-ahead student search. Press "/" anywhere to focus it. */
function GlobalSearch() {
  const { config, applications } = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    return applications.filter((a) => `${a.firstName} ${a.lastName} ${a.applicationNo} ${a.studentNo} ${a.guardian.name}`.toLowerCase().includes(n)).slice(0, 6)
  }, [q, applications])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); input.current?.focus() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const go = (id: string) => { nav(`/app/applications/${id}`); setQ(''); setOpen(false); input.current?.blur() }
  return (
    <div className="gsearch">
      <Icon name="search" size={18} />
      <input ref={input} value={q} placeholder={`Search a ${config.terms.student.toLowerCase()}, number or parent…`} aria-label="Search"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
          if (e.key === 'Enter' && results[idx]) go(results[idx].id)
          if (e.key === 'Escape') { setQ(''); input.current?.blur() }
        }} />
      <kbd>/</kbd>
      {open && q.trim() && (
        <ul className="gsearch-pop" role="listbox">
          {results.length === 0 && <li className="muted gs-none">No one matches “{q}”.</li>}
          {results.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === idx} className={i === idx ? 'on' : ''} onMouseDown={() => go(a.id)} onMouseEnter={() => setIdx(i)}>
              <Avatar name={fullName(a)} size={32} />
              <div className="grow"><strong>{fullName(a)}</strong><div className="muted small">{gradeName(config, a.gradeId)} · {a.studentNo || a.applicationNo}</div></div>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminLayout() {
  const { config, can, role, setRole, backend } = useData()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])
  const t = config.terms
  const syName = config.schoolYears.find((s) => s.id === config.activeSchoolYearId)?.name ?? ''
  const nav: { to: string; label: string; icon: string; perm: Permission }[] = [
    { to: '/app', label: 'Dashboard', icon: 'dashboard', perm: 'applications.view' },
    { to: '/app/applications', label: `${t.application}s`, icon: 'applications', perm: 'applications.view' },
    { to: '/app/sections', label: `${t.section}s`, icon: 'sections', perm: 'applications.view' },
    { to: '/app/payments', label: 'Payments', icon: 'payments', perm: 'payments.view' },
    { to: '/app/reports', label: 'Reports', icon: 'reports', perm: 'reports.view' },
    { to: '/app/settings', label: 'Settings', icon: 'settings', perm: 'settings.edit' },
  ]
  const roleLabel = ROLES.find((r) => r.id === role)?.label ?? role
  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Logo size={42} />
          <div>
            <strong>{config.school.shortName}</strong>
            <span>Enrollment</span>
          </div>
        </div>
        <nav aria-label="Main">
          {nav.filter((n) => can(n.perm)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/app'} className={({ isActive }) => (isActive ? 'on' : '')}>
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <Link className="side-link" to="/" target="_blank"><Icon name="external" size={16} />View school website</Link>
          <div className="side-user">
            <Avatar name={roleLabel} size={34} />
            <label>
              <span>Demo: using as</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Using the system as">
                {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          </div>
          <span className="side-note">{backend === 'local' ? 'Saved on this device only' : 'Connected to Supabase'}</span>
        </div>
      </aside>

      <div className="content">
        <header className="topbar no-print">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <GlobalSearch />
          <span className="year-pill">{syName}</span>
          {can('applications.edit') && <Link className="btn primary add-btn" to="/app/applications/new"><Icon name="plus" size={18} /><span>New {t.application.toLowerCase()}</span></Link>}
          <button className="btn ghost icon" onClick={() => setHelp(true)} aria-label="Help"><Icon name="help" /></button>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>

      {help && (
        <Modal title="How this works" onClose={() => setHelp(false)}>
          <ol className="help-list">
            <li><strong>Parents apply</strong> online, or you add a {t.student.toLowerCase()} yourself with <em>New {t.application.toLowerCase()}</em>.</li>
            <li><strong>Look it over.</strong> Open the {t.application.toLowerCase()}, tick the documents you received, then press <em>Start review</em>.</li>
            <li><strong>Approve</strong> it, then pick a {t.section.toLowerCase()} and record the down payment.</li>
            <li><strong>Enroll.</strong> The button turns on by itself once everything required is done. The page always tells you what is still missing.</li>
          </ol>
          <p className="muted small">Shortcut: press <kbd className="kbd">/</kbd> anywhere to search for a {t.student.toLowerCase()}.</p>
          <div className="row end"><button className="btn primary" onClick={() => setHelp(false)}>Got it</button></div>
        </Modal>
      )}
      <Toasts />
    </div>
  )
}

export function PublicLayout() {
  const { config } = useData()
  return (
    <div className="public">
      <header className="public-head">
        <Link to="/" className="brand">
          <Logo size={44} />
          <div>
            <strong>{config.school.name}</strong>
            <span className="muted small">{config.school.tagline}</span>
          </div>
        </Link>
        <nav className="row gap">
          <NavLink to="/apply">Apply</NavLink>
          <NavLink to="/track">Track {config.terms.application.toLowerCase()}</NavLink>
          <Link to="/app">Staff sign-in</Link>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-foot muted small">
        {config.school.name} · {config.school.address} · {config.school.phone} · {config.school.email}
      </footer>
      <Toasts />
    </div>
  )
}
