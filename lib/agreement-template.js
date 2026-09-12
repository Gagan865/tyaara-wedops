// Default Tyaara Weddings terms & conditions, reproduced from the signed reference
// agreement. Used to pre-fill a new agreement's `terms` (editable per client).
export const DEFAULT_AGREEMENT_TERMS = `1. Scope of Work
Tyaara Weddings will provide wedding planning, coordination, and décor/execution services as per the finalised element list and approved quotation. All decor and arrangements will be customised based on the client's requirements, within the agreed scope and budget. Any item not mentioned in the finalised element list will be treated as out of scope.

2. Booking Confirmation & Date Blocking
A date will be tentatively blocked only upon receipt of the advance payment. The booking will be considered fully confirmed only after acceptance of all terms and timely adherence to the payment schedule. The advance amount paid at the time of booking is strictly non-refundable and non-transferable under any circumstances.

3. Payment Structure & Policy
95% of the total project cost must be paid 10 days prior to the event date. The remaining 5% must be paid 5 days prior to the event date. No payments will be accepted during or after the event. If dues remain unpaid, Tyaara Weddings reserves the right to cancel vendor bookings, halt material procurement, and withdraw resources, and will not be liable for any loss or compromise in quality arising due to such delays.

4. Execution Dependency on Payment
Event execution, setup, installation, and activation are strictly dependent on payment clearance. If 100% payment is not received 5 days prior, Tyaara Weddings may withhold setup/execution partially or completely. The client bears full responsibility for any impact on the event due to non-payment.

5. Element Delivery & Refund Limitation
Minor variations in design, colour tones, materials, flowers or arrangement may occur and shall not be considered a failure of delivery. A refund applies only if a specific element in the finalised list is completely (100%) not delivered on-ground, limited strictly to that element's individual cost, processed post-event after verification. Partial execution, personal dissatisfaction, external factors, or equivalent substitutions do not qualify.

6. Add-On & Additional Services
Any additional services beyond the agreed quotation are billed separately as an Add-On Invoice and executed only after full payment. Add-ons are not adjusted against pending balances.

7. No Spot Demands
No on-the-spot or last-minute additions will be accepted during the event. All requirements must be communicated, approved and paid for in advance.

8. Element List Commitment
Only elements explicitly mentioned in the finalised and approved element list will be delivered. Verbal expectations outside this list are not valid deliverables.

9. Limitation of Liability
Execution is subject to timely payments, client approvals and external conditions (venue access, vendor timelines). Tyaara Weddings is not responsible for loss, delay or disruption caused by unavoidable circumstances (weather, government restrictions, vendor issues) or situations beyond operational control. No refunds are issued in such cases.

10. Accommodation
The client agrees to provide one dedicated room at the venue for the Tyaara Weddings team for coordination, storage of materials and smooth execution.

11. Cancellation & Rescheduling (Strict No Refund)
All payments, including the advance, are strictly non-refundable. On cancellation, the amount may be adjusted toward a future date subject to availability and confirmation within a mutually agreed timeline, valid for a single reschedule only. Failing that, the amount stands forfeited. No cash refunds, third-party transfers or partial settlements.

12. Payment Mode
All payments must be made only via Cash or Google Pay (GPay) to the official number. Payments to unauthorised persons are not valid.

13. Jurisdiction
All disputes are subject to the jurisdiction of Bengaluru City Civil Court, Karnataka.

14. Acceptance of Terms
By accepting this agreement, the client confirms that all terms are read, understood and accepted; that they are strict, binding and non-negotiable; and that execution is fully dependent on payment compliance and the agreed scope.`

export const COMPANY = {
  name: 'Tyaara Weddings',
  rep: 'Ganavi Aradhya',
  role: 'Co-Founder',
  phone: '9606255549',
  email: 'ganavi@tyaaraweddings.com',
  site: 'www.tyaaraweddings.com'
}

// The couple intake form fields (rendered on the public form; answers stored as JSON).
export const COUPLE_FORM_FIELDS = [
  { key: 'bride_name', label: "Bride's name", type: 'text', required: true },
  { key: 'groom_name', label: "Groom's name", type: 'text', required: true },
  { key: 'contact_phone', label: 'Primary contact number', type: 'tel', required: true },
  { key: 'contact_email', label: 'Email', type: 'email' },
  { key: 'bride_side_contact', label: "Bride's side contact", type: 'text' },
  { key: 'groom_side_contact', label: "Groom's side contact", type: 'text' },
  { key: 'wedding_dates', label: 'Wedding / function dates', type: 'text', placeholder: 'e.g. December 2 & 3 2026' },
  { key: 'venue', label: 'Venue (if decided)', type: 'text' },
  { key: 'functions', label: 'Functions', type: 'textarea', placeholder: 'Engagement, Haldi, Mehendi, Sangeet, Wedding, Reception…' },
  { key: 'guest_count', label: 'Approx. guest count', type: 'number' },
  { key: 'cuisine', label: 'Cuisine preference', type: 'select', options: ['North Indian', 'South Indian', 'Both', 'Other'] },
  { key: 'theme_colors', label: 'Theme / colour preferences', type: 'text' },
  { key: 'budget', label: 'Approximate budget (₹)', type: 'text' },
  { key: 'special_requests', label: 'Anything special we should know', type: 'textarea' }
]
