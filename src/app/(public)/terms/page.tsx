import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Engagement',
  description:
    'Terms governing use of the PaceMakers Business Consultants website and the firm’s advisory engagements.',
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
        Legal
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-4xl">
        Terms of Engagement
      </h1>
      <p className="mt-3 text-[12px] text-[color:var(--pmbc-muted)]">
        Placeholder text — to be reviewed by counsel before launch.
      </p>

      <Prose>
        <h2>Use of This Website</h2>
        <p>
          The content on this website is provided for general information about
          PaceMakers Business Consultants LLP (&ldquo;PMBC&rdquo;) and does not
          constitute financial, tax, legal, or investment advice. Use of this
          website does not create an advisory or fiduciary relationship.
        </p>

        <h2>Engagements</h2>
        <p>
          All advisory work is carried out under a separate written engagement
          letter signed by both parties. That letter — and not this website —
          governs the scope, fees, deliverables, confidentiality, and liability
          terms applicable to a given mandate.
        </p>

        <h2>No Warranty</h2>
        <p>
          The website is provided on an &ldquo;as is&rdquo; basis. While we take
          reasonable care to keep information accurate and up to date, PMBC
          makes no warranties, express or implied, regarding the completeness,
          accuracy, or fitness for any particular purpose of the content
          published here.
        </p>

        <h2>Confidentiality</h2>
        <p>
          We treat enquiries and prospective-client information confidentially.
          Information shared during a live engagement is governed by the
          confidentiality terms of the relevant engagement letter and applicable
          professional standards.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          The PMBC name, logo, and the materials published on this website are
          the property of PaceMakers Business Consultants LLP unless otherwise
          credited. They may not be reproduced or distributed without prior
          written permission.
        </p>

        <h2>Third-Party Links</h2>
        <p>
          Where this website links to third-party sites (including
          financialmodelerpro.com), PMBC is not responsible for the content,
          accuracy, or practices of those sites.
        </p>

        <h2>Governing Law</h2>
        <p>
          These terms, and any matter arising from your use of this website,
          shall be governed by the laws applicable to the jurisdiction in which
          PMBC is constituted, without regard to conflict-of-law principles.
        </p>

        <h2>Changes</h2>
        <p>
          PMBC may revise these terms at any time. The version in force is the
          one published on this page. Continued use of the website after an
          update constitutes acceptance of the revised terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to the contact email listed in
          the website footer.
        </p>
      </Prose>
    </article>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose mt-10 max-w-none text-[15px] leading-relaxed text-[color:var(--pmbc-text)] [&>h2]:mt-10 [&>h2]:font-serif [&>h2]:text-[20px] [&>h2]:font-semibold [&>h2]:text-[color:var(--pmbc-text)] [&>p]:mt-4 [&>p]:text-[color:var(--pmbc-muted)]">
      {children}
    </div>
  );
}
