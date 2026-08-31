'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { formatDate, daysUntil } from '@/lib/format'
import { CalendarCheck } from 'lucide-react'

export default function BookingsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [projectId, setProjectId] = useState(null)
  const [weddingDate, setWeddingDate] = useState(null)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(wedding_date)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setProjectId(pm.project_id); setWeddingDate(pm.projects?.wedding_date)
      const { data: lt } = await supabase.from('booking_lead_times').select('*, categories(name)').eq('project_id', pm.project_id)
      const { data: bk } = await supabase.from('bookings').select('*, categories(name), vendors(name)').eq('project_id', pm.project_id)
      const wedD = new Date(pm.projects?.wedding_date)
      const combined = (lt || []).map(l => {
        const bookBy = new Date(wedD); bookBy.setDate(bookBy.getDate() - l.lead_days)
        const d = daysUntil(bookBy)
        const linked = (bk || []).find(b => b.category_id === l.category_id)
        let flag = 'green'
        if (d < 0) flag = 'red'
        else if (d < 14) flag = 'orange'
        else if (d < 30) flag = 'yellow'
        return { ...l, book_by: bookBy, days: d, flag, linked }
      }).sort((a, b) => a.book_by - b.book_by)
      setRows(combined)
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const flagStyles = {
    red: 'bg-rose-100 text-rose-800 border-rose-200',
    orange: 'bg-orange-100 text-orange-800 border-orange-200',
    yellow: 'bg-amber-100 text-amber-800 border-amber-200',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Bookings</h1>
        <p className="text-sm text-slate-500">Book-by dates from the 16 standard lead-times. Overdue = auto-computed, never manual.</p>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs">
            <tr>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Lead days</th>
              <th className="text-left px-3 py-2">Ideal book-by</th>
              <th className="text-left px-3 py-2">Days left</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{r.categories?.name}</td>
                <td className="px-3 py-2 text-slate-600">{r.lead_days}</td>
                <td className="px-3 py-2 text-slate-600">{formatDate(r.book_by)}</td>
                <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${flagStyles[r.flag]}`}>{r.days} days</span></td>
                <td className="px-3 py-2 text-slate-600">{r.linked?.status || (r.days < 0 ? 'overdue' : 'pending')}</td>
                <td className="px-3 py-2 text-slate-600">{r.linked?.vendors?.name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
