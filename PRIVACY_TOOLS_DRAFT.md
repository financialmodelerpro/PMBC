# Privacy policy: draft additions for the free tools

**Status: draft for counsel. Not published.** The live policy at `/privacy` is
hardcoded in `src/app/(public)/privacy/page.tsx`, was reviewed by counsel and
dated 16 August 2026, and has not been edited. Nothing below is on the site.

Prepared 16 September 2026, for the free tools section (first tool: Business
Valuation, at `/tools/business-valuation`). Every tool is Hidden from the public
until switched Live at `/admin/tools`, so this wording can be settled before any
visitor can submit data.

## What the tools actually do with data

So counsel can check the wording against the facts:

| Item | Detail |
|------|--------|
| Collected at the gate | Full name, work email, company (optional), purpose of the valuation, planned transaction size band. |
| Financial inputs | Industry, country, last financial year, net debt, three years of revenue, EBITDA, depreciation, capex and working capital, five forecast years of the same, cost of capital assumptions, peer company names and multiples. These describe the visitor's business and may be commercially sensitive. |
| Computed results | The valuation ranges, tables and figures shown on screen, stored as computed. |
| Consent | A required checkbox with the exact wording and the time it was ticked. A separate optional checkbox for follow-up email, with its time. Both stored on the record. |
| Attribution | UTM tags from the link the visitor arrived by, the referring site, the landing page, and the browser user agent. |
| IP address | Not stored. A one-way hash of it (SHA-256 with a server secret) is stored and used only to limit repeat submissions. |
| PDF report | Generated on the server from the computed results and attached to the results email. Not stored as a file; regenerated from the stored results when staff download it. |
| Emails | The results email to the visitor, and an internal alert to the firm's advisory inbox. Both through Brevo. |
| Email tracking | Brevo reports delivery, opens, link clicks, bounces and spam complaints for the results email back to the site, where they are stored against the record. Opens rely on a tracking pixel and link clicks on redirected links. A click on "Book a free call" is recorded against the record before the visitor is sent to the booking page. |
| Booking | The booking page (Calendly) receives the visitor's name, email and UTM tags in the link, so its form is prefilled. |
| Storage | Supabase (the same project that holds contact form submissions). Row-level security denies all public access; only the server and signed-in staff can read it. |
| Retention | **Not yet decided.** See question 1 below. |
| Test submissions | Submissions made by signed-in staff are flagged as tests and excluded from counts. |

## Proposed wording

Section numbers follow the current policy. Additions are shown as new
paragraphs; nothing existing is removed except where noted.

### 2. Information We Collect (add after the contact form paragraph)

> **Information you submit through our free tools:** when you use a tool such
> as our business valuation calculator and ask for your results, we collect your
> name, email address, company (optional), the purpose of the valuation and the
> approximate size of any planned transaction. We also store the figures you
> enter, which may include historical and forecast financial information about
> your business, the assumptions you choose, and the results the tool
> calculates from them.
>
> **Information about how you reached and used the tool:** the website or
> campaign link that brought you to it, the page you arrived on, and your
> browser type. We do not store your IP address; we store a one-way,
> non-reversible code derived from it, used only to limit repeated automated
> submissions.
>
> **Information about our emails to you:** when we email you your results, our
> email provider tells us whether the email was delivered, opened or bounced,
> and whether you clicked a link in it, including the link to book a call. We
> also record when you click "Book a free call" on the results page.

### 3. How We Use Information (add to the list)

> - Calculate your results, show them to you, and email them to you with a PDF
>   report;
> - Understand whether our emails reach you and which of our tools and
>   campaigns lead to conversations with us;
> - Where you have ticked the separate optional box, contact you about your
>   results. If you did not tick it, we will send you the results email you
>   asked for and will not otherwise contact you about them unless you contact
>   us first.

> The figures you enter into a tool are used to produce your results and to
> help us understand your enquiry. We treat them as confidential, as described
> in our [Confidentiality statement](/confidentiality), and do not share them
> outside PaceMakers and the processors listed in section 4.

### 4. Third Parties (amend the Brevo and Supabase entries)

> **Supabase, Inc.** (United States): managed database where contact form
> submissions, free tool submissions and website content are stored. Data is
> held in a private project accessible only to authorised PaceMakers personnel.
>
> **Brevo SAS** (France, European Union): transactional email delivery for
> contact-form notifications and acknowledgements, and for free tool results
> emails and their PDF reports. Brevo processes the recipient address and the
> email content for the purpose of delivery, and reports delivery, opens, clicks,
> bounces and spam complaints back to us.
>
> **Calendly LLC** (United States): meeting booking. If you click "Book a free
> call", your name and email address are passed to Calendly in the link so its
> booking form is prefilled.

### 6. Storage and Retention (add)

> Free tool submissions, including the figures you entered and your results,
> are kept for **[RETENTION PERIOD]** from the date of submission, after which
> they are deleted, unless you have become a client, in which case they are
> retained under the relevant engagement letter.

### 7. Cookies (add)

> Our results emails contain a small tracking image and tracked links, provided
> by our email provider, which tell us whether an email was opened and whether a
> link was clicked. You can prevent open tracking by disabling automatic image
> loading in your email client. The free tools keep a note of the link you
> arrived from in your browser's session storage, which is cleared when you
> close the tab.
>
> When you follow a "Book a free call" link from a tool's results, email or
> report, or arrive at our booking page from a link carrying campaign tags, we
> set one first-party cookie, `pmbc_booking`, for 30 days. It records where the
> booking came from (the campaign tags and, for a tool link, a short reference
> to your submission) so a booking can be matched to the results you received.
> It contains no name, email address or password, is not shared with other
> websites, and is used only to pass that attribution to our booking calendar.

### 8. Your Choices (add)

> You can ask us to delete a free tool submission, including the figures you
> entered, at any time by writing to the contact email listed on the website.
> You can withdraw consent to follow-up emails in the same way, or by replying
> to any email we send you.

## Questions for counsel

0. **The booking attribution cookie** (`pmbc_booking`, added 2026-09-17). It is
   first-party, holds campaign tags and a short submission reference, and lasts
   30 days. Confirm whether it needs consent before it is set, or whether the
   notice above is enough for the audiences the site serves.

1. **Retention period** for tool submissions. The data is commercially
   sensitive and most submissions will never become a mandate. A short period
   (for example 12 or 24 months) is easier to defend than open-ended retention.
   Deletion would need a small scheduled job or a manual routine; neither exists
   yet.
2. **Lawful basis for email tracking.** Opens and clicks are tracked on the
   results email, which the visitor asked for. Is a statement in the policy
   sufficient, or does the consent wording at the gate need to mention tracking
   explicitly? The current required consent reads:
   > I agree that PaceMakers may store the details and figures I have entered,
   > and email me my results and report, as described in the privacy policy.
3. **Confidentiality.** Should `/confidentiality` also be extended to say that
   figures entered into a tool are treated as confidential before any
   engagement exists?
4. **Visitors in the EU and UK.** Tracking pixels and the transfer to Supabase
   and Calendly in the United States may call for more specific wording if tools
   are promoted to those audiences.
5. **Existing statements noticed while drafting**, not changed:
   - Section 4 still lists **hCaptcha**, which was switched off on
     2026-08-16 in favour of a honeypot and a timing check. It is dormant, not
     removed.
   - Section 4 says fonts are delivered "via the public CDN". The site loads
     them through `next/font`, which serves them from the site's own domain.
   - Section 4 refers to "authorised **PMBC** personnel". The firm's public name
     is PaceMakers; PMBC is an internal abbreviation.
