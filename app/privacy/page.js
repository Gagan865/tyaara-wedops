import LegalShell from '@/components/legal-shell'

export const metadata = { title: 'Privacy Policy — Tyaara / WedOps' }

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="15 September 2026">
      <p>This Privacy Policy explains how <b>[Legal entity name — e.g. Tyaara Weddings / PRISIM]</b> (“we”, “us”, “our”) collects, uses, and protects information in connection with the WedOps platform (the “Service”). By using the Service, you agree to this Policy.</p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><b>Account information</b> — name, email, phone, role, and the organisation you belong to.</li>
        <li><b>Content you enter</b> — details of clients and couples, guests, vendors, quotations, agreements, tasks, budgets, notes, and similar records you create in the Service.</li>
        <li><b>Usage &amp; technical data</b> — log data such as IP address, browser type, and actions taken, used to operate and secure the Service.</li>
        <li><b>Cookies</b> — we use essential cookies to keep you signed in and to run the Service. We do not use advertising cookies.</li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>to provide, maintain, and improve the Service;</li>
        <li>to authenticate users and enforce role-based access;</li>
        <li>to secure the Service and prevent misuse;</li>
        <li>to communicate with you about your account and important updates;</li>
        <li>to comply with legal obligations.</li>
      </ul>
      <p>We do <b>not</b> sell your personal information.</p>

      <h2>3. Data about couples, guests &amp; third parties</h2>
      <p>When you record information about your clients, the couples, their guests, or vendors, you act as the controller of that information and we process it on your behalf to provide the Service. You are responsible for having a lawful basis and any necessary consent to enter such information.</p>

      <h2>4. Sharing &amp; processors</h2>
      <p>We share information only as needed to run the Service:</p>
      <ul>
        <li><b>Hosting &amp; database</b> — Supabase (database, authentication, storage).</li>
        <li><b>Application hosting</b> — Vercel.</li>
        <li><b>Legal</b> — where required by law or to protect rights and safety.</li>
      </ul>
      <p>These providers process data under their own terms and appropriate safeguards. Information may be stored or processed on servers located outside your country.</p>

      <h2>5. Public share links</h2>
      <p>The Service lets you generate links (for quotations, intake forms, and agreements) that can be opened without a login by anyone who has the link. Only share these links with the intended recipient. Data submitted through such a link (for example, a couple’s form response, or an agreement acceptance) is stored in your organisation’s records.</p>

      <h2>6. Security</h2>
      <p>We use technical and organisational measures to protect information, including database row-level security that scopes data to your organisation, encryption in transit (HTTPS), and role-based access controls. No system is completely secure; you are responsible for keeping your credentials confidential.</p>

      <h2>7. Data retention</h2>
      <p>We retain information for as long as your account is active or as needed to provide the Service, and thereafter as required to comply with legal obligations, resolve disputes, and enforce agreements. You can request deletion as described below.</p>

      <h2>8. Your rights</h2>
      <p>Subject to applicable law, you may request to access, correct, export, or delete your personal information. Organisation administrators can manage and remove team members and their access from within the Service. To make a request, contact us using the details below.</p>

      <h2>9. Children</h2>
      <p>The Service is intended for business use by adults and is not directed to children. Do not use the Service to knowingly collect information from children except as necessary for legitimate wedding-planning purposes and with appropriate consent.</p>

      <h2>10. Changes to this Policy</h2>
      <p>We may update this Policy from time to time. We will reflect changes by updating the “Last updated” date above and, where appropriate, will notify you.</p>

      <h2>11. Contact</h2>
      <p>For privacy questions or requests: <b>[support email — e.g. ganavi@tyaaraweddings.com]</b>, <b>[phone]</b>, <b>[registered address]</b>.</p>
    </LegalShell>
  )
}
