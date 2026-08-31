import { Card } from '@/components/ui/card'
import { Construction, MessageCircle } from 'lucide-react'

// The WhatsApp automation engine (vendor confirmations, RSVPs, payment reminders,
// run-sheet pushes) is being reworked and ships in a later update. Until then this page
// shows an under-development notice instead of the old mock engine. The previous flow /
// message-log implementation lives in git history if it needs to be restored.
export default function MessagingPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-emerald-600" />Messaging
        </h1>
        <p className="text-sm text-slate-500">WhatsApp automation — vendor confirmations, RSVPs, payment reminders.</p>
      </div>

      <Card className="p-12 text-center border-amber-200 bg-amber-50/50">
        <Construction className="h-12 w-12 mx-auto text-amber-500" />
        <div className="mt-4 text-lg font-serif font-semibold text-amber-900">Under development</div>
        <p className="mt-1 text-sm text-amber-800 max-w-md mx-auto">
          The messaging engine is being built and will arrive in the next update. For now, message vendors
          directly from the <b>WhatsApp</b> button on the Vendors page.
        </p>
      </Card>
    </div>
  )
}
