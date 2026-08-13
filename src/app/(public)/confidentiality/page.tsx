import type { Metadata } from 'next';

import { buildPageMetadata } from '@/lib/seo/metadata';
import { PageHeroFallback } from '@/components/public/PageHeroFallback';

export const metadata: Metadata = buildPageMetadata({
  path: '/confidentiality',
  fallback: {
    title: 'Confidentiality | PaceMakers Business Consultants',
    description:
      'How PaceMakers Business Consultants treats information shared before, during and after an engagement.',
    ogSubtitle: 'How we treat information shared with us.',
  },
});

const LAST_UPDATED = '13 August 2026';

/**
 * Hardcoded rather than CMS-driven, matching /privacy and /terms.
 *
 * Those two are the documented exception to this project's CMS-first rule, and
 * this page belongs with them for the same reason: a statement that will be
 * settled by counsel should not be editable from an admin console afterwards.
 * The confidentiality position is also the one a client is most likely to hold
 * the firm to, so an accidental edit here costs more than the convenience of
 * editing it without a deploy.
 */
export default function ConfidentialityPage() {
  return (
    <>
      <PageHeroFallback
        eyebrow="Legal"
        headline="Confidentiality"
        tagline="How PaceMakers Business Consultants treats the information you share with us, before, during and after an engagement."
      />
      <article className="mx-auto max-w-3xl px-6 py-16 lg:py-20">
        <p className="inline-flex items-center rounded-md border border-[color:var(--pmbc-accent)]/40 bg-[color:var(--pmbc-accent)]/10 px-3 py-1.5 text-[12px] font-medium text-[color:var(--pmbc-text)]">
          Subject to legal review. To be finalised by counsel before launch.
        </p>
        <p className="mt-3 text-[12px] text-[color:var(--pmbc-muted)]">
          Last updated: {LAST_UPDATED}
        </p>

        <Prose>
          <h2>1. Why This Statement Exists</h2>
          <p>
            Corporate finance work runs on information a client would not give
            anyone else. Valuations, transaction terms, ownership disputes,
            funding gaps and exit intentions all reach us before they reach the
            market, and in most cases before they reach the client&rsquo;s own
            wider organisation. PaceMakers Business Consultants LLP
            (&ldquo;PMBC&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) treats that
            as the defining obligation of the practice rather than as a clause in
            a contract.
          </p>
          <p>
            This statement sets out how we handle information in practice. It is
            a description of our standing approach, not a substitute for the
            confidentiality provisions of an engagement letter or a separate
            non-disclosure agreement. Where an executed agreement says something
            different, that agreement governs.
          </p>

          <h2>2. Before an Engagement: Enquiries and Exploratory Discussions</h2>
          <p>
            Confidentiality begins at the first conversation, not at signature.
            Information shared while you are deciding whether to appoint us is
            treated as confidential whether or not an engagement follows, and
            whether or not a non-disclosure agreement is in place.
          </p>
          <ul>
            <li>
              We do not disclose that a prospective client has approached us, or
              what the subject matter was.
            </li>
            <li>
              Enquiry material is used only to assess the mandate, scope the work
              and prepare a proposal.
            </li>
            <li>
              If we do not proceed, or you appoint someone else, the position does
              not change. The obligation survives the decision not to engage.
            </li>
            <li>
              We will tell you where we think a discussion is approaching the
              point at which a formal non-disclosure agreement should be signed
              before it goes further. In most cases that is the point at which
              names, numbers or counterparties enter the conversation.
            </li>
          </ul>

          <h2>3. During an Engagement</h2>
          <p>
            Information received in the course of a mandate is used for that
            mandate and for nothing else. In particular:
          </p>
          <ul>
            <li>
              We do not use client information to inform work for another client,
              to build a view on a market we are advising in, or to seed our own
              research or published material.
            </li>
            <li>
              Anonymised or aggregated use of engagement experience, such as a
              case study or a sector reference, is published only with the
              client&rsquo;s written consent. Where consent is given, the write-up
              is shown to the client before it appears.
            </li>
            <li>
              Deliverables are addressed to the client and are not circulated
              beyond the recipients named in the engagement letter without
              instruction.
            </li>
            <li>
              Where a mandate requires us to speak to third parties, such as
              lenders, valuers or counterparties, we agree in advance what may be
              disclosed and to whom.
            </li>
          </ul>

          <h2>4. Everyone Working on the Mandate Is Bound by the Same Obligations</h2>
          <p>
            PMBC is partner-led and resourced per engagement rather than through
            a permanent pyramid. Analysts and associates are brought onto a
            mandate for the work it needs. That model does not dilute the
            obligation:
          </p>
          <ul>
            <li>
              Every analyst and associate engaged on a mandate is bound by written
              confidentiality obligations to PMBC that are no less strict than the
              ones PMBC owes the client, and those obligations continue after
              their involvement ends.
            </li>
            <li>
              Access is given on a need-to-know basis within the engagement. Team
              members receive the material their part of the work requires and not
              the client&rsquo;s file in full.
            </li>
            <li>
              The partner reviews the work personally and remains accountable for
              it, including for the handling of information by anyone engaged on
              it.
            </li>
            <li>
              We do not name individual analysts or associates externally, on this
              website or elsewhere, and we do not identify who worked on which
              mandate.
            </li>
            <li>
              Where a client requires named-individual confidentiality
              undertakings, or approval rights over who is staffed, we accommodate
              that in the engagement letter.
            </li>
          </ul>

          <h2>5. Storage and Access</h2>
          <p>
            Client material is held in access-controlled systems operated by PMBC
            or by established service providers under contract. In practice this
            means:
          </p>
          <ul>
            <li>
              Files are stored in accounts under firm control, not on personal
              storage belonging to individuals working on a mandate.
            </li>
            <li>
              Access is restricted to the people engaged on that mandate, and is
              withdrawn when their involvement ends.
            </li>
            <li>
              Material is transmitted over encrypted connections. Where a client
              specifies a secure transfer method or a data room, we work inside
              it.
            </li>
            <li>
              Enquiries submitted through this website are stored separately from
              engagement files, in the systems described in our{' '}
              <a href="/privacy">privacy policy</a>, and are visible only to
              authorised firm personnel.
            </li>
          </ul>
          <p>
            No system is immune to compromise. We use safeguards consistent with
            professional practice and do not represent that any system is
            absolutely secure. If a breach affecting client information occurred,
            we would notify the affected client promptly and describe what
            happened.
          </p>

          <h2>6. After an Engagement Ends</h2>
          <p>
            Confidentiality does not expire with the engagement. Our obligations
            continue indefinitely in respect of information that remains
            confidential, and they are not affected by the conclusion,
            termination or non-renewal of a mandate.
          </p>
          <ul>
            <li>
              Working files and deliverables are retained for the period set out
              in the engagement letter, and otherwise for as long as is required
              by applicable professional, regulatory and tax obligations.
            </li>
            <li>
              Retained material stays under the same access restrictions as during
              the mandate.
            </li>
            <li>
              On written request we will return or destroy client material at the
              end of a retention period, subject to any copy we are required to
              keep by law or by professional standards, which remains
              confidential.
            </li>
            <li>
              Concluded mandates are not used as unattributed references. We do
              not describe a former client&rsquo;s situation to a prospective one,
              even without naming them, where the description would make them
              identifiable.
            </li>
          </ul>

          <h2>7. Where Disclosure Is Required</h2>
          <p>
            There are limited circumstances in which we may be required to
            disclose information, and we treat these as exceptions to be applied
            narrowly rather than as general permission:
          </p>
          <ul>
            <li>
              Where disclosure is required by applicable law, by a court or
              tribunal of competent jurisdiction, or by a regulator or
              professional body entitled to demand it.
            </li>
            <li>
              Where required for anti-money laundering, counter-terrorist
              financing, sanctions or know-your-client obligations.
            </li>
            <li>
              Where necessary to establish, exercise or defend a legal claim,
              including a dispute between PMBC and the client.
            </li>
            <li>
              Where the client has consented to the disclosure, or has instructed
              it.
            </li>
          </ul>
          <p>
            Where we are permitted to do so, we will tell the client before
            disclosing, give them the opportunity to seek protective relief, and
            disclose only the part of the information that is actually required.
            Some legal obligations prohibit us from giving notice, and in those
            cases we cannot.
          </p>

          <h2>8. Conflicts Between Prospective Clients</h2>
          <p>
            A boutique practice serving a defined set of sectors will be
            approached by parties with opposing interests. We manage that
            explicitly:
          </p>
          <ul>
            <li>
              We run a conflict check before accepting a mandate, against current
              and recent engagements.
            </li>
            <li>
              Where accepting a mandate would put us on both sides of the same
              transaction, or against a current client on a related matter, we
              decline. We do not treat information barriers as a substitute for
              declining in that situation.
            </li>
            <li>
              Where two prospective clients approach us on the same opportunity,
              neither is told that the other has. The fact of an approach is
              itself confidential, so a declined mandate is declined without
              explanation of the reason where explaining it would disclose the
              other approach.
            </li>
            <li>
              Advising separate clients in the same sector is not, by itself, a
              conflict. What is not permitted is any flow of information between
              those mandates, and the restrictions in section 3 apply in full.
            </li>
            <li>
              Where a potential conflict is manageable and both parties are
              entitled to know, we raise it in writing and proceed only with
              informed consent.
            </li>
          </ul>

          <h2>9. Financial Modeler Pro</h2>
          <p>
            Financial Modeler Pro is the platform arm of PMBC and operates as a
            separate product with its own systems and its own terms. Client
            information from an advisory mandate is never used to build, populate
            or illustrate platform content, and platform user data is not used in
            advisory work.
          </p>

          <h2>10. Questions and Contact</h2>
          <p>
            If you need a confidentiality undertaking in place before a
            conversation, or you have a question about how information you have
            already shared is being handled, write to the advisory address listed
            in the website footer and it will reach the partner directly. See also
            our <a href="/privacy">privacy policy</a>, which covers personal
            information collected through this website, and our{' '}
            <a href="/terms">terms of engagement</a>.
          </p>
        </Prose>
      </article>
    </>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="pmbc-prose mt-10 max-w-none text-[15px] leading-relaxed text-[color:var(--pmbc-text)] [&>h2]:mt-10 [&>h2]:font-serif [&>h2]:text-[20px] [&>h2]:font-semibold [&>h2]:text-[color:var(--pmbc-text)] [&>p]:mt-4 [&>p]:text-[color:var(--pmbc-muted)] [&>ul]:mt-4 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-6 [&>ul>li]:text-[color:var(--pmbc-muted)] [&_code]:rounded [&_code]:bg-[color:var(--pmbc-surface-alt)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[color:var(--pmbc-text)]">
      {children}
    </div>
  );
}
