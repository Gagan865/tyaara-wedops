import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { toIsoDate } from '@/lib/format'

// All seeding happens here (bypasses the DB seed function so we don't depend on user re-running SQL).
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { orgName, orgType, projectName, weddingDate, displayName } = await request.json()
    if (!projectName || !weddingDate) {
      return NextResponse.json({ error: 'Project name and wedding date are required' }, { status: 400 })
    }

    // 1. Org
    const { data: org, error: orgErr } = await admin.from('organizations').insert({
      name: orgName || 'My Wedding Org',
      type: orgType || 'couple'
    }).select('id').single()
    if (orgErr) return NextResponse.json({ error: 'org: ' + orgErr.message }, { status: 500 })

    // 2. Org member
    await admin.from('org_members').insert({ org_id: org.id, user_id: user.id, role: 'owner' })

    // 3. Profile upsert
    await admin.from('profiles').upsert({
      id: user.id, org_id: org.id,
      name: displayName || user.email?.split('@')[0] || 'You',
      avatar_initials: (displayName || user.email || 'YU').substring(0, 2).toUpperCase()
    })

    // 4. Project
    const projectCode = 'WD-' + Math.random().toString(36).substring(2, 9).toUpperCase()
    const { data: project, error: pErr } = await admin.from('projects').insert({
      org_id: org.id, name: projectName, wedding_date: weddingDate,
      project_code: projectCode, created_by: user.id
    }).select('id').single()
    if (pErr) return NextResponse.json({ error: 'project: ' + pErr.message }, { status: 500 })
    const projectId = project.id

    // 5. Project member
    await admin.from('project_members').insert({ project_id: projectId, user_id: user.id, role: 'owner' })

    const wed = new Date(weddingDate)
    const dOffset = (days) => { const d = new Date(wed); d.setDate(d.getDate() + days); return toIsoDate(d) }

    // 6. Events (7)
    const events = [
      { name: 'Engagement', slug: 'engagement', icon: '💍', color: 'from-rose-400 to-pink-600', offset: -90, order: 1 },
      { name: 'Haldi', slug: 'haldi', icon: '🌼', color: 'from-yellow-400 to-amber-500', offset: -2, order: 2 },
      { name: 'Mehendi', slug: 'mehendi', icon: '🌿', color: 'from-emerald-400 to-green-600', offset: -2, order: 3 },
      { name: 'Sangeet', slug: 'sangeet', icon: '🎵', color: 'from-fuchsia-400 to-purple-600', offset: -1, order: 4 },
      { name: 'Cocktail Party', slug: 'cocktail-party', icon: '🍸', color: 'from-sky-400 to-indigo-600', offset: -1, order: 5 },
      { name: 'Wedding Ceremony', slug: 'wedding-ceremony', icon: '🕉️', color: 'from-red-500 to-rose-700', offset: 0, order: 6 },
      { name: 'Reception', slug: 'reception', icon: '✨', color: 'from-violet-400 to-purple-700', offset: 1, order: 7 }
    ]
    const evIns = await admin.from('events').insert(
      events.map(e => ({ project_id: projectId, org_id: org.id, name: e.name, slug: e.slug, icon: e.icon, color_gradient: e.color, event_date: dOffset(e.offset), display_order: e.order }))
    ).select('id, slug, name')
    if (evIns.error) return NextResponse.json({ error: 'events: ' + evIns.error.message }, { status: 500 })
    const evRows = evIns.data || []
    const wedEventId = evRows.find(e => e.slug === 'wedding-ceremony')?.id

    // 7. Categories (23)
    const catNames = ['Venue','Food','Photography','Videography','Decoration','Clothing/Tailor','Jewelry','Invitations','Makeup','Mehendi','DJ/Sound','Lighting','Flowers','Transport','Accommodation','Stage','Furniture','Electronics','Return Gifts','Guests','Bookings','Gifts','Miscellaneous']
    const catIns = await admin.from('categories').insert(
      catNames.map((n, i) => ({ project_id: projectId, org_id: org.id, name: n, kind: 'all', display_order: i + 1 }))
    ).select('id, name')
    if (catIns.error) return NextResponse.json({ error: 'categories: ' + catIns.error.message }, { status: 500 })
    const catRows = catIns.data || []
    const catByName = Object.fromEntries(catRows.map(c => [c.name, c.id]))

    // 8. Todo lists (3)
    await admin.from('todo_lists').insert([
      { project_id: projectId, org_id: org.id, name: 'Pre-Event', display_order: 1 },
      { project_id: projectId, org_id: org.id, name: 'Event Day', display_order: 2 },
      { project_id: projectId, org_id: org.id, name: 'Post-Event Checklist', display_order: 3 }
    ])

    // 9. Booking lead times (16)
    const leadTimes = [
      ['Venue', 270], ['Food', 240], ['Photography', 180], ['Videography', 180],
      ['Decoration', 150], ['Clothing/Tailor', 120], ['Jewelry', 120], ['Invitations', 120],
      ['Makeup', 90], ['Mehendi', 90], ['DJ/Sound', 90], ['Lighting', 90],
      ['Flowers', 60], ['Transport', 60], ['Accommodation', 60], ['Miscellaneous', 60]
    ]
    await admin.from('booking_lead_times').insert(
      leadTimes.map(([n, days]) => ({ project_id: projectId, org_id: org.id, category_id: catByName[n], lead_days: days }))
    )

    // 10. Membership (you)
    await admin.from('memberships').insert({
      project_id: projectId, org_id: org.id, user_id: user.id,
      name: displayName || 'You', role: 'Admin', is_you: true
    })

    // 11. Seed tasks (4)
    await admin.from('tasks').insert([
      { project_id: projectId, org_id: org.id, title: 'Sign venue contract', description: 'Finalize and sign venue booking', priority: 'Medium', status: 'Not Started', due_date: dOffset(-59), estimated_hours: 4 },
      { project_id: projectId, org_id: org.id, title: 'Confirm photography team', description: 'Confirm photography and videography team', priority: 'Medium', status: 'Not Started', due_date: dOffset(-42), estimated_hours: 4 },
      { project_id: projectId, org_id: org.id, title: 'Menu tasting', description: 'Menu tasting with caterer', priority: 'Medium', status: 'Not Started', due_date: dOffset(-22), estimated_hours: 4 },
      { project_id: projectId, org_id: org.id, title: 'Send invitations', description: 'Send out wedding invitations', priority: 'Medium', status: 'Not Started', due_date: dOffset(-14), estimated_hours: 4 }
    ])

    // 12. Vendors (6) — all money as numeric strings to avoid any client-side number rounding
    const vendorSeeds = [
      { name: 'Royal Palace Banquets', cat: 'Venue', phone: '+919812345678', contact: 'Rajesh Kumar', quoted: 132000000, advance: 40000000, status: 'confirmed', dueOffset: -30, rating: 5 },
      { name: 'Sharma Caterers', cat: 'Food', phone: '+919876543210', contact: 'Anil Sharma', quoted: 80000000, advance: 20000000, status: 'confirmed', dueOffset: -20, rating: 4 },
      { name: 'Frames of Love Studio', cat: 'Photography', phone: '+919911223344', contact: 'Priya Mehra', quoted: 35000000, advance: 10000000, status: 'pending', dueOffset: -15, rating: 5 },
      { name: 'Bloom & Bright Decor', cat: 'Decoration', phone: '+919933112255', contact: 'Manoj Singh', quoted: 45000000, advance: 15000000, status: 'pending', dueOffset: -10, rating: null },
      { name: 'Glam Studio by Neha', cat: 'Makeup', phone: '+919922334455', contact: 'Neha Kapoor', quoted: 18000000, advance: 5000000, status: 'pending', dueOffset: -7, rating: 4 },
      { name: 'Beats & Bass DJ', cat: 'DJ/Sound', phone: '+919944556677', contact: 'Vikram', quoted: 12000000, advance: 3000000, status: 'pending', dueOffset: -5, rating: 4 }
    ]
    const vIns = await admin.from('vendors').insert(
      vendorSeeds.map(v => ({
        project_id: projectId, org_id: org.id, name: v.name, category_id: catByName[v.cat],
        phone: v.phone, contact_name: v.contact,
        quoted_paise: v.quoted, advance_paise: v.advance,
        balance_paise: v.quoted - v.advance,
        tax_paise: Math.round(v.quoted * 0.18),
        status: v.status, balance_due_date: dOffset(v.dueOffset), rating: v.rating
      }))
    ).select('id, name, category_id, phone, quoted_paise, tax_paise, advance_paise, balance_due_date, status')
    if (vIns.error) return NextResponse.json({ error: 'vendors: ' + vIns.error.message }, { status: 500 })
    const vRows = vIns.data || []

    // 13. Shopping items (4)
    await admin.from('shopping_items').insert([
      { project_id: projectId, org_id: org.id, category_id: catByName['Clothing/Tailor'], name: 'Bridal Lehenga', quantity: 1, store: 'Manish Malhotra', budget_paise: 15000000, actual_price_paise: 14200000, purchased: true },
      { project_id: projectId, org_id: org.id, category_id: catByName['Clothing/Tailor'], name: 'Groom Sherwani', quantity: 1, store: 'Sabyasachi', budget_paise: 12000000, actual_price_paise: 0, purchased: false },
      { project_id: projectId, org_id: org.id, category_id: catByName['Return Gifts'], name: 'Return Gift Boxes', quantity: 250, store: 'Ferns N Petals', budget_paise: 5000000, actual_price_paise: 0, purchased: false },
      { project_id: projectId, org_id: org.id, category_id: catByName['Invitations'], name: 'Wedding Card Set', quantity: 300, store: 'Regalia Cards', budget_paise: 2500000, actual_price_paise: 2500000, purchased: true }
    ])

    // 14. Guests (8)
    const gIns = await admin.from('guests').insert([
      { project_id: projectId, org_id: org.id, name: 'Sharma Family',   group: 'Family',  side: 'Both',  rsvp: 'Coming',     is_vip: false, meal: 'Veg' },
      { project_id: projectId, org_id: org.id, name: 'Verma Family',    group: 'Family',  side: 'Groom', rsvp: 'Pending',    is_vip: false, meal: 'Non-Veg' },
      { project_id: projectId, org_id: org.id, name: 'Kapoor Family',   group: 'Family',  side: 'Bride', rsvp: 'Coming',     is_vip: false, meal: 'Veg' },
      { project_id: projectId, org_id: org.id, name: 'Rahul & Priya',   group: 'Friends', side: 'Both',  rsvp: 'Coming',     is_vip: false, meal: 'Veg' },
      { project_id: projectId, org_id: org.id, name: 'Mr. & Mrs. Iyer', group: 'VIP',     side: 'Both',  rsvp: 'Coming',     is_vip: true,  meal: 'Veg' },
      { project_id: projectId, org_id: org.id, name: 'Anjali & Karan',  group: 'Friends', side: 'Groom', rsvp: 'Maybe',      is_vip: false, meal: 'Veg' },
      { project_id: projectId, org_id: org.id, name: 'Uncle Suresh',    group: 'Family',  side: 'Bride', rsvp: 'Coming',     is_vip: false, meal: 'Veg' },
      { project_id: projectId, org_id: org.id, name: 'Colleague team',  group: 'Friends', side: 'Groom', rsvp: 'Not coming', is_vip: false, meal: 'Non-Veg' }
    ]).select('id')
    if (gIns.error) return NextResponse.json({ error: 'guests: ' + gIns.error.message }, { status: 500 })
    const gRows = gIns.data || []

    // 15. Guest invitations — every guest to wedding + reception + sangeet
    const inviteEventSlugs = ['wedding-ceremony','reception','sangeet']
    const inviteEventIds = evRows.filter(e => inviteEventSlugs.includes(e.slug)).map(e => e.id)
    const invRows = []
    gRows.forEach(g => inviteEventIds.forEach(eid => invRows.push({ guest_id: g.id, event_id: eid, invited: true })))
    await admin.from('guest_invitations').insert(invRows)

    // 16. Tables (4)
    await admin.from('tables').insert([
      { project_id: projectId, org_id: org.id, event_id: wedEventId, name: 'Table 1 — VIPs',    capacity: 10, shape: 'round' },
      { project_id: projectId, org_id: org.id, event_id: wedEventId, name: 'Table 2 — Family',  capacity: 12, shape: 'round' },
      { project_id: projectId, org_id: org.id, event_id: wedEventId, name: 'Table 3 — Friends', capacity: 10, shape: 'round' },
      { project_id: projectId, org_id: org.id, event_id: wedEventId, name: 'Table 4 — Kids',    capacity: 8,  shape: 'round' }
    ])

    // 17. Vehicles (3)
    await admin.from('vehicles').insert([
      { project_id: projectId, org_id: org.id, name: 'Innova Crysta',     type: 'car', seats: 7,  driver_name: 'Ramesh',  driver_phone: '+919812340001' },
      { project_id: projectId, org_id: org.id, name: 'Toyota Fortuner',   type: 'car', seats: 5,  driver_name: 'Prakash', driver_phone: '+919812340002' },
      { project_id: projectId, org_id: org.id, name: 'Mini Bus 26-seater', type: 'bus', seats: 26, driver_name: 'Kishan',  driver_phone: '+919812340003' }
    ])

    // 18. Trials (3) — tied to first 3 vendors
    await admin.from('trials').insert([
      { project_id: projectId, org_id: org.id, vendor_id: vRows[1]?.id || null, name: 'Sherwani first fitting', date: dOffset(-30), time: '11:00', location: 'Sabyasachi Store' },
      { project_id: projectId, org_id: org.id, vendor_id: vRows[0]?.id || null, name: 'Bridal lehenga trial',   date: dOffset(-45), time: '15:00', location: 'Manish Malhotra Studio' },
      { project_id: projectId, org_id: org.id, vendor_id: vRows[4]?.id || null, name: 'Makeup trial',           date: dOffset(-20), time: '10:00', location: 'Glam Studio' }
    ])

    // 19. Expenses — one per vendor's advance
    const expRows = vRows.filter(v => v.advance_paise > 0).map(v => ({
      project_id: projectId, org_id: org.id, event_id: wedEventId, vendor_id: v.id,
      category_id: v.category_id, description: 'Advance to ' + v.name,
      amount_paise: v.advance_paise, date: dOffset(-30 - Math.floor(Math.random() * 20)), type: 'advance'
    }))
    if (expRows.length) await admin.from('expenses').insert(expRows)

    // 20. Invoices — one per vendor
    const invNoBase = new Date().toISOString().slice(2,7).replace('-','')
    await admin.from('invoices').insert(vRows.map(v => ({
      project_id: projectId, org_id: org.id, vendor_id: v.id,
      invoice_number: `INV-${invNoBase}-${Math.random().toString(36).substring(2,6).toUpperCase()}`,
      amount_paise: v.quoted_paise, tax_paise: v.tax_paise, discount_paise: 0,
      total_paise: v.quoted_paise + (v.tax_paise || 0),
      state: v.status === 'confirmed' ? 'unpaid' : 'draft',
      issue_date: dOffset(-15), due_date: v.balance_due_date
    })))

    // 21. WhatsApp settings for the org
    await admin.from('whatsapp_settings').upsert({ org_id: org.id, provider: 'mock', connected_number: '+919999999999', daily_limit: 100, connected_at: new Date().toISOString() })

    // 22. Activity
    await admin.from('activity').insert({ project_id: projectId, org_id: org.id, verb: 'created project', entity_type: 'project', entity_name: projectName })

    return NextResponse.json({ orgId: org.id, projectId, projectCode })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
