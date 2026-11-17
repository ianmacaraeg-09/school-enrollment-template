import { useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { account, dateText, fullName, gradeName, money } from '../core/logic.ts'
import type { Application, Payment } from '../core/types.ts'
import { Field, Modal } from '../ui/kit.tsx'

export function PaymentModal({ app, onClose }: { app: Application; onClose(): void }) {
  const { config, payments, recordPayment, toast } = useData()
  const acct = account(config, app, payments)
  const [amount, setAmount] = useState(acct.balance > 0 ? String(acct.balance) : '')
  const [method, setMethod] = useState(config.paymentMethods[0] ?? 'Cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Payment | null>(null)

  if (receipt) return <ReceiptModal payment={receipt} app={app} onClose={onClose} />

  return (
    <Modal title={`Record payment — ${fullName(app)}`} onClose={onClose}>
      <form
        className="grid"
        onSubmit={async (e) => {
          e.preventDefault()
          const res = await recordPayment({ applicationId: app.id, amount: Number(amount), method, reference, note, paidAt: new Date(date).toISOString() })
          if (!res.ok) return setError(res.error)
          toast(`Receipt ${res.value.receiptNo} issued`)
          setReceipt(res.value)
        }}
      >
        <p className="span-all muted">Net assessment {money(config, acct.assessment.total)} · Paid {money(config, acct.paid)} · <strong>Balance {money(config, acct.balance)}</strong></p>
        <Field label="Amount *" error={error}><input type="number" step="0.01" min="0" value={amount} onChange={(e) => { setAmount(e.target.value); setError('') }} autoFocus /></Field>
        <Field label="Payment date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Method"><select value={method} onChange={(e) => setMethod(e.target.value)}>{config.paymentMethods.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Reference no." hint="GCash ref, check no., transfer ID"><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <Field label="Note" span="all"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Down payment, 2nd installment…" /></Field>
        <div className="span-all row gap end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save & issue receipt</button>
        </div>
      </form>
    </Modal>
  )
}

export function ReceiptModal({ payment, app, onClose }: { payment: Payment; app: Application; onClose(): void }) {
  const { config, payments } = useData()
  const acct = account(config, app, payments)
  return (
    <Modal title="Official receipt" onClose={onClose}>
      <div className="receipt print-area">
        <div className="receipt-head">
          <strong>{config.school.name}</strong>
          <span>{config.school.address}</span>
          <span>{config.school.phone} · {config.school.email}</span>
        </div>
        <h3 className="center">OFFICIAL RECEIPT {payment.voided && <span className="void-tag">VOID</span>}</h3>
        <dl className="kv">
          <dt>Receipt no.</dt><dd>{payment.receiptNo}</dd>
          <dt>Date</dt><dd>{dateText(config, payment.paidAt)}</dd>
          <dt>Received from</dt><dd>{fullName(app)} ({app.studentNo || app.applicationNo})</dd>
          <dt>{config.terms.gradeLevel}</dt><dd>{gradeName(config, app.gradeId)}</dd>
          <dt>Method</dt><dd>{payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</dd>
          {payment.note && <><dt>Note</dt><dd>{payment.note}</dd></>}
          <dt>Amount</dt><dd><strong className="big">{money(config, payment.amount)}</strong></dd>
          <dt>Balance after</dt><dd>{money(config, acct.balance)}</dd>
          <dt>Received by</dt><dd>{payment.receivedBy}</dd>
        </dl>
      </div>
      <div className="row gap end no-print">
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={() => window.print()}>Print</button>
      </div>
    </Modal>
  )
}
