import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How PaceMakers Business Consultants handles personal information.',
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 lg:py-28">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--pmbc-primary)]">
        Legal
      </p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[color:var(--pmbc-text)] sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-3 text-[12px] text-[color:var(--pmbc-muted)]">
        Placeholder text — to be reviewed by counsel before launch.
      </p>

      <Prose>
        <h2>Introduction</h2>
        <p>
          PaceMakers Business Consultants LLP (&ldquo;PMBC&rdquo;, &ldquo;we&rdquo;,
          &ldquo;our&rdquo;) respects the privacy of visitors and clients who interact
          with this website and our advisory practice. This policy describes the
          personal information we collect, how we use it, and the choices you have.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We collect information you voluntarily provide through our contact form
          (name, email, company, phone, country, service of interest, and the
          message you send), and limited technical information such as browser
          type, device, and pages viewed for the purpose of operating the website
          securely.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use the information you submit to respond to your enquiry, evaluate
          potential mandates, and (where appropriate) follow up with relevant
          firm communications. We do not sell or rent personal information to
          third parties.
        </p>

        <h2>Storage and Retention</h2>
        <p>
          Submissions are stored in a hosted database and email service provider
          configured for the firm. We retain enquiry records for as long as is
          reasonably necessary for the purposes described above, after which they
          are archived or deleted in line with our internal retention policy.
        </p>

        <h2>Your Choices</h2>
        <p>
          You may request access to, correction of, or deletion of personal
          information you have shared with us by writing to the contact email
          listed in the footer of this site. We will respond within a reasonable
          timeframe and in accordance with applicable law.
        </p>

        <h2>Cookies</h2>
        <p>
          This website uses only those cookies that are strictly necessary for
          its operation. We may add anonymised analytics in future; if we do,
          this policy will be updated to reflect that.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. The version in force is
          always the one published on this page. Significant changes will be
          flagged at the top of the policy.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy-related enquiries, please use the email address listed in
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
