# Growth Engine user guide

A plain walkthrough of every Growth Engine screen as the code renders it on 2026-10-08 (commit 44924e5). Labels in **bold** or in quotes are copied from the code. Nothing here changes how the screens work; where a label is confusing it is listed under "Rough edges" at the end, not reworded.

## Before you start

- **Admin only.** Every Growth screen is for the `admin` role. An editor who opens any `/admin/growth` URL is sent to `/admin?denied=1`; someone signed out goes to `/admin/login`. The sidebar entry is hidden from editors.
- **Getting in.** In the admin sidebar, under the divider **Growth**, click **Growth**. That opens `/admin/growth`.
- **On a phone** (screens narrower than 768 pixels) the admin sidebar is hidden. Tap the menu button at the top (its accessible name is "Open admin navigation"), then **Growth**.
- **The sub-navigation.** Every Growth screen has a row of pill buttons at the top, in this order: **Home**, **Signals**, **Prospects**, **Outreach**, **Pipeline**, **Conversations**, **Meetings**, **Partners**, **Knowledge Base**, **Analytics**, **Settings**. The current one is filled navy. On a phone the row does not wrap: swipe it sideways; the current pill scrolls into view by itself.
- **Mock mode.** No `ANTHROPIC_API_KEY` is set, so every AI feature returns labelled sample output and costs nothing. Anything written by the mock carries an amber **Mock** badge (hover text: "Sample output from the mock AI provider, not written by Claude"). Mail is also in mock mode until the four `MS_GRAPH_*` variables are set: sends are recorded, nothing is delivered.
- **AI needs two things even in mock mode:** a monthly AI budget in Settings, and approved Knowledge Base items of the kinds each agent needs. Without them the agent refuses and shows the reason in red.
- **Messages after a click.** Most buttons show one line of text underneath when they finish: green for success, red for an error. That line is the only confirmation most actions give. Exception: forms that close themselves after a successful save (Edit profile, Add contact, Edit contact, Open a lead, Edit lead, and the opportunity, partner, introduction and add-a-call forms) close before their success line can be seen; the new or changed record simply appears. An error keeps the form open with the red line.
- **Validation errors from the server** appear in red under the form and usually start with the internal field name, for example `summary: Describe the signal in a sentence`.
- **"Migration not applied" boxes.** If a table is missing, a box reads "Migration not applied. The `table` table does not exist yet. Apply `supabase/migrations/...` in the Supabase SQL editor." followed by what is affected. Every Growth migration to 096 is applied, so none should show today.
- **Wide tables** on every screen scroll sideways inside their card on a narrow screen.

---

# Part 1: the screens, in sub-navigation order

26 screens in all: 11 reached from the sub-navigation, the rest reached from links on them.

## 1. Home

**URL:** `/admin/growth`
**For:** "Your daily priorities, approvals and pipeline summary."

Header: eyebrow "Growth Engine", title **Home**. Top to bottom:

**Daily Brief** card. Heading **Daily Brief**, with today's date and "Riyadh" on the right. Built by rules from real records only (test and sample rows never appear). Each item has a badge (**Now**, **Today** or **Soon**), a bold link (the title), the recommended action, and a muted line starting "Why:". Empty: "Nothing needs you today." The items it can show, most urgent first:

| Badge | Title | Action text | Link opens |
|---|---|---|---|
| Now | the lead's title | "Call or write today and offer a meeting" | the lead page |
| Now (today) or Soon (tomorrow) | "Today: call with ..." or "Tomorrow: call with ..." | "Read the brief before the call" or "Prepare the brief" | the meeting page |
| Today | the lead's title | "Answer the reply and propose a call" | the lead page |
| Today | "Website chat: ..." | "Reply personally" | the conversation |
| Today | "N drafts to approve" | "Approve, edit or reject them" | Outreach |
| Today | the lead's title | its next action, or "Take the next step" | the lead page |
| Soon | the task's title | "Do it or move the date" | the lead page, or Pipeline |
| Soon | the lead's title | "Follow up on the proposal" or "Agree the next step or close it" | the lead page |
| Soon | "N new signals" | "Convert, attach or dismiss them" | Signals |
| Soon | "Check in with ..." | "Call or message, then log it" | the partner page |

**Three tiles:** **New signals** (note: "N possible duplicates" or "Waiting for triage"; click opens Signals), **Prospects** (opens Prospects), **Open leads** (opens Pipeline). A tile shows "n/a" when its count cannot be read.

**Prospects by band** card: one chip per band (**Priority**, **Good**, **Watch**, **Low**) with a count, then **Not scored: N**. Each chip opens Prospects filtered to that band.

**Recent activity** card: the latest activity lines with date and time; a line tied to a company links to that company. Empty: "Nothing yet." At the foot: **Full audit log** (opens the Audit log tab of Settings).

**Data layer** card: a badge **Ready**, **Not ready** or **Cannot be read**; a sentence such as "All N Growth tables are in place."; a table of every Growth table with **Table**, **State** (**Ready**, **Missing** or **Error**) and **Rows** (row counts include test rows).

No buttons or forms on this screen beyond the links.

## 2. Signals

**URL:** `/admin/growth/signals`
**For:** "Trigger events that suggest a company may need PMBC services."

### Daily signal feed panel
Heading **Daily signal feed**. Text: "Runs each morning at 09:00 Riyadh time (paused) with N keywords switched on (Settings). While paused a run by hand is a preview and saves nothing. Keeps only signals with a real evidence link, skips duplicates and stops at the AI budget." ("(paused)" shows only while the feed is paused.)

- **Run the feed now** (navy). While running it reads **Searching**. Shows the result line, then a list of what the run found: each with an outcome badge (**kept**, **duplicate**, **discarded**, **over limit**), the company in bold, the summary, the matched keyword in brackets, and why. In mock mode the list starts with a **Mock** badge and "Sample output about made-up companies; nothing was saved."
- Below, when runs exist: "Last runs:" followed by each run's time, trigger (cron or manual), "(mock preview)" where it applies, status and counts.

### Add a signal
A navy **Add a signal** button. Clicking it opens a card titled **Add a signal**:

| Field | Required | Accepts |
|---|---|---|
| **Trigger** | yes (has a default, **New project**) | **New project**, **Fundraising or debt**, **Off-plan registration**, **Market entry**, **Finance leadership hire**, **Contract award**, **Acquisition or JV**, **Capital market activity**, **Expansion**, **Other** |
| **Date** | yes (defaults to today, Riyadh) | a date, not in the future |
| **Existing company** | one of these two | a company on file, or **Not on file yet** (default) |
| **Company name** | (shown only when **Not on file yet**) | text, placeholder "As the source names it" |
| **Evidence link** | yes. Hint: "Required. A page anyone can open that shows the event." | an http or https link with a real host; placeholder "https://" |
| **Summary** | yes, at least 10 characters | placeholder "What happened, in a sentence or two" |
| **Source name** | no. Hint: "Optional, e.g. Argaam or Saudi Gazette" | text |

Hidden until a condition: once the summary is 10 characters or more and it matches a keyword in the library whose trigger differs from the one chosen, a line appears: 'Fits the keyword "...", which suggests ...' with a **Use it** button that switches the **Trigger** to the suggestion.

Buttons: **Add signal** (reads **Adding** while saving) and **Close**.

On save: "Signal added to the inbox." or, when it looks like a duplicate, "Added, and flagged as a possible duplicate (same evidence link)." or "(same company and trigger within two weeks)". Duplicates are never refused. The form stays open with the summary, evidence, source and company cleared.

Validation failures (red, under the form): `evidence_url: Give a real evidence link someone can open (http or https)`, `summary: Describe the signal in a sentence`, `company_name: Name the company or choose an existing one`, `signal_date: The date is in the future`, `signal_date: Not a real date`.

### Status tabs
**New** (the default), **Converted**, **Attached**, **Dismissed**, **All**, each with its count (not on **All**).

### Filter bar
**Trigger** (Any, or one of the ten), **Origin** (**Any**, **Added by hand**, **Daily feed**, **Pilot import**), **From** and **To** (dates), **Search** (placeholder "Company or summary"), tick boxes **Duplicates only** and **Include test rows**, and **Filter**. Filters apply only when **Filter** is clicked.

### The list
Empty: "No signals match. Add one above, or wait for the daily feed."

Columns **Date**, **Signal**, **Status**, **Triage**. The Signal cell shows the company (a link when it is on file), a trigger badge, an origin badge when not added by hand, **Possible duplicate** (amber) when flagged, **Test** for test rows, the summary, "Keyword: ..." when the feed matched one, and a link **Evidence** (or "Evidence: source name") that opens the source in a new tab. The Status cell shows the raw status word (new, converted, attached, dismissed), the dismissal reason if any, and who triaged it and when.

### Triage column (per signal)
- A trigger dropdown. Changing it saves at once: "Trigger changed."
- **Convert** (hidden once converted). Opens: **Company** (**Create a new company** or one on file); when creating, **New company name** and **Website domain** (hint "Optional. Used to catch duplicates.", placeholder "example.com.sa"); **Lead title** (hint "Optional. Defaults to the company and the trigger."). Button **Convert to prospect**. Success: "Converted: the company and lead are in Prospects."
- **Attach** (hidden once converted). Opens: **Company** (**Choose a company**), then, once a company is chosen, **Lead** (hint "Optional"; **The company only** or one of its open leads). Button **Attach** (disabled until a company is chosen). Success: "Attached."
- **Dismiss** (red; hidden when dismissed or converted). Opens **Reason** (hint "Required. Kept with the signal.", placeholder "e.g. below minimum size, not our sector"). Button **Dismiss signal**, disabled until the reason has 3 characters. Success: "Dismissed."
- **Reopen** (only on dismissed or attached signals). Success: "Reopened."
- **Not a duplicate** (only on flagged signals). Success: "Duplicate flag cleared."

Clicking **Convert**, **Attach** or **Dismiss** again closes its form. There are no confirmation dialogs on this screen.

## 3. Prospects

**URL:** `/admin/growth/prospects`
**For:** "Researched companies and their decision-makers."

Header buttons: **Import CSV** (opens the import screen) and **New company** (navy, opens the new company screen).

**Filter bar:** **Band** (Any, **Priority**, **Good**, **Watch**, **Low**, **Not scored**), **Status** (**Any but archived**, **New**, **Researching**, **Qualified**, **Client**, **Disqualified**, **Archived**), **Source** (Any, **Outbound**, **Website**, **Referral**, **Partner**, **Tool**, **Pilot**, **Other**), **Search** (placeholder "Company name"), **Include test rows**, **Filter**.

Empty: "No prospects match. Convert a signal, add a company or import a CSV."

**Columns:** **Company** (link to the company page; sector, city, country; source and known scale; **Test** badge), **Score** (score and band badge; "Set by hand" when overridden), **Likely service**, **Latest signal** (date, plus an amber "N new" badge), **Contacts**, **Leads**.

### 3a. New company
**URL:** `/admin/growth/prospects/new`. Title **New company**, description "Add a prospect by hand. A website domain already on file is refused as a duplicate."

| Field | Required | Notes |
|---|---|---|
| **Company name** | yes (the button stays disabled until filled) | |
| **Website domain** | no | hint "Used to catch duplicates", placeholder "example.com.sa" |
| **Sector** | no | placeholder "e.g. Real estate development" |
| **City** | no | |
| **Country** | no | defaults to "Saudi Arabia" |
| **Known scale (SAR)** | no | hint "Project or deal size if known; blank is unknown"; accepts 450000000, 450m, 1.2bn |
| **Likely service** | no | **Not decided** or one of the site's nine services |
| **Status** | yes (default **New**) | the six company statuses |
| **Source** | no (default **Outbound**) | **Not recorded** or one of the seven sources |
| **LinkedIn page** | no | must start with https:// |
| **Description** | no | |
| **Notes** | no | |

Button **Create company** (reads **Saving**). On success it opens the new company's page. Errors: "Scale: use a number such as 450000000, 450m or 1.2bn" (checked before sending), "<Name> already uses <domain>" for a duplicate domain, `linkedin_url: Use a full link starting with https://`.

### 3b. Company page
**URL:** `/admin/growth/prospects/<id>`. Eyebrow "Growth Engine: Prospect", the company name as title, sector, city and country underneath. Header link **All prospects**.

**Profile** card: **Website**, **Status**, **Likely service**, **Known scale** ("Unknown" when blank), **Source**, **LinkedIn** (link "Company page", only when set), the description and notes. Button **Edit profile** opens the same form as 3a in place, with **Save changes** and **Cancel**. On success the form closes and the profile and score update.

**Prospect Score** card: the score and band badge; "Set by hand: <reason>. The rules give N." when overridden; the reasons list; a factor table (**Geography**, **Sector**, **Project signal**, **Funding or transaction signal**, **Scale**, **Decision-maker**, **Recency**) with a note and "points / weight" or "not known"; a last line "Scored on the N points that are known, scaled to 100."; "Scored <date>". Buttons:
- **Rescore now**: "Rescored from the current rules and weights."
- **Override score** (hidden while an override is in place): opens **Score (0 to 100)** and **Reason (required)** with **Set score**. **Set score** stays disabled until the score is a whole number from 0 to 100 and the reason has at least 5 characters. Success: "Manual score set."
- **Clear override** (only while overridden): "Override cleared; the rules score applies."

**Contacts** card. Empty: "No contacts yet." Each contact shows name, job title, badges (**Decision-maker**, the consent status, **Suppressed: never contactable** in red when the address is on the suppression list, **Nurture** when subscribed), email and phone, then:
- **Subscribe to nurture** (only for a contact whose consent is **Opted in** and who is not subscribed or suppressed) or **Unsubscribe from nurture** (when subscribed). Success: "Subscribed." / "Unsubscribed."
- **Edit contact** opens the contact form in place.
- At the foot: **Add contact**.

Contact form fields: **Name** (required; the button stays disabled until filled), **Job title**, **Email** (checked as an email; must be unique), **Phone**, **LinkedIn** (https://), **Consent** (**Unknown** default, **Legitimate interest**, **Opted in**, **Opted out**, **Do not contact**), **Consent source** (hint "Where the consent came from"), tick box **Decision-maker**. Buttons **Add contact** or **Save contact**, and **Cancel**. On success the form closes and the contact list updates. Errors: `email: Enter a valid email address`, "<Name> already uses <email>".

**Leads** card. Empty: "No leads yet." Each lead: its title (opens the lead page), stage badge, temperature and Lead Score badge when scored, **Below SAR 50 million** in red when flagged, a summary line, and **Edit lead**. At the foot: **Open a lead**.

Lead form fields: **Title** (required), **Contact** (**None yet** or one of the company's contacts), **Stage** (**Prospect**, **Contacted**, **Replied**, **Qualified**, **Meeting Booked**, **Opportunity**, **Proposal**, **Won**, **Lost**, **Nurture**), **Service** (**Not decided** or one of the nine), **Deal size (SAR)** (hint "Blank when unknown", placeholder "e.g. 120m"), **Timeline** (placeholder "e.g. decision within 3 months"), **Source**, **Next action**, **Due** (date), **Lost reason** (shown only when the stage is **Lost**), **Requirement**. Buttons **Open lead** or **Save lead**, and **Cancel**. On success the form closes and the lead list updates. Errors: "Deal size: use a number such as 120000000, 120m or 1.2bn", "Give the reason the lead was lost".

**Signals** card: **Date**, **Trigger**, **Summary** (with an **Evidence** link), **Status**. Empty: "No signals linked yet."

**Research briefs** card. Heading **Research briefs**, button **Run research** (reads "Researching (this can take a minute)"). Text: "The agent searches the web and keeps only facts with a source the search returned. It needs approved services and offers in the Knowledge Base and a monthly AI budget. Nothing changes on the profile until you accept it." Empty: "No briefs yet." Each brief, newest first, shows its time, **Mock** and **Test** badges, model, who requested it, **Accepted: ...** when fields were accepted, then **Summary**, **Sector**, **City** (each with numbered source links like [1], or "Unknown"), **Projects**, **Recent triggers**, **Decision-makers**, **Likely service**, **Suggested entry offer**, the reasoning, "Unknown: ..." and "Dropped for lack of a source: ...".
- A mock brief says "Sample output from the mock provider about a made-up company. It is not research and cannot be accepted." and has no accept section.
- A real brief ends with **Accept into the profile**: tick boxes **Summary as the description**, **Sector**, **City**, **Likely service**, **Largest project size as the known scale**, **Decision-makers as contacts (names and titles only)**, **Recent triggers as signals**, then **Accept selected** (disabled until one is ticked). Success: "Accepted: ..." naming what was applied (a field, "contact <name>" or "signal <date>"), plus "Skipped: ..." where something could not apply.

**Timeline** card: every activity on the company, oldest first, each with a date, an actor badge (**Ahmad**, **AI** or **System**), the summary, "(imported)" and **Test** where they apply. Empty: "Nothing recorded yet."

### 3c. Pilot CSV import
**URL:** `/admin/growth/prospects/import` (from **Import CSV**). Title **Pilot CSV import**, link **All prospects**.

1. **CSV file** (hint "Up to 2000 rows and 2 MB. The first row must be the column names."). Choosing a file shows "N rows read. Check the column mapping, then preview." Errors: "The file is larger than 2 MB. Split it and import in parts." and "The file needs a header row and at least one data row."
2. **Map the columns** (appears after a file is read): one dropdown per field, each guessed from the headers, with **Not in the file** as the blank choice. Fields: **Company name (required)**, **Website or domain**, **Sector**, **City**, **Country**, **Known scale (SAR)**, **Contact name**, **Contact job title**, **Contact email**, **Contact phone**, **Contact LinkedIn**, **Decision-maker (yes or no)**, **Lead title**, **Deal size (SAR)**, **Service**, **Pipeline stage**, **Last outreach date**, **Last outreach channel**, **Outreach note**, **Notes**. Button **Preview and dry run** (reads **Checking**; disabled until **Company name** is mapped). Result: "Dry run: N rows would import and N would be skipped. Nothing was written."
3. **Dry run** card: totals, then a table **Line**, **Company** ("On file" when it exists), **Contact** (**Suppressed** badge), **Lead and outreach**, **Checks** (**Import** or **Skip**, with problems in red and warnings in amber). Skipped rows are shaded red.
4. Confirmation tick box: "I have checked the dry run. Import N rows as source Pilot." then **Import** (reads **Importing**; disabled until ticked and while nothing would import). **Change mapping** returns to step 2. Success: "Imported: N companies, N contacts, N leads, N past outreach records." plus "N rows failed; see below." when some fail.

**Past imports** table (when any exist): **When**, **File**, **Created**, **Skipped**.

## 4. Outreach

**URL:** `/admin/growth/outreach`
**For:** "Draft, approve and track personalised outreach."

Header link: **Nurture sequence and lead magnets** (opens 4a).

**Jobs card:**
- A badge: **Sending from your mailbox** (green) or **Mail in mock mode: nothing is delivered** (amber). **Sending paused in Settings** (red) shows while outreach sending is paused.
- **Check replies**, **Draft due follow-ups**, **Send scheduled now**. Each shows its result line. "These also run each morning at 09:00 Riyadh time."
- A link **Include test and sample rows** (or **Hide test and sample rows**), then a sentence giving the current sending days and window, the daily cap, follow-up days, the follow-up maximum, and "Every email carries an opt-out link; suppressed addresses are never sent to." In mock mode it ends with a **Mock** badge and "Drafts come from the mock AI until the Anthropic key is set."

**Ready to draft (N)**: "Leads at Prospect or Contacted with no message waiting, highest Prospect Score first, then the freshest trigger. Every draft cites the trigger shown." Empty: "Nothing waiting. Convert signals into leads and add a contact to each." Each row: company (opens the lead page), score badge, contact, the trigger it would cite, and "Blocked: ..." in red listing any of: "no contact on the lead", "no email (LinkedIn only)", "suppressed: never contactable", "no trigger with a real evidence link". Buttons **Draft email** (navy; disabled when blocked or there is no email) and **Draft LinkedIn** (disabled when blocked). Both read **Drafting** while working. Success: "Mock draft added below (no Anthropic key is set)." or "Draft added below for your approval."

**Drafts to approve (N)**, **Approved, scheduled and failed (N)**, **Recently sent**. Empty lines: "No drafts waiting.", "Nothing waiting to send.", "Nothing sent yet."

**Each message card** shows a status badge (draft, approved, scheduled, sent, failed, rejected, cancelled), channel and kind ("Email first touch", "Email follow-up 2" and so on), **Mock**, **Mock send: not delivered**, **Test**, "Replied <time>", the company (opens the lead page), "to <name> <email>", and "Cites: <trigger summary> evidence. Links to <path>". Then the subject and body. Lines that appear when they apply: "Fill in before approving: [Project], ..." (amber; a draft with placeholders left), "Scheduled for <time> Riyadh time.", "Sent <time>." ("by hand" for LinkedIn), the rejection or cancellation reason or error in red, and, when real mail is connected, "Written by the mock AI: it can never be sent for real. Reject it and draft again."

Buttons by status:
- **Edit** (draft, approved, scheduled): opens **Subject** (email only) and **Message** (hint "[Link] becomes the tracked link. The opt-out line is added to every email when it is sent."), with **Save** and **Cancel**. Success: "Saved." for a draft; "Saved. It needs approving again." for an approved or scheduled message.
- **Approve** (draft only; disabled while placeholders other than [Link] remain). Success: "Approved."
- **Send (mock)** in mock mode, **Send now** with real mail (email, approved or scheduled). Results: "Recorded as sent in mock mode: nothing was delivered.", "Scheduled for <time> (Riyadh): outside the sending window or over today's cap.", or "Sent from your mailbox." With real mail, the button is disabled on a mock draft.
- **Copy text** and **Mark sent** (LinkedIn, approved). Copy: "Copied. Send it on LinkedIn, then mark it sent." Mark sent: "Marked as sent on LinkedIn."
- **Mark replied** (sent, no reply yet): opens **What they said (optional)** with **Confirm** and **Back**. Success: "Reply recorded: the sequence has stopped."
- **Reject** (draft) or **Cancel** (approved or scheduled), in red: opens **Reason (required)** with **Confirm** (disabled under 3 characters) and **Back**. Success: "Done."

Server refusals you may see: "Fill these in first: ...", "The email needs a subject", "<email> is suppressed: it can never be sent", "Outreach sending is paused in Settings", "This lead already has a message waiting. Approve, send or reject it first.", "Add a contact to the lead first", "No trigger with a real evidence link for this company. Add or attach a signal first: every draft must cite one.", "The agent needs approved Knowledge Base items first: messaging, disallowed.", "No monthly AI budget is set. Set one in Growth Settings before any AI runs."

### 4a. Nurture
**URL:** `/admin/growth/outreach/nurture`. Title **Nurture**, header link **Outreach**.

- Badges: **Nurture on** or **Nurture off in Settings**; **Brevo connected** or **Mock mode: GROWTH_BREVO_LIST_ID not set, nothing is sent**.
- **Sync to Brevo** and **Run the sequence now**. In mock mode the run lists what would be sent, each line with a **Mock** badge: "Step N to <contact> (<email>): <subject>".

**The sequence**: each step shows "Step N: <subject>", a status badge and "N days after the previous", with **Edit**, **Approve** (when not approved; success "Approved.") and **Archive** (red; acts at once, no confirmation; success "Archived."). At the foot, **Add a step**. Step form: **Step**, **Days after the previous**, **Links to (site path)** (placeholder "/insights"), **Subject**, **Body** (hint "[First name] and [Link] are filled when sent. The opt-out line is added to every email."), button **Save step**. Success: "Saved as a draft: approve it before it is sent." Saving an approved step returns it to draft.

**Lead magnets**: each shows its title and status, **Edit**, **Approve** (when not approved), and once approved a dropdown **Send to an opted-in contact** with **Send**. At the foot, **Add a lead magnet**. Form: **Title**, **Link to the file or page** (hint "https:// or a site path"), **Description**, **Email subject**, **Email body** (hint "[First name] and [Link] are filled when sent"), button **Save lead magnet**.

**Subscribed contacts (N)**: **Contact**, **Step sent**, **Next**, **Brevo** ("Synced <time>" or "Not yet"). Empty: "No one yet. Contacts who opt in on the website chat are subscribed; opted-in contacts can be subscribed from their company page."

## 5. Pipeline

**URL:** `/admin/growth/pipeline` (board) or `/admin/growth/pipeline?view=table`
**For:** "Every lead and opportunity from first contact to won or lost."

Header buttons **Board** and **Table** (the current one is filled navy). Board is the default.

**Filter bar:** **Temperature** (Any, **Hot**, **Warm**, **Cold**, **Not scored**), **Service** (Any or one of the nine), **Source**, **Search** (placeholder "Lead title"), **Include test rows**, **Filter**.

**Board:** one column per stage, from **Prospect** to **Nurture**, each with its count. Each card: company (opens the lead page), lead title, a temperature badge with Lead Score, or the band badge when no Lead Score yet, **Under SAR 50m**, **Test**, the open opportunity value, "Next due <date>" (red when overdue), and a stage dropdown. Changing the dropdown shows a small **Move** button; choosing **Lost** also shows a "Why it was lost" box, and **Move** stays disabled until it has 3 characters. Success: "Moved." On a phone the board scrolls sideways one column at a time.

**Table:** **Lead**, **Stage** ("since <date>"), **Score**, **Service and size**, **Opportunity**, **Next due**, **Source**. There is no empty message: with no leads the table is blank.

### 5a. Lead page
**URL:** `/admin/growth/pipeline/<id>`. Eyebrow "Growth Engine: Lead", header links **Company** and **Pipeline**.

**Lead** card: stage badge, **Below SAR 50 million**, **Test**; **Service**, **Deal size**, **Timeline**, **Source**, **Sequence** (status, next follow-up, why it stopped), **Next action** (when set); the requirement. Then:
- The stage dropdown with **Move**, as on the board.
- **Referral partner** (**None** or a partner) and **Referral source** (placeholder "Who or what referred them") with **Save referral**. Success: "Saved."
- Tick box **Asked for a meeting**. Saves at once: "Saved; the Lead Score is updated."
- **Edit lead** (the lead form from 3b; here its **Contact** list holds only the lead's current contact).

**Scores** card: "Prospect Score:" badge; "Lead Score:" badge, or "set once the lead engages (a reply, click, chat, meeting or meeting request)"; reasons; a factor table (**ICP fit**, **Clear need**, **Scale**, **Timeline**, **Authority**, **Engagement**, **Meeting intent**); "Scored on the N points that are known, scaled to 100."

**Opportunities**: each shows a status badge, service, fee band, expected close and lost reason, with **Edit**. At the foot **Open an opportunity**. Form: **Service**, **Expected fee** (**Not known yet**, **Under SAR 100,000**, **SAR 100,000 to 250,000**, **SAR 250,000 to 500,000**, **SAR 500,000 to 1 million**, **Over SAR 1 million**), **Expected close**, **Status** (**Open**, **Won**, **Lost**), **Lost reason (required)** (only when Lost; 3 characters), **Notes**; **Save opportunity** and **Cancel**. On success the form closes and the opportunity is listed.

**Tasks**: each task is a tick box with its title and "due <date>" (red when overdue); ticking saves at once and strikes it through. Empty: "No tasks." Add: **New task**, **Due**, **Add task** (disabled until titled). Success: "Task added."

**Messages**: every message for the lead as the Outreach cards above. **Draft email** and **Draft LinkedIn** appear here only while the lead is at **Prospect**. Empty: "No messages yet."

**Timeline**: as on the company page.

## 6. Conversations

**URL:** `/admin/growth/conversations`
**For:** "Website chat transcripts and qualification answers."

Header link **Valuation tool leads** (6b).

**Status card:** a badge **Off: nothing is added to the website**, **Switched on, but hidden: no Anthropic key**, or **Live on the website**; **Mock mode** while there is no key; link **Chat settings** (opens the Website chat card in Settings). Then a paragraph on what the chat does and never does.

**Try it** card: "As if on the page" with a path box (default `/services/refm`) and **Restart preview**. Below it, the chat exactly as a visitor sees it, in mock mode while there is no key: a message box "Type your question" and **Send**; the details form appears as "Leave your details for Ahmad" with **Send details** and **Not now**. "Preview conversations are saved as test rows and never alert you."

**List:** filter links **All**, **Hot**, **Warm**, **Cold**, **Escalated**, **None**, then **Include test** (or **Hide test**). Previews are test rows, so they only show with **Include test**. Empty: "No conversations yet." Columns **Started** (opens the transcript), **Visitor** ("Anonymous" without consent; **From outreach**, **Mock**, **Test** badges), **Route** (raw word, plus the score), **Page**, **Messages**.

### 6a. Conversation
**URL:** `/admin/growth/conversations/<id>`. Title is the visitor's name, "Visitor" or "Anonymous visitor"; link **All conversations**.
- **Qualification** card: "Route: ...", temperature and score, status, **Mock**, **Test**; each qualification answer; "Escalated: ..." and "You were alerted <time>." when they apply.
- **Visitor and consent** card: contact details and "Consented <time> to: "<wording>"", or "No consent given: no contact details are stored, and any typed into the chat were removed."; links **Lead** and **Company** when linked; **Close conversation** (until closed; success "Closed.").
- **Transcript**: every message with role, time, "(mock)" and any flag.

### 6b. Valuation tool leads
**URL:** `/admin/growth/conversations/valuation`. Read only on the tool's records. **Link every eligible lead** (result "Linked N; N skipped (already linked, no consent, or suppressed)."). Table **Date**, **Person**, **Deal size band** (**Below minimum**), **Consent** (**Follow-up consent** or **None**), **Growth** (**Linked lead** link, or **Link to Growth**, disabled without consent; success "Linked."). Empty: "No valuation leads yet."

## 7. Meetings

**URL:** `/admin/growth/meetings`
**For:** "Booked discovery calls, meeting briefs and follow-ups."

Top card: badge **Microsoft Bookings connected** or **Bookings in mock mode: sync is a preview**; **Sync Microsoft Bookings** (reads **Syncing**; in mock mode lists sample bookings with **Mock** badges and saves nothing); **Add a call by hand**; "Bookings sync and briefs for the next two days also run each morning at 09:00 Riyadh time." and a link **Include test rows** / **Hide test rows**.

**Add a call by hand** form: **Lead** (**Match by attendee email** or an open real lead), **Attendee name** and **Attendee email** (only when matching by email), **Date**, **Time (Riyadh)** (default 10:00), **Minutes** (default 45), **Join link**; **Add call** (disabled until date and time) and **Cancel**. On success the form closes, the call is listed and its lead moves to **Meeting Booked**.

Sections: **Past calls needing notes (N)** (red; only when a past call still shows scheduled), **Upcoming** ("No calls booked."), **Last 90 days** ("No past calls."). Columns **When (Riyadh)** (opens the meeting; "was <time>" when moved), **Who** (Microsoft Bookings or Added by hand), **Status**, **Brief** ("Ready", "Mock brief" or "Not yet").

### 7a. Meeting page
**URL:** `/admin/growth/meetings/<id>`. Links **Lead** and **All meetings**.
- Status and source badges, attendee, "Moved from ...", **Join link**, "Their note: ...".
- **Prepare the brief** (or **Prepare the brief again**). Success: "Brief prepared." or "Mock brief prepared."
- **Draft the recap email** (only once the call is recorded as held) and **Draft a rebooking email** (only after a no show).
- **The call** (**Held**, **No show**, **Cancelled**), **Outcome** (when Held: **Positive: next step agreed**, **Proposal requested**, **Needs a follow-up**, **Not a fit**, **Other**), **Why (required)** (when Not a fit), **Notes**, and **Save notes and outcome**. Success: "Saved. The lead has moved on." Afterwards a badge "Recorded: <outcome>".
- **Brief** card: "Not prepared yet. It is made automatically two days before the call, or now with the button.", or **Company**, **Trigger**, **Activity so far**, **Requirement and size**, **Likely services**, **Open questions**, **Recommended next action**.
- **Recap and rebooking emails**: the drafts as Outreach cards, approved and sent the same way.

## 8. Partners

**URL:** `/admin/growth/partners`
**For:** "Referral partners, past clients and introductions."

- **Add a partner or past client**. Form: **Name** (required), **Type** (**Referral partner**, **Past client**, **Bank or lender**, **Law firm**, **Advisor**, **Developer**, **Other**), **Organisation**, **Email**, **Phone**, **Check in every (days)** (hint "Blank uses the default, N"), **Status** (**Active**, **Paused**, **Inactive**), **Notes**; **Save** and **Cancel**. A new partner opens its page.
- "You get one reminder email each morning listing the check-ins due."
- **Check-ins due (N)** (only when any are due): links to each partner.
- Type links: **All** and each type.
- Table **Partner**, **Type**, **Last check-in**, **Next** (red when due). Empty: "No partners yet."

### 8a. Partner page
**URL:** `/admin/growth/partners/<id>`. Link **All partners**.
- **Details**: contact details, "Check in every N days. Last ..., next ...", notes, **Edit** (the same form).
- **Check-ins**: **Check-in note** (placeholder "What you talked about") and **Log a check-in**. Success: "Logged. Next check-in <date>."
- **Introductions**: **Record an introduction**, and **Update** on each. Form: **Company**, **Date**, **Direction** (**They introduced a prospect to us** or **We introduced someone to them**), **Outcome** (**Pending**, **Meeting held**, **Proposal**, **Won**, **Lost**, **No response**), **Notes**, and (new, to us) tick box "Open a lead with this partner as its referral source" (ticked by default); **Save introduction**.
- **Leads referred (N)**: links to each lead. Empty: "None yet."

## 9. Knowledge Base

**URL:** `/admin/growth/knowledge-base`
**For:** "Approved services, offers, case studies and AI rules. AI agents read approved items only, and only their approved copy."

**Readiness tiles**, one per type, each reading "N of M approved" (green when all are approved). Clicking a tile filters to that type (`?kind=service` and so on). The ten types: **Services**, **Entry offers**, **Case studies**, **Credentials and methodology**, **FAQs**, **Messaging**, **Disallowed content**, **Qualification**, **Escalation rules**, **Targeting rules**.

**Filter bar:** **Type** (**All types** or one), **Status** (**Any status**, **Draft**, **Approved**, **Archived**), **Filter** and **Clear**.

**One card per type**, with its purpose line and, for every type except **Services** and **Entry offers** (which are fixed), an **Add ...** button that opens the new item screen. Empty: "Nothing here yet." (or "No approved items." and so on when a status filter is on).

Columns: the type's title name (Service, Offer, Internal name, Topic, Question, Name, Never say), **Status**, **Last edited**, **Approved by** ("Never" when never approved), and an actions column. In the title cell: the item (a link to its editor), a green **Priority** badge on services ticked as priority in Settings, and for services the site page link. In the status cell: **Draft**, **Approved** or **Archived**, plus an amber **Unapproved edits** badge.

Row actions:
- Draft: **Approve** and **Archive**.
- Approved with unapproved edits: **Approve** and **Archive**.
- Approved, no edits: **Archive** only.
- Archived: **Restore** only.

**Approve** is faded and disabled while the item is incomplete; the reason is only in its hover text ("Not ready: ..."). Each action opens a confirmation dialog (wording under 9a).

### 9a. Knowledge Base item editor
**URL:** `/admin/growth/knowledge-base/<id>` (click an item's title). Link at the top: "Back to <type>". Eyebrow "Knowledge Base, <type in lower case>"; the title; and one of these descriptions:
- "Draft. AI agents do not read it until it is approved."
- "Approved. AI agents read this item."
- "Approved, with unapproved edits. AI agents read the approved copy below until you approve again."
- "Archived. AI agents do not read it."

On a wide screen the editor is on the left and two cards are on the right; when the content area is narrower than about 860 pixels (a tablet in portrait, or a phone) the two cards stack under the editor, so you scroll past the whole editor to reach them.

**Editor card** (left). Fields for each type; "(required to approve)" is part of the label where it applies. List fields take one entry per line (hint "One per line.").

| Type | Title label | Other fields |
|---|---|---|
| Services | **Service** | **Site page** (a fixed link to /services/<slug>, or "No site page: this is not one of the site services." in red), **Description**, **Ideal client**, **Typical use cases** (list), **Deliverables** (list), **Sectors** (list). All required. |
| Entry offers | **Offer** | **Related services** (pill tick boxes, one per site service; not required), **Scope**, **Who it suits**, **Upsell path**. All three required. |
| Case studies | **Internal name** | **Case study record** (required; "Choose a case study", or "No case studies yet: add one under Case Studies"), **When to use it** (required; hint "Internal only. Which prospects or situations this case study suits."). |
| Credentials and methodology | **Topic** | **Text** (required). |
| FAQs | **Question** | **Answer** (required). |
| Messaging | **Name** | **Tone guidance** (required), **Phrases to use** (list), **Phrases to avoid** (list). |
| Disallowed content | **Never say** | **Detail and examples** (required), **What to do instead**. |
| Qualification | **Name** | **Questions to ask** (list, required), **Offer a meeting when** (required). |
| Escalation rules | **Topic** | **How to hand over** (required). |
| Targeting rules | **Name** | **Decision-maker job titles** (list), **Work PMBC will not take on** (list), **Notes**. At least one of the two lists is needed to approve. |

Every type's title is required to approve.

Under the fields, while anything is missing: "Before approving: <problems>." The problems read "<Field> is empty", "Choose the case study record", "Add decision-maker titles or excluded work" or "This service is not one of the site services". It updates as you type.

Buttons, bottom left of the editor card:
- **Save** (green). Disabled until something changes. Reads **Saving**. Success: "Saved as a draft." or, on an approved item, "Saved. AI agents keep the approved copy until you approve again."
- **Approve** (to the right of Save). Disabled and faded while "Before approving" lists anything (hover text "Not ready: ..."). Click opens the dialog **Approve this item?** "The current wording becomes the approved copy that every AI agent reads, replacing any earlier approved copy. The approval is logged with your name and the time." Buttons **Cancel** and **Approve**. Unsaved edits are saved first. No success line appears; the page refreshes.
- **Archive** (red text). Dialog **Archive this item?** "AI agents stop reading it straight away. It stays here, archived, and can be restored as a draft." Buttons **Cancel** and **Archive**.
- On an archived item the fields are locked, an amber note reads "Archived. Restore it as a draft to edit it.", and the only button is **Restore**: dialog **Restore this item?** "It returns as a draft. AI agents will not read it until it is approved again." Buttons **Cancel** and **Restore**.

Errors from the server show in red under the buttons: "Not ready to approve: ...", "Restore the item before approving it", "Restore the item before editing it".

**Approved copy** card (right): "Never approved.", or "Approved by <name> on <time>." and the frozen title, links and fields that agents read.

**History** card: every logged change with who and when. Empty: "Nothing logged yet."

### 9b. New Knowledge Base item
**URL:** `/admin/growth/knowledge-base/new?kind=<type>` (from an **Add ...** button). Title "New <type>", with "It starts as a draft: AI agents do not read it until you approve it." The editor as above, with **Create draft** instead of Save and no Approve until it is created. Creating opens the item's editor.

## 10. Analytics

**URL:** `/admin/growth/analytics`
**For:** "Funnel performance by source, sector, trigger and service."

Header link **Scoring review**. Period links: **Last 30 days**, **Last 90 days** (default), **Last 12 months**, **All time**.

Tiles: **Prospects added**, **Messages sent** (note "N mock sends not counted"), **Reply rate**, **Website chats**, **Qualification rate**, **Meetings**, **Proposals**, **Wins**, **AI cost (USD)**, **Cost per qualified lead** ("n/a" when there are none).

**Funnel** table (one row, "Leads created in the period"), then **By** with links **Source**, **Sector**, **Trigger**, **Contact title**, **Service**, **Entry offer**, **City**, each giving a table: **Leads**, **Contacted**, **Replied**, **Qualified**, **Meetings**, **Proposals**, **Won**, **Lead to meeting**. Footnote: "Real records only. A lead counts at a stage if it is there now or passed through it. Mock sends are not counted as sent."

### 10a. Scoring review
**URL:** `/admin/growth/analytics/scoring`. Link **Analytics**.
- **Review the Prospect Score** (navy) and **Review the Lead Score**. Each shows "N positive and N negative outcomes.", the conversion by band, and a factor table (**Factor**, **Share when won or met**, **Share when lost or silent**, **Weight now**, **Suggested**). With too few outcomes the line gives the reason instead. A suggestion is saved: "New weights suggested below and saved for your decision."
- Each saved review: kind, status badge, date and counts, the factor table, then while pending **Approve new weights**, a box "Note (required to reject)" and **Reject** (disabled until the note has 3 characters). Success: "Approved: the new weights are in force and companies rescore as they change." or "Rejected: the weights are unchanged." No confirmation dialog.

## 11. Settings

**URL:** `/admin/growth/settings`
**For:** "Send limits, suppression list, AI budget and audit log."

Four tabs under the header, wrapping on a narrow screen: **Limits, budget and retention**, **Signals, scoring, website and AI**, **Suppression list**, **Audit log**.

### 11a. Limits, budget and retention
**URL:** `/admin/growth/settings`. "Last changed <date> by <name>." at the top.

One form across three cards, saved together by one button at the bottom.

**Outreach limits**
| Field | Accepts |
|---|---|
| **Daily cold email cap** | 1 to 500. Hint "New cold emails per day, across all contacts." |
| **Sending starts** / **Sending ends** | a time; hint "Saudi time (Asia/Riyadh)." End must be after start. |
| **Follow-up days** | numbers that increase, for example 4, 10, 20 (1 to 365; one to ten of them) |
| **Maximum follow-ups per contact** | 0 to 10, not more than the number of follow-up days |
| **Sending days** | tick pills **Sunday** to **Saturday**; at least one |
| **Priority services for outreach** | tick pills, one per site service. Hint "The site's nine services. Outreach and scoring favour the ones ticked." |

**AI budget**
| Field | Accepts |
|---|---|
| **Monthly budget (USD)** | more than 0, up to 100,000; blank means not set (placeholder "Not set"). Hint "Until a budget is set, AI agents will not run (enforced from Unit 1.5)." |
| **Alert at (percent of budget)** | 1 to 100 |
| **Alert recipient** | an email address |

Then "Spent this month (<month>, Riyadh time): USD N of USD N. Mock calls cost nothing."

**Retention**: **Keep contacts who never replied for (months)**, 1 to 120. Hint "The preview below uses the saved value. Nothing is deleted in this version."

**Save settings** (green): disabled until something changes, and while a value is invalid; the first problem shows in red beside it (for example "Follow-up days must increase, for example 4, 10, 20", "The sending window must end after it starts", "Maximum follow-ups cannot exceed the number of follow-up days", "The budget must be more than zero", "Choose at least one sending day", "Enter a valid email address"). Success: "Saved. The change is in the audit log."

Below the form:
- **AI calls** card: badge **Mock mode** or **Claude API**, an explanation, **Run a test AI call** (shows **Mock output** and **Succeeded** or **Refused**), and the last ten calls: **When**, **Agent** (the internal agent key and model), **Outcome** (succeeded, refused, failed; **Mock**; **Test**; the reason), **Cost (USD)**.
- **Retention preview: N contacts**: who would fall outside the retention period. "Read only: nothing is deleted or anonymised."
- **Integrations**: **Claude API**, **Microsoft Graph (email)**, **Microsoft Bookings**, **Brevo**, **Brevo nurture**, each **Configured**, **Mock mode** or **Not set up**, with the variable names (never values).

### 11b. Signals, scoring, website and AI
**URL:** `/admin/growth/settings/engine`. Nine cards plus the keyword library, each with its own save button. Each card's button shows "Saved." or a specific message underneath.

1. **Daily signal feed**: **Most signals kept per run** (1 to 50), tick box **Pause the feed**; **Save feed settings**.
2. **Signal keywords** (the library; section anchor `#keywords`). Intro, then "N of M keywords in use." and, until the first change, " Showing the defaults: your first change saves them." Eleven groups: **New project**, **Real estate and off-plan**, **Fundraising and debt**, **Transactions**, **Capital markets**, **Market entry**, **Finance leadership**, **Contract awards**, **Expansion and capex**, **Distress and restructuring** (off by default), **Wider GCC (UAE, Dubai, Abu Dhabi, Qatar, Doha, Kuwait, Bahrain, Oman)** (off by default). Each group is a collapsed row: a tick box, the name, an **On** or **Off** badge and "Suggests <trigger> · N of M keywords on · N signals". Click the name to open it. Inside, each keyword has a tick box, the text, its trigger, a count badge "N signals" (hover text "Real signals this keyword has found"), **Added** for your own keywords, **Edit** (text box, trigger dropdown, **Save**, **Cancel**) and **Remove** (red; turns into **Confirm remove** and **Keep**). At the foot of the group: a box "Add a keyword", a trigger dropdown and **Add** (needs 2 characters). Under the groups: **Reset to defaults**, which asks "Restore every default keyword and group setting, and remove the keywords you added?" with **Confirm reset** and **Cancel**. **Every change in the library saves at once**; there is no save button. Success lines: '"<name>" switched on.' / 'switched off.', "Keyword saved.", '"<keyword>" added.', '"<keyword>" removed.', "Keywords reset to the defaults."
3. **Prospect Score weights**: seven number boxes (**Geography**, **Sector**, **Project signal**, **Funding or transaction signal**, **Scale**, **Decision-maker**, **Recency**, each with a hint), "Total N of 100" (green at 100, red otherwise), **Save weights** (disabled unless 100).
4. **Sector tiers**: five boxes, each "<tier> (per cent)" with a **Priority sector** tick box: **Real estate**, **Infrastructure, energy and industrial**, **Investment**, **Healthcare, education and services**, **Any other sector**. Rules shown in red when broken: "Each tier must be a whole number from 0 to 100, below the one above it." and "Mark at least one tier as priority." **Save sector tiers** (disabled while either rule is broken). Success: "Sector tiers saved. Scores update as each company or lead next changes, or with Rescore now."
5. **Outreach and Lead Score**: tick box **Pause all outreach sending**, seven weights (**ICP fit**, **Clear need**, **Scale**, **Timeline**, **Authority**, **Engagement**, **Meeting intent**) with "Total N of 100", **Save outreach settings** (disabled unless the total is 100).
6. **Website chat** (anchor `#chat-settings`): tick box **Show the chat on the website**, **Most messages per conversation** (4 to 100), **Most new conversations per visitor a day** (1 to 100), **Alerts for Hot leads and escalations go to**, **Consent wording** (hint "Shown beside the consent box and recorded with every consent"). Hidden until you tick the switch on: an amber tick box "I understand the chat will appear on every public page as soon as the Anthropic key is set." (with the key set: "within a minute"). **Save chat settings** stays disabled until that is ticked. Success: "Saved. The chat is switched on." or "Saved. The chat is off."
7. **Website chat: opening by itself**: **Open by itself**, **Delay (seconds)** (5 to 300), **Scroll point (% of the page)** (10 to 100); the two boxes are greyed while **Open by itself** is off. **Save opening settings**. Success: "Saved. Pages pick it up within a minute."
8. **Booking link**: **Direct Microsoft Bookings link (optional)** (placeholder "Empty: the site's /book page is used"; must be https:// or empty), "Now in use: ...", **Save meeting settings**.
9. **Nurture and partners**: **Send the nurture sequence**, **Default partner check-in (days)** (7 to 730). When switching nurture on, an amber tick box "I understand approved steps will be emailed to subscribed contacts once GROWTH_BREVO_LIST_ID is set." must be ticked. **Save nurture settings**.
10. **AI models by agent**: one dropdown per agent (**Research Agent**, **Daily signal feed**, **Outreach writer**, **Website chat**, **Meeting brief**, **Meeting recap**), each "Default (<model>)" or a priced model; **Save models**.

A card whose migration is missing shows "Needs <file> applied before these can be saved. Shown with their defaults." and greys its fields. None should today.

### 11c. Suppression list
**URL:** `/admin/growth/settings/suppression`. Description: "Emails and domains that must never be contacted. Suppression always wins: every send checks this list, the valuation tool's unsubscribes and opted-out contacts first." Link **Show test entries** / **Hide test entries**.

**Add to the list**: **Type** (**Email** or **Domain**), **Email** or **Domain** (placeholder "name@example.com" or "example.com"), **Reason** (placeholder "Why it must never be contacted"), **Suppress** (green; disabled until value and reason are filled). Success: "Suppressed <value>." For a shared provider such as gmail.com the server refuses first and an amber box appears: "Shared email provider." with the server's message and a tick box "I understand this blocks everyone at this domain."; tick it and click **Suppress** again.

**Import existing opt-outs** with its explanation. Result: "Found N valuation tool unsubscribes and N Growth contact opt-outs. Added N, already suppressed N."

**Suppressed (N)** and **Removed (N)** tables: **Email or domain**, **Reason**, **Source**, **Added**. **Remove** (red) opens "Reason for removing" with **Cancel** and **Remove** (disabled until a reason is typed). Success: "Removed. The entry stays in the history below." Empty: "Nothing is suppressed yet." / "No entries have been removed."

### 11d. Audit log
**URL:** `/admin/growth/settings/audit`. Description: "Everything that happens in the Growth Engine, newest first: settings, suppression, the Knowledge Base, and later every AI action."

Filters: **Type** (**All types**, **AI calls**, **Settings**, **Suppression**, **Knowledge Base**, **Leads**, **Signals**, **Contacts**, **Companies**, **Research briefs**, **Signal feed**, **Imports**, **Outreach**, **Pipeline**, **Website chat**, **Meetings**, **Nurture**, **Partners and referrals**, **Scoring review**), **Actor** (**Anyone**, **Ahmad (admin)**, **AI agent**, **System**), **From**, **To**, **Related to** (**Anything**, or a company, lead or Knowledge Base item, grouped), **Show test rows**, **Filter**, **Clear**.

Table **When** (to the second), **What** (summary, **Test**, the internal action name in small grey type, and for settings changes one line per field "field: old to new"), **Who** (your name, "AI agent: <agent>", or "System"). Empty: "Nothing matches these filters." Footer: "N entries" and, past 50, **Newer**, "Page N of M", **Older**.

---

# Part 2: click paths

## A. Approve one Knowledge Base item

Example: the **Messaging** guide, which the outreach writer needs. If none exists yet you create it first (steps 3 and 4); a service is the same from step 5 with different fields.

1. Sidebar **Growth**, then the sub-nav pill **Knowledge Base** (`/admin/growth/knowledge-base`). On a phone: menu button, **Growth**, then swipe the pill row left to reach **Knowledge Base**.
2. Click the tile **Messaging** ("0 of 0 approved"), or set **Type** to **Messaging** and click **Filter**.
3. If the card says "Nothing here yet.", click **Add messaging guide** on the right of the **Messaging** card. This opens `/admin/growth/knowledge-base/new?kind=messaging`, titled "New messaging guide".
4. Fill **Name (required to approve)** and **Tone guidance (required to approve)**. **Phrases to use** and **Phrases to avoid** are optional lists, one per line. Click **Create draft** (green). The item's own editor opens.
   For an existing item, click its title in the table instead.
5. The editor: header description "Draft. AI agents do not read it until it is approved." Left card holds the fields; the right cards are **Approved copy** ("Never approved.") and **History**. On a phone those two cards are below the editor.
6. Fill every field marked "(required to approve)" (see the table in 9a for each type). Watch the grey line "Before approving: ..." under the fields: it lists what still blocks approval and disappears when nothing does.
7. Click **Save** (green, bottom left of the editor card). You see "Saved as a draft." **Saving changes only your working copy. No agent reads a draft.**
8. Click **Approve** (to the right of **Save**). If it is faded, something is still missing: read the "Before approving" line (on a computer the same reason is in the button's hover text, "Not ready: ..."; on a phone there is no hover, so use the line).
9. The dialog **Approve this item?** opens. Click **Approve** (or **Cancel**). If you had unsaved changes they are saved first, so what is approved is exactly what is on screen.
10. If the server refuses, a red line under the buttons reads "Not ready to approve: <problems>" (for example "Tone guidance is empty") or "Restore the item before approving it".
11. How to tell it worked (there is no success message; the page simply refreshes):
    - The header description now reads "Approved. AI agents read this item."
    - **Approved copy** shows "Approved by <you> on <date and time>." with the wording.
    - **History** has a new line.
    - Back on the list ("Back to Messaging"), the row shows a green **Approved** badge, your name and time under **Approved by**, and the tile reads "1 of 1 approved".

Shortcut: the list row also has **Approve**. It approves the saved working copy without opening the editor, behind the same dialog.

Which items each agent needs: research needs **Services** and **Entry offers**; outreach drafts need **Messaging** and **Disallowed content**; the Prospect Score reads **Targeting rules**; the website chat reads services, disallowed content, qualification and escalation.

## B. Edit an already approved item

1. Knowledge Base, click the item's title.
2. Change a field. Click **Save**. The message is "Saved. AI agents keep the approved copy until you approve again."
3. What "unapproved edits" looks like:
   - Editor header: "Approved, with unapproved edits. AI agents read the approved copy below until you approve again."
   - **Approved copy** still shows the old wording, which is what agents use.
   - In the list, the status cell shows **Approved** and an amber **Unapproved edits** badge, and the row's actions change from **Archive** alone to **Approve** and **Archive**.
4. To publish the edit, click **Approve** and confirm. The amber badge goes, and **Approved copy** shows the new wording with the new time.
5. To abandon the edit, there is no undo button: type the approved wording back (it is shown in **Approved copy**) and **Save**; the badge disappears when the two match.

## C. Add a signal by hand and triage it

1. Sub-nav **Signals** (`/admin/growth/signals`).
2. Click **Add a signal**.
3. Fill **Trigger**, **Date**, either **Existing company** or **Company name**, **Evidence link** (a real https page), **Summary** (10 characters or more), and optionally **Source name**. If a line "Fits the keyword ..." appears, click **Use it** to take the suggested trigger, or ignore it.
4. Click **Add signal**. Expect "Signal added to the inbox." (or the duplicate wording). Click **Close** to fold the form.
5. The signal is in the **New** tab list. In its **Triage** column:
   - To change its trigger: pick from the dropdown; "Trigger changed."
   - To make it a prospect: **Convert**, leave **Company** on **Create a new company** (or pick one), check **New company name**, optionally **Website domain** and **Lead title**, then **Convert to prospect**. "Converted: the company and lead are in Prospects."
   - To link it to a company already on file: **Attach**, choose **Company**, optionally **Lead**, then **Attach**.
   - To drop it: **Dismiss**, type a **Reason** of 3 characters or more, **Dismiss signal**.
6. A converted, attached or dismissed signal leaves the **New** tab. Find it under **Converted**, **Attached**, **Dismissed** or **All**. **Reopen** is on attached and dismissed signals.

## D. Add a company and a contact by hand

1. Sub-nav **Prospects**, then **New company** (the navy button in the header, beside **Import CSV**).
2. Fill **Company name** (required) and anything else known. **Known scale (SAR)** takes 450m or 1.2bn.
3. Click **Create company**. The company page opens.
4. In the **Contacts** card, click **Add contact**.
5. Fill **Name** (required), and **Job title**, **Email**, **Phone**, **LinkedIn**, **Consent**, **Consent source**, **Decision-maker** as known.
6. Click **Add contact** (the button at the foot of the form has the same name as the one that opened it). The form closes and the contact appears in the **Contacts** list. There is no success message; if something is wrong the form stays open with a red line, for example "<Name> already uses <email>".
7. To work it through Outreach it also needs a lead: in the **Leads** card, **Open a lead**, give a **Title**, choose the **Contact**, then **Open lead**.

## E. Run research on a company and accept part of the brief

Needs: a monthly AI budget (11a) and at least one approved item under both **Services** and **Entry offers**. Otherwise the red line reads "The agent needs approved Knowledge Base items first: service, offer." or "No monthly AI budget is set. Set one in Growth Settings before any AI runs."

1. Prospects, click the company.
2. Scroll to **Research briefs**, click **Run research**. It reads "Researching (this can take a minute)".
3. In mock mode you get "A mock brief was added (no Anthropic key is set)." The brief carries a **Mock** badge and the note that it cannot be accepted: **there is no accept section on a mock brief, so this task cannot be finished until the Anthropic key is set.**
4. With the key set: "A research brief was added below." Read it; every fact has numbered source links.
5. Under **Accept into the profile**, tick only what you want, for example **Sector** and **Recent triggers as signals**.
6. Click **Accept selected**. Expect "Accepted: ..." naming what was applied, and possibly "Skipped: ...". The brief now shows a green "Accepted: ..." badge; the profile, contacts or signals update.

## F. Change a score override

1. Prospects, click the company.
2. In **Prospect Score**, click **Override score**. (If you see **Clear override** instead, an override already exists: click it first, then **Override score**.)
3. Type **Score (0 to 100)** and **Reason (required)**, at least 5 characters.
4. Click **Set score** (disabled until both are valid). "Manual score set."
5. The badge shows your score; the card reads "Set by hand: <reason>. The rules give N."; the Prospects list shows "Set by hand" under the score.
6. To go back to the rules score: **Clear override**. "Override cleared; the rules score applies."

## G. Generate, edit and approve an outreach draft, then send it in mock mode

Needs: an AI budget, approved **Messaging** and **Disallowed content** items, and a lead at **Prospect** or **Contacted** with a contact that has an email and a company with a signal carrying a real evidence link.

1. Sub-nav **Outreach**.
2. Under **Ready to draft**, find the lead. If it shows "Blocked: ...", fix what it names first.
3. Click **Draft email**. "Mock draft added below (no Anthropic key is set)."
4. The draft appears under **Drafts to approve** with a **Mock** badge. The mock text fills the first name and company but leaves **[Project]**, so an amber line reads "Fill in before approving: [Project]" and **Approve** is disabled.
5. Click **Edit**. Change **Subject** if wanted and replace "[Project]" in **Message** with the real project name. Leave **[Link]** as it is: it becomes the tracked link.
6. Click **Save**. "Saved."
7. Click **Approve**. "Approved." The card moves to **Approved, scheduled and failed**.
8. Click **Send (mock)**. Either:
   - "Recorded as sent in mock mode: nothing was delivered." The card moves to **Recently sent** with an amber **Mock send: not delivered** badge. The lead is not marked contacted.
   - or, outside the sending window or over the daily cap, "Scheduled for <time> (Riyadh): outside the sending window or over today's cap." It then goes at the next window (the morning run, or **Send scheduled now** once inside the window).
   - or, while outreach is paused, the red line "Outreach sending is paused in Settings".

To try this on the sample records without touching real ones: open `/admin/growth/outreach?test=1`. Each SAMPLE lead already has a mock draft under **Drafts to approve**, so start at step 4. A new draft for a sample lead is refused while its first one is waiting ("This lead already has a message waiting. Approve, send or reject it first.").

## H. Change the AI budget, the daily send cap and the sector tiers

1. Sub-nav **Settings**. The first tab, **Limits, budget and retention**, is open.
2. In **Outreach limits**, change **Daily cold email cap** (1 to 500).
3. In **AI budget**, change **Monthly budget (USD)**.
4. Click **Save settings** at the bottom (green). "Saved. The change is in the audit log." If it stays disabled, read the red message beside it.
5. Click the tab **Signals, scoring, website and AI**.
6. Scroll to **Sector tiers** (the fourth card). Change any "(per cent)" box; each tier must be lower than the one above it. Tick or untick **Priority sector**; at least one must stay ticked.
7. Click **Save sector tiers**. "Sector tiers saved. Scores update as each company or lead next changes, or with Rescore now."

The three saves are separate: the budget and cap save with **Save settings** on the first tab, the tiers with their own button on the second.

## I. Open and edit the keyword library, including switching a group off

1. **Settings**, tab **Signals, scoring, website and AI** (`/admin/growth/settings/engine#keywords`).
2. Scroll to the second card, **Signal keywords**. It reads "N of M keywords in use."
3. To switch a whole group off: click the tick box at the left of the group row (not the name). It saves at once: '"<group>" switched off.' The badge turns to **Off**.
4. To open a group: click its name. The keywords list opens.
5. To switch one keyword off: untick its box. Saves at once.
6. To edit one: **Edit**, change the text or trigger, **Save**. "Keyword saved."
7. To add one: type in "Add a keyword" at the foot of the group, choose its trigger, **Add**.
8. To remove one: **Remove**, then **Confirm remove** (or **Keep**).
9. To undo everything: **Reset to defaults**, then **Confirm reset**.

There is no save button for the library: every click above is saved immediately and logged.

## J. Run the signal feed manually while paused

1. Check the pause: **Settings**, tab **Signals, scoring, website and AI**, card **Daily signal feed**, tick box **Pause the feed**. It is ticked by default.
2. Sub-nav **Signals**. The feed panel text includes "(paused)".
3. Click **Run the feed now**. It reads **Searching**.
4. Without the Anthropic key the result is "Mock preview: nothing was saved. With an Anthropic key the same run adds real signals." and a list headed by a **Mock** badge, "Sample output about made-up companies; nothing was saved."
5. With the key and the feed paused: "Preview: the feed is paused, so nothing was saved. Switch it on in Settings to add signals." with the real list, each marked **kept** "(would be kept (preview only))", **duplicate**, **discarded** or **over limit**.
6. The run appears under "Last runs:" and in Recent activity, but no signal is added. It needs a budget set; otherwise the result is the budget message.

## K. Turn the website chat on and off

On:
1. **Settings**, tab **Signals, scoring, website and AI**, card **Website chat** (or the **Chat settings** link on Conversations).
2. Tick **Show the chat on the website**.
3. An amber tick box appears: "I understand the chat will appear on every public page as soon as the Anthropic key is set." Tick it.
4. Click **Save chat settings**. "Saved. The chat is switched on."
5. Check on **Conversations**: the badge reads "Switched on, but hidden: no Anthropic key" until the key is set, then "Live on the website".

Off:
1. Same card, untick **Show the chat on the website**.
2. **Save chat settings** (no confirmation needed). "Saved. The chat is off."
3. Conversations shows "Off: nothing is added to the website".

To try the chat without switching it on: **Conversations**, card **Try it**.

## L. Find the sample records using the test view

The three companies are named "SAMPLE: Al Waha Real Estate Development", "SAMPLE: Gulf Horizon Logistics" and "SAMPLE: Najd Hospitality Group". They are test rows, hidden everywhere by default and never counted on Home, the Daily Brief or Analytics.

| Screen | How to show test rows | Direct URL |
|---|---|---|
| Prospects | tick **Include test rows**, click **Filter** | `/admin/growth/prospects?test=1` |
| Signals | click the **All** tab, tick **Include test rows**, **Filter** | `/admin/growth/signals?status=all&test=1` |
| Outreach | link **Include test and sample rows** | `/admin/growth/outreach?test=1` |
| Pipeline | tick **Include test rows**, **Filter** | `/admin/growth/pipeline?test=1` |
| Conversations | link **Include test** | `/admin/growth/conversations?test=1` |
| Meetings | link **Include test rows** | `/admin/growth/meetings?test=1` |
| Audit log | tick **Show test rows**, **Filter** | `/admin/growth/settings/audit?test=1` |
| Suppression | link **Show test entries** | `/admin/growth/settings/suppression?test=1` |
| Partners | no link; URL only | `/admin/growth/partners?test=1` |

Every test row carries a grey **Test** badge. Opening a SAMPLE company shows its contact, signal, lead, mock research brief and score.

## M. Read the Daily Brief and the audit log

Daily Brief:
1. Sub-nav **Home**. The **Daily Brief** is the first card, dated for today in Riyadh.
2. Read top down: **Now** first, then **Today**, then **Soon**. Each line says what to do and, after "Why:", the record that caused it.
3. Click the bold title to go straight to the lead, meeting, conversation, partner or list.
4. "Nothing needs you today." means no real record needs action. Sample rows never appear here.

Audit log:
1. **Settings**, tab **Audit log** (or **Full audit log** at the foot of Recent activity on Home).
2. Newest first. **When** to the second; **What** is the plain summary with the internal action name beneath; **Who** is you, an AI agent, or System.
3. Settings changes list each field as "field: old to new".
4. Narrow with **Type**, **Actor**, **From**, **To** or **Related to**, then **Filter**; **Clear** resets.
5. 50 rows a page: **Older** and **Newer** at the bottom right.

---

# Rough edges

What is confusing, badly labelled or missing, with what I would change. Nothing here has been changed.

1. **"Add faq" and "New faq".** Knowledge Base lowercases the type name for its buttons and titles, so FAQs read "Add faq", "New faq" and the eyebrow "Knowledge Base, faq". Use the singular as written ("Add FAQ").
2. **Why Approve is disabled is hover-only on the Knowledge Base list.** The faded **Approve** button explains itself only in hover text, which a phone never shows. Show the "Not ready" reason as text under the row, as the editor does.
3. **No confirmation after a Knowledge Base approval.** The page just refreshes. Add a green line such as "Approved. AI agents now read this copy."
4. **Refusal messages use internal type keys.** "The agent needs approved Knowledge Base items first: service, offer." (and "messaging, disallowed") do not match the on-screen names **Services**, **Entry offers**, **Messaging**, **Disallowed content**. Map the keys to the labels and link to the Knowledge Base.
5. **Validation errors start with field keys** such as `summary:`, `evidence_url:`, `company_name:`, `linkedin_url:`. Show the on-screen label instead, or no prefix.
6. **Raw lowercase status words** in many badges: signal status (new, converted), company **Status** on the profile (new), message status (draft, sent), meeting status (no show), conversation route (hot), opportunity status (open), scoring review (pending), partner status. The filters use capitalised labels. Use the same labels in both places.
7. **Research cannot be accepted in mock mode.** Task E stops at a mock brief with no accept section. Say so on the button's help text ("In mock mode the brief is a sample and cannot be accepted").
8. **Internal jargon in a hint.** The budget hint says "(enforced from Unit 1.5)". Drop the unit reference.
9. **Audit log description is out of date.** "and later every AI action" (AI actions are already logged). Remove "later".
10. **AI calls table shows agent keys** (research-agent, outreach-writer) rather than the names used in **AI models by agent** (Research Agent, Outreach writer).
11. **Two "Priority" ideas.** The Prospect band **Priority**, **Priority services for outreach** and **Priority sector** are three different things on nearby screens. Consider "Focus services" and "Focus sectors".
12. **Lead page "Edit lead" lists only the current contact.** To give a lead a different contact you must go to the company page. Load all the company's contacts on the lead page too.
13. **Pipeline table view has no empty message.** With no leads it shows a blank table; the board just shows empty columns. Add "No leads match." as other lists do.
14. **Partners has no test-row link**, unlike every other list. Add "Include test rows".
15. **Partner form has no LinkedIn field**, though a partner record has one.
16. **Inconsistent save models on one tab.** On Signals, scoring, website and AI, the keyword library saves every click immediately, while every other card needs its own save button. Add a line at the top of the library card: "Changes here save as you click."
17. **Pausing outreach is tied to the Lead Score weights.** **Pause all outreach sending** saves only through **Save outreach settings**, which stays disabled unless the seven weights total 100. If weights were ever mid-edit, pausing would be blocked. Give the pause its own save button, or split the card.
18. **No confirmation on actions that matter.** **Send now** (with real mail connected, this emails a prospect), **Approve new weights** in Scoring review, and nurture step **Archive** act on one click, while Knowledge Base archive has a dialog. Add a confirmation at least to **Send now** and **Approve new weights**.
19. **Forms that close on save show no confirmation.** Add contact, Edit contact, Open a lead, Edit lead, Edit profile, and the opportunity, partner, introduction and add-a-call forms close as soon as they save, so their success line ("Contact added.", "Lead saved." and so on) is never seen. "Add contact" is also the label of both the button that opens the form and the one that submits it. Show the success line after the form closes, and name the submit "Save contact".
20. **Meetings "Add a call by hand" lists real leads only**, so a call cannot be added against a SAMPLE lead for practice.
21. **Home "Data layer" card is developer-facing.** Table names and row counts are useful in a build, not day to day. Move it to Settings, or collapse it.
22. **Knowledge Base editor on a phone.** The **Approved copy** and **History** cards stack below a long form. Add a link at the top of the editor ("See the approved copy") or put them in a tab.
23. **Sub-nav on a phone hides most pills.** Eleven pills in one sideways-scrolling row with no visible scroll cue; **Knowledge Base** and **Settings** start off screen. Add a fade at the right edge, or a dropdown on narrow screens.
24. **Archived items show by default.** The archived Feasibility Studies service sits in the **Services** card beside the nine live ones, so the card shows ten rows for nine services. Hide archived items unless the **Archived** status filter is chosen.
