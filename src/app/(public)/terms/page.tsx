import type { Metadata } from 'next';

import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPageMetadata({
  path: '/terms',
  fallback: {
    title: 'Terms of Engagement — PaceMakers Business Consultants',
    description:
      'Terms governing use of the PaceMakers Business Consultants website and the firm’s advisory engagements.',
    ogSubtitle: 'Terms governing use of this website.',
  },
});

const LAST_UPDATED = '3 May 2026';

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
        Legal
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-4xl">
        Terms of Engagement
      </h1>
      <p className="mt-4 inline-flex items-center rounded-md border border-[color:var(--pmbc-accent)]/40 bg-[color:var(--pmbc-accent)]/10 px-3 py-1.5 text-[12px] font-medium text-[color:var(--pmbc-text)]">
        Subject to legal review — to be finalised by counsel before launch.
      </p>
      <p className="mt-3 text-[12px] text-[color:var(--pmbc-muted)]">
        Last updated: {LAST_UPDATED}
      </p>

      <Prose>
        <h2>1. Scope of These Terms</h2>
        <p>
          These terms govern your use of the website at pacemakersglobal.com
          (the &ldquo;Website&rdquo;), operated by PaceMakers Business Consultants
          LLP (&ldquo;PMBC&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;). By using
          the Website, you agree to these terms. If you do not agree, please do
          not use the Website.
        </p>

        <h2>2. The Website Is Information, Not Advice</h2>
        <p>
          The content on this Website is provided for general information about
          PMBC and the corporate finance and transaction advisory services we
          offer. Nothing on this Website constitutes financial, tax, legal, or
          investment advice. You should not rely on the Website as a substitute
          for professional advice tailored to your circumstances.
        </p>

        <h2>3. No Advisor-Client Relationship from Website Use</h2>
        <p>
          Visiting the Website, sending us a contact-form enquiry, exchanging
          informal correspondence, or attending a preliminary call does
          <strong> not</strong> by itself create an advisor-client, fiduciary, or
          contractual relationship between you and PMBC. An advisor-client
          relationship is established only by a separate written engagement
          letter signed by both parties.
        </p>

        <h2>4. Engagement Letters Govern Mandates</h2>
        <p>
          All advisory work is carried out under a written engagement letter
          executed by both parties. That engagement letter — and not this
          Website — governs the scope, fees, deliverables, timelines,
          confidentiality, intellectual property, limitation of liability, and
          termination terms applicable to the mandate. Where a conflict arises
          between these Website terms and an engagement letter in respect of a
          live mandate, the engagement letter prevails.
        </p>

        <h2>5. Confidentiality of Enquiries</h2>
        <p>
          We treat enquiries and prospective-client information confidentially
          and on a need-to-know basis within the firm. This commitment does not
          create an advisor-client relationship (see clause 3) and does not
          prevent us from declining a prospective engagement, including for
          reasons of conflict, capacity, or commercial fit.
        </p>

        <h2>6. Intellectual Property</h2>
        <p>
          The PMBC name, the PaceMakers logo, the textual content,
          methodologies, frameworks, models, and visual design published on this
          Website are the property of PaceMakers Business Consultants LLP unless
          otherwise credited. They may not be reproduced, distributed,
          republished, or used to train machine-learning systems without our
          prior written permission.
        </p>

        <h2>7. Disclaimers and No Warranty</h2>
        <p>
          The Website is provided on an &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; basis. While we take reasonable care to keep the
          information accurate and up to date, PMBC makes no representations or
          warranties, express or implied, regarding the completeness, accuracy,
          reliability, suitability, or availability of the content published
          here. To the fullest extent permitted by applicable law, PMBC shall
          not be liable for any loss or damage of any kind arising from use of,
          or inability to use, the Website.
        </p>

        <h2>8. Third-Party Links</h2>
        <p>
          The Website links to third-party sites, including financialmodelerpro.com,
          partner-firm sites, and external references in articles or commentary.
          PMBC is not responsible for the content, accuracy, security, or
          practices of those sites. Inclusion of a link does not imply
          endorsement.
        </p>

        <h2>9. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            Use the Website in a way that violates applicable law or that
            interferes with its operation or security;
          </li>
          <li>
            Attempt to access non-public areas of the Website (including the
            <code> /admin</code> area) except where you are authorised;
          </li>
          <li>
            Submit false or misleading information through the contact form, or
            use the form to send unsolicited commercial communications, malware,
            or content that is unlawful, defamatory, or infringing.
          </li>
        </ul>

        <h2>10. Privacy</h2>
        <p>
          Our collection and use of personal information through the Website is
          described in our <a href="/privacy">Privacy Policy</a>, which forms
          part of these terms.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These terms, and any matter arising from your use of the Website,
          shall be governed by the laws applicable to the jurisdiction in which
          PMBC is constituted, without regard to conflict-of-law principles. The
          specific governing law and exclusive forum for disputes are to be
          confirmed by counsel prior to launch.
        </p>

        <h2>12. Changes to These Terms</h2>
        <p>
          PMBC may revise these terms from time to time. The version in force
          is the one published on this page. Significant changes will be
          flagged at the top of the page. Continued use of the Website after an
          update constitutes acceptance of the revised terms.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions about these terms can be sent to the contact email listed
          in the Website footer.
        </p>
      </Prose>
    </article>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose mt-10 max-w-none text-[15px] leading-relaxed text-[color:var(--pmbc-text)] [&>h2]:mt-10 [&>h2]:font-serif [&>h2]:text-[20px] [&>h2]:font-semibold [&>h2]:text-[color:var(--pmbc-text)] [&>p]:mt-4 [&>p]:text-[color:var(--pmbc-muted)] [&>ul]:mt-4 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ul>li]:text-[color:var(--pmbc-muted)] [&_code]:rounded [&_code]:bg-[color:var(--pmbc-surface-alt)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[color:var(--pmbc-text)] [&_a]:text-[color:var(--pmbc-primary)] [&_a]:underline">
      {children}
    </div>
  );
}
