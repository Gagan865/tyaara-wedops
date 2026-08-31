'use client'
import { useEffect, useState } from 'react'

export default function CountdownLive({ target }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const targetDate = new Date(target)
  targetDate.setHours(0, 0, 0, 0)
  const diff = Math.max(0, targetDate.getTime() - now.getTime())
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)

  return (
    <div className="flex items-center gap-4 md:gap-6">
      <Cell label="Days"  value={d} />
      <Cell label="Hours" value={h} />
      <Cell label="Mins"  value={m} />
      <Cell label="Secs"  value={s} />
    </div>
  )
}

function Cell({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-serif font-semibold tabular-nums">{String(value).padStart(2, '0')}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/70">{label}</div>
    </div>
  )
}
