import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { account, dateText, fullName, gradeName, money, round2 } from '../core/logic.ts'
import type { Payment } from '../core/types.ts'
import { downloadCsv } from '../ui/csv.ts'
import { Card, Empty, PageHeader, Stat, Tabs } from '../ui/kit.tsx'
import { PaymentModal, ReceiptModal } from './PaymentParts.tsx'

export default function Payments() {
  const { config, applications, payments, can } = useData()
  const [tab, setTab] = useState<'receipts' | 'accounts'>('accounts')
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('')
  const [owing, setOwing] = useState(true)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const byId = useMemo(() => new Map(applications.map((a) => [a.id, a])), [applications])
  const needle = q.trim().toLowerCase()

  const active = payments.filter((p) => !p.voided)
  const today = new Date().toISOString().slice(0, 10)
  const collectedToday = round2(active.filter((p) => p.paidAt.slice(0, 10) === today).reduce((s, p) => s + p.amount, 0))

  const accounts = useMemo(
    () =>
      applications
        .filter((a) => a.status === 'approved' || a.status === 'enrolled')
        .map((a) => ({ a, ...account(config, a, payments) }))
        .filter((r) => (!owing || r.balance > 0) && (!needle || `${fullName(r.a)} ${r.a.applicationNo} ${r.a.studentNo}`.toLowerCase().includes(needle)))
        .sort((x, y) => y.balance - x.balance),
    [applications, payments, config, owing, needle],
  )
  const receipts = useMemo(
    () =>
      [...payments]
        .filter((p) => (!method || p.method === method) && (!needle || `${p.receiptNo} ${byId.get(p.applicationId) ? fullName(byId.get(p.applicationId)!) : ''}`.toLowerCase().includes(needle)))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [payments, method, needle, byId],
  )
  const payApp = payFor ? byId.get(payFor) : undefined
  const rcptApp = receipt ? byId.get(receipt.applicationId) : undefined

  return (
    <>
      <PageHeader title="Payments" sub="Receipts and student accounts">
        <button className="btn" onClick={() =>
          downloadCsv('payments.csv', ['Receipt No', 'Date', 'Student', 'Method', 'Reference', 'Amount', 'Received by', 'Voided'],
            receipts.map((p) => [p.receiptNo, p.paidAt.slice(0, 10), byId.get(p.applicationId) ? fullName(byId.get(p.applicationId)!) : '', p.method, p.reference, p.amount, p.receivedBy, p.voided ? 'Yes' : '']))}>
          Export CSV
        </button>
      </PageHeader>
      <div className="stats">
        <Stat label="Collected (all time)" value={money(config, round2(active.reduce((s, p) => s + p.amount, 0)))} tone="good" />
        <Stat label="Collected today" value={money(config, collectedToday)} />
        <Stat label="Receipts issued" value={payments.length} hint={`${payments.filter((p) => p.voided).length} voided`} />
        <Stat label="Accounts with balance" value={applications.filter((a) => (a.status === 'approved' || a.status === 'enrolled') && account(config, a, payments).balance > 0).length} tone="warn" />
      </div>

      <Card pad={false}>
        <div className="filters">
          <Tabs<'receipts' | 'accounts'> tabs={[{ id: 'accounts', label: 'Student accounts' }, { id: 'receipts', label: 'Receipts' }]} value={tab} onChange={setTab} />
          <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
          {tab === 'receipts' ? (
            <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method"><option value="">All methods</option>{config.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select>
          ) : (
            <label className="check-row"><input type="checkbox" checked={owing} onChange={(e) => setOwing(e.target.checked)} /> With balance only</label>
          )}
        </div>

        {tab === 'accounts' ? (
          accounts.length === 0 ? <Empty title="No accounts to show">Accounts appear once an applicant is approved.</Empty> : (
            <div className="table-wrap"><table className="table hover">
              <thead><tr><th>{config.terms.student}</th><th>{config.terms.gradeLevel}</th><th className="right">Assessed</th><th className="right">Paid</th><th className="right">Balance</th><th /></tr></thead>
              <tbody>
                {accounts.map((r) => (
                  <tr key={r.a.id}>
                    <td><Link to={`/app/applications/${r.a.id}`}><strong>{fullName(r.a)}</strong></Link><div className="muted small">{r.a.studentNo || r.a.applicationNo}</div></td>
                    <td>{gradeName(config, r.a.gradeId)}</td>
                    <td className="right">{money(config, r.assessment.total)}</td>
                    <td className="right">{money(config, r.paid)}</td>
                    <td className="right"><strong className={r.balance > 0 ? 'warn-text' : 'good-text'}>{money(config, r.balance)}</strong></td>
                    <td className="right">{can('payments.record') && <button className="btn" onClick={() => setPayFor(r.a.id)}>Record payment</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )
        ) : receipts.length === 0 ? <Empty title="No receipts yet" /> : (
          <div className="table-wrap"><table className="table hover">
            <thead><tr><th>Receipt</th><th>Date</th><th>{config.terms.student}</th><th>Method</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {receipts.map((p) => {
                const a = byId.get(p.applicationId)
                return (
                  <tr key={p.id} className={`click ${p.voided ? 'voided' : ''}`} onClick={() => setReceipt(p)}>
                    <td><strong>{p.receiptNo}</strong>{p.voided && <span className="void-tag">VOID</span>}</td>
                    <td>{dateText(config, p.paidAt)}</td>
                    <td>{a ? fullName(a) : '—'}</td>
                    <td>{p.method}</td>
                    <td className="right">{money(config, p.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </Card>

      {payApp && <PaymentModal app={payApp} onClose={() => setPayFor(null)} />}
      {receipt && rcptApp && <ReceiptModal payment={receipt} app={rcptApp} onClose={() => setReceipt(null)} />}
    </>
  )
}
