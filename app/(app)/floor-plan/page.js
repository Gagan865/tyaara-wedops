'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { activeProjectQuery } from '@/lib/active-project'
import { LoadingState, ErrorState, NoProjectState } from '@/components/app/page-state'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Printer, Search, ZoomIn, ZoomOut, Save } from 'lucide-react'

export default function FloorPlanPage() {
  const [ctx, setCtx] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [noProject, setNoProject] = useState(false)
  const [tables, setTables] = useState([])
  const [layouts, setLayouts] = useState([])
  const [activeLayout, setActiveLayout] = useState(null)
  const [background, setBackground] = useState('')
  const [zoom, setZoom] = useState(1)
  const [search, setSearch] = useState('')
  const [assignments, setAssignments] = useState([])
  const dragRef = useRef(null)

  async function load() {
    try {
      const supabase = createClient()
      const { data: pm } = await activeProjectQuery(supabase, 'project_id, projects(org_id)').limit(1).maybeSingle()
      if (!pm) { setNoProject(true); setLoading(false); return }
      setCtx({ projectId: pm.project_id, orgId: pm.projects?.org_id })
      const [t, l, a] = await Promise.all([
        supabase.from('tables').select('*').eq('project_id', pm.project_id),
        supabase.from('floor_layouts').select('*').eq('project_id', pm.project_id),
        supabase.from('table_assignments').select('*, guests(name)').eq('project_id', pm.project_id)
      ])
      setTables(t.data || []); setLayouts(l.data || []); setAssignments(a.data || [])
      if (!activeLayout && (l.data || []).length) { setActiveLayout(l.data[0].id); setBackground(l.data[0].background_url || '') }
      setLoading(false)
    } catch (e) {
      console.error('load failed:', e)
      setLoadError(e)
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  async function createLayout() {
    const name = prompt('Layout name?')
    if (!name) return
    const supabase = createClient()
    const { data, error } = await supabase.from('floor_layouts').insert({ project_id: ctx.projectId, org_id: ctx.orgId, name, data: {} }).select('*').single()
    if (error) return toast.error(error.message)
    setLayouts(prev => [...prev, data]); setActiveLayout(data.id); load()
  }

  async function moveTable(id, dx, dy) {
    const supabase = createClient()
    const t = tables.find(x => x.id === id)
    if (!t) return
    const nx = Math.round(((t.x || 0) + dx) / 20) * 20
    const ny = Math.round(((t.y || 0) + dy) / 20) * 20
    setTables(prev => prev.map(x => x.id === id ? { ...x, x: nx, y: ny } : x))
    await supabase.from('tables').update({ x: nx, y: ny }).eq('id', id)
  }

  function handleDrag(e, id) {
    const startX = e.clientX, startY = e.clientY
    const t0 = tables.find(x => x.id === id)
    if (!t0) return
    const onMove = (m) => {
      const dx = (m.clientX - startX) / zoom
      const dy = (m.clientY - startY) / zoom
      setTables(prev => prev.map(x => x.id === id ? { ...x, x: (t0.x || 0) + dx, y: (t0.y || 0) + dy } : x))
    }
    const onUp = async (m) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const dx = (m.clientX - startX) / zoom
      const dy = (m.clientY - startY) / zoom
      const nx = Math.round(((t0.x || 0) + dx) / 20) * 20
      const ny = Math.round(((t0.y || 0) + dy) / 20) * 20
      const supabase = createClient()
      await supabase.from('tables').update({ x: nx, y: ny }).eq('id', id)
      setTables(prev => prev.map(x => x.id === id ? { ...x, x: nx, y: ny } : x))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  async function saveBackground(url) {
    setBackground(url)
    const supabase = createClient()
    await supabase.from('floor_layouts').update({ background_url: url }).eq('id', activeLayout)
  }

  // Find guest
  let foundTableId = null
  if (search.trim()) {
    const a = assignments.find(x => x.guests?.name?.toLowerCase().includes(search.trim().toLowerCase()))
    if (a) foundTableId = a.table_id
  }

  if (loading) return <LoadingState />
  if (noProject) return <NoProjectState />
  if (loadError) return <ErrorState error={loadError} onRetry={() => { setLoadError(null); setLoading(true); load() }} />

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Floor Plan</h1>
          <p className="text-sm text-slate-500">Drag tables. Same source as Seating — no two-module disagreement.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={activeLayout || ''} onValueChange={(v) => { setActiveLayout(v); const l = layouts.find(x => x.id === v); setBackground(l?.background_url || '') }}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Choose layout" /></SelectTrigger>
            <SelectContent>
              {layouts.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={createLayout}>+ New layout</Button>
          <Button variant="outline" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs defaultValue="interactive">
        <TabsList>
          <TabsTrigger value="interactive">Interactive Layout</TabsTrigger>
          <TabsTrigger value="blueprint">Venue Blueprint</TabsTrigger>
        </TabsList>

        <TabsContent value="interactive">
          <div className="relative flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="Find a guest's table…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            {foundTableId && <span className="text-xs text-emerald-700">Found: {tables.find(t => t.id === foundTableId)?.name}</span>}
          </div>
          <Card className="relative overflow-auto bg-slate-100" style={{ minHeight: 600 }}>
            <div className="relative" style={{ width: 1200, height: 700, transform: `scale(${zoom})`, transformOrigin: 'top left', backgroundImage: background ? `url(${background})` : 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: background ? 'cover' : '20px 20px', backgroundPosition: 'center' }}>
              {tables.map(t => {
                const seated = assignments.filter(a => a.table_id === t.id).length
                const isFound = foundTableId === t.id
                return (
                  <div key={t.id}
                    onMouseDown={(e) => handleDrag(e, t.id)}
                    className={`absolute cursor-move select-none flex items-center justify-center text-white text-xs font-semibold ${isFound ? 'ring-4 ring-yellow-400 z-30' : ''}`}
                    style={{
                      left: t.x || 100, top: t.y || 100,
                      width: t.shape === 'rectangle' ? 120 : 80, height: 80,
                      borderRadius: t.shape === 'round' ? '50%' : 8,
                      background: seated >= t.capacity ? '#0F4C3A' : seated > 0 ? '#166B4E' : '#94a3b8'
                    }}>
                    <div className="text-center leading-tight">
                      <div>{t.name}</div>
                      <div className="text-[10px] font-normal">{seated}/{t.capacity}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="blueprint">
          <Card className="p-4 space-y-3">
            <div className="text-sm text-slate-600">Upload a venue image URL to trace tables on top.</div>
            <div className="flex gap-2">
              <Input placeholder="https://..." value={background} onChange={(e) => setBackground(e.target.value)} />
              <Button onClick={() => saveBackground(background)} className="bg-[#0F4C3A]"><Save className="h-4 w-4 mr-2" />Save background</Button>
            </div>
            {background && <img src={background} alt="venue" className="max-h-96 rounded border" />}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
