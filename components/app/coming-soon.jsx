import { Card } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'

export default function ComingSoon({ title, description }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <Card className="p-10 text-center">
        <Sparkles className="h-10 w-10 mx-auto text-[#0F4C3A]" />
        <div className="mt-3 text-lg font-serif font-semibold">Shipping in prompt 2</div>
        <div className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          The schema for this module is already in Postgres — UI arrives next. All data captured elsewhere will slot in immediately.
        </div>
      </Card>
    </div>
  )
}
