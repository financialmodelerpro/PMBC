import type { Metadata } from 'next';

import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  path: '/privacy',
  fallback: {
    title: 'Privacy Policy — PaceMakers Business Consultants',
    description:
      'How PaceMakers Business Consultants handles personal information.',
    ogSubtitle: 'How we handle your information.',
  },
});

const LAST_UPDATED = '3 May 2026';

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
        Legal
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-4 inline-flex items-center rounded-md border border-[color:var(--pmbc-accent)]/40 bg-[color:var(--pmbc-accent)]/10 px-3 py-1.5 text-[12px] font-medium text-[color:var(--pmbc-text)]">
        Subject to legal review — to be finalised by counsel before launch.
      </p>
      <p className="mt-3 text-[12px] text-[color:var(--pmbc-muted)]">
        Last updated: {LAST_UPDATED}
      </p>

      <Prose>
        <h2>1. Introduction</h2>
        <p>
          PaceMakers Business Consultants LLP (&ldquo;PMBC&rdquo;, &ldquo;we&rdquo;,
          &ldquo;our&rdquo;) respects the privacy of visitors and clients who interact
          with this website (pacemakersglobal.com) and our advisory practice. This
          policy describes the personal information we collect, how we use it, the
          third parties that process information on our behalf, and the choices you
          have. It applies only to information collected through this website and
          related communications; information shared during a live engagement is
          governed by the relevant engagement letter and applicable professional
          standards.
        </p>

        <h2>2. Information We Collect</h2>
        <p>We collect:</p>
        <ul>
          <li>
            <strong>Information you submit through our contact form</strong> — name,
            email, company, phone (optional), country, service of interest, and the
            message you write. Submitted via the form at <code>/contact</code>.
          </li>
          <li>
            <strong>Limited technical information</strong> — IP address, browser
            type, device type, referring URL, and pages viewed. Used to operate the
            website securely and diagnose problems.
          </li>
          <li>
            <strong>Information you send us directly</strong> — by email, WhatsApp,
            phone, or LinkedIn. Treated according to the same standards as
            information submitted through the form.
          </li>
        </ul>
        <p>
          We do not knowingly collect information from children, and the website is
          not directed at minors.
        </p>

        <h2>3. How We Use Information</h2>
        <p>We use the information you submit to:</p>
        <ul>
          <li>Respond to your enquiry and evaluate potential mandates;</li>
          <li>
            Provide the services you have engaged us for, where you become a client;
          </li>
          <li>
            Where appropriate and permitted by law, follow up with relevant firm
            communications about our services;
          </li>
          <li>
            Maintain records required by applicable professional, anti-money
            laundering, and tax obligations.
          </li>
        </ul>
        <p>
          We do not sell or rent personal information to third parties for marketing
          purposes.
        </p>

        <h2>4. Third Parties That Process Information on Our Behalf</h2>
        <p>
          The following service providers (&ldquo;processors&rdquo;) handle data on
          our behalf, under contracts that restrict their use of the information to
          our instructions and to security obligations consistent with industry
          practice:
        </p>
        <ul>
          <li>
            <strong>Vercel, Inc.</strong> (United States) — website hosting and edge
            delivery. Logs limited request data for security and operational
            monitoring.
          </li>
          <li>
            <strong>Supabase, Inc.</strong> (United States) — managed Postgres
            database where contact form submissions and CMS content are stored. Data
            is held in a private project accessible only to authorised PMBC
            personnel.
          </li>
          <li>
            <strong>Resend, Inc.</strong> (United States) — transactional email
            delivery for contact-form notifications and acknowledgements. Resend
            processes the recipient address and message body for the limited purpose
            of email delivery and deliverability monitoring.
          </li>
          <li>
            <strong>hCaptcha</strong> (Intuition Machines, Inc., United States) —
            bot-protection on the contact form. May process limited browser
            information to verify a human visitor.
          </li>
          <li>
            <strong>Google Fonts</strong> (Google LLC, United States) — typography
            delivery via the public CDN. Fonts are served via standard CDN headers;
            no personal data is requested from your browser by us.
          </li>
        </ul>
        <p>
          We may add or change processors over time. Significant changes will be
          reflected in this policy. If we add an analytics provider in future, we
          will name it here, describe what it collects, and provide a way to opt out
          where required by applicable law.
        </p>

        <h2>5. International Transfers</h2>
        <p>
          Several of the processors named above operate primarily in the United
          States. By submitting information through this website you acknowledge
          that personal information may be transferred to and processed in
          jurisdictions outside your own. We rely on the contractual and security
          commitments of each processor to safeguard the information while it is in
          their custody.
        </p>

        <h2>6. Storage and Retention</h2>
        <p>
          Contact-form submissions are stored in our Supabase database for as long
          as is reasonably necessary to evaluate and respond to the enquiry, and
          thereafter as required for record-keeping, dispute, or regulatory
          purposes. Records associated with active or concluded engagements are
          retained per the relevant engagement letter and applicable professional
          standards.
        </p>

        <h2>7. Cookies</h2>
        <p>
          This website currently uses only cookies that are strictly necessary for
          its operation (for example, the session cookie set by the admin login on
          the protected <code>/admin</code> area). We do not currently set
          analytics or advertising cookies on the public site. If we add anonymised
          analytics in future, this policy will be updated and an appropriate
          notice will be displayed to comply with applicable consent requirements.
        </p>

        <h2>8. Your Choices</h2>
        <p>
          Depending on your jurisdiction, you may have rights to access, correct,
          delete, restrict or object to the processing of personal information we
          hold about you, and to portability of that information. To exercise any
          of these rights, please write to the contact email listed in the website
          footer with sufficient detail for us to identify the relevant records. We
          will respond within a reasonable timeframe and in accordance with
          applicable law.
        </p>

        <h2>9. Security</h2>
        <p>
          We use industry-standard technical and organisational safeguards to
          protect personal information, including encrypted-in-transit
          communications, restricted database access, and limited internal access
          on a need-to-know basis. No internet transmission or storage system is
          fully immune to risk, and we cannot guarantee absolute security.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. The version in force is
          always the one published on this page. Significant changes will be
          flagged at the top of the policy along with the &ldquo;last updated&rdquo;
          date.
        </p>

        <h2>11. Governing Law and Contact</h2>
        <p>
          This policy is published by PaceMakers Business Consultants LLP. The
          jurisdiction governing this website and any privacy-related complaints is
          to be confirmed by counsel prior to launch. For privacy-related
          enquiries, please use the contact email listed in the website footer.
        </p>
      </Prose>
    </article>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose mt-10 max-w-none text-[15px] leading-relaxed text-[color:var(--pmbc-text)] [&>h2]:mt-10 [&>h2]:font-serif [&>h2]:text-[20px] [&>h2]:font-semibold [&>h2]:text-[color:var(--pmbc-text)] [&>p]:mt-4 [&>p]:text-[color:var(--pmbc-muted)] [&>ul]:mt-4 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ul>li]:text-[color:var(--pmbc-muted)] [&_code]:rounded [&_code]:bg-[color:var(--pmbc-surface-alt)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[color:var(--pmbc-text)]">
      {children}
    </div>
  );
}
