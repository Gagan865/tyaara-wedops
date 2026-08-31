import { toIsoDate } from '@/lib/format'

// The structural skeleton every wedding starts with. Shared by the client-convert flow
// (app/api/clients/convert) and the "New wedding" action (app/api/project/create) so the
// two can never drift apart. This is the same structural set /api/onboarding seeds, minus
// all the demo data (sample vendors, guests, shopping, tables, vehicles, trials, expenses,
// invoices) — a real new wedding starts empty, not with a demo.

const EVENTS = [
  { name: 'Engagement', slug: 'engagement', icon: '💍', color: 'from-rose-400 to-pink-600', offset: -90, order: 1 },
  { name: 'Haldi', slug: 'haldi', icon: '🌼', color: 'from-yellow-400 to-amber-500', offset: -2, order: 2 },
  { name: 'Mehendi', slug: 'mehendi', icon: '🌿', color: 'from-emerald-400 to-green-600', offset: -2, order: 3 },
  { name: 'Sangeet', slug: 'sangeet', icon: '🎵', color: 'from-fuchsia-400 to-purple-600', offset: -1, order: 4 },
  { name: 'Cocktail Party', slug: 'cocktail-party', icon: '🍸', color: 'from-sky-400 to-indigo-600', offset: -1, order: 5 },
  { name: 'Wedding Ceremony', slug: 'wedding-ceremony', icon: '🕉️', color: 'from-red-500 to-rose-700', offset: 0, order: 6 },
  { name: 'Reception', slug: 'reception', icon: '✨', color: 'from-violet-400 to-purple-700', offset: 1, order: 7 }
]

const CATEGORY_NAMES = ['Venue','Food','Photography','Videography','Decoration','Clothing/Tailor','Jewelry','Invitations','Makeup','Mehendi','DJ/Sound','Lighting','Flowers','Transport','Accommodation','Stage','Furniture','Electronics','Return Gifts','Guests','Bookings','Gifts','Miscellaneous']

const LEAD_TIMES = [
  ['Venue', 270], ['Food', 240], ['Photography', 180], ['Videography', 180],
  ['Decoration', 150], ['Clothing/Tailor', 120], ['Jewelry', 120], ['Invitations', 120],
  ['Makeup', 90], ['Mehendi', 90], ['DJ/Sound', 90], ['Lighting', 90],
  ['Flowers', 60], ['Transport', 60], ['Accommodation', 60], ['Miscellaneous', 60]
]

// Seeds the structural rows for an ALREADY-CREATED project: the caller's project_members
// row, 7 events, 23 categories, 3 to-do lists, 16 booking lead times, a memberships row,
// and one activity row. `admin` is the service-role client. Throws on the first failure so
// the caller can surface a 500.
export async function seedProjectStructure(admin, { projectId, orgId, userId, weddingDate, memberName, activityVerb, activityName }) {
  // Caller becomes a member of the new wedding.
  const pm = await admin.from('project_members').insert({ project_id: projectId, user_id: userId, role: 'owner' })
  if (pm.error) throw new Error('project_members: ' + pm.error.message)

  const wed = new Date(weddingDate)
  const dOffset = (days) => { const d = new Date(wed); d.setDate(d.getDate() + days); return toIsoDate(d) }

  const evIns = await admin.from('events').insert(
    EVENTS.map(e => ({ project_id: projectId, org_id: orgId, name: e.name, slug: e.slug, icon: e.icon, color_gradient: e.color, event_date: dOffset(e.offset), display_order: e.order }))
  ).select('id')
  if (evIns.error) throw new Error('events: ' + evIns.error.message)

  const catIns = await admin.from('categories').insert(
    CATEGORY_NAMES.map((n, i) => ({ project_id: projectId, org_id: orgId, name: n, kind: 'all', display_order: i + 1 }))
  ).select('id, name')
  if (catIns.error) throw new Error('categories: ' + catIns.error.message)
  const catByName = Object.fromEntries((catIns.data || []).map(c => [c.name, c.id]))

  const tl = await admin.from('todo_lists').insert([
    { project_id: projectId, org_id: orgId, name: 'Pre-Event', display_order: 1 },
    { project_id: projectId, org_id: orgId, name: 'Event Day', display_order: 2 },
    { project_id: projectId, org_id: orgId, name: 'Post-Event Checklist', display_order: 3 }
  ])
  if (tl.error) throw new Error('todo_lists: ' + tl.error.message)

  const blt = await admin.from('booking_lead_times').insert(
    LEAD_TIMES.map(([n, days]) => ({ project_id: projectId, org_id: orgId, category_id: catByName[n], lead_days: days }))
  )
  if (blt.error) throw new Error('booking_lead_times: ' + blt.error.message)

  const mem = await admin.from('memberships').insert({
    project_id: projectId, org_id: orgId, user_id: userId,
    name: memberName || 'You', role: 'Admin', is_you: true
  })
  if (mem.error) throw new Error('memberships: ' + mem.error.message)

  await admin.from('activity').insert({
    project_id: projectId, org_id: orgId,
    verb: activityVerb, entity_type: 'project', entity_name: activityName
  })
}
