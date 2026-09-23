'use client';

import { useState } from 'react';

import { CompanyForm, type CompanyFormValues } from './CompanyForm';
import { ContactForm, emptyContact, type ContactValues } from './ContactForm';
import { LeadForm, emptyLead, type LeadValues } from './LeadForm';
import { GhostButton } from '../ui/kit';

/** Buttons that open a form in place, for the server-rendered company page. */

export function EditCompanyButton({ id, initial }: { id: string; initial: CompanyFormValues }) {
  const [open, setOpen] = useState(false);
  return open ? <CompanyForm id={id} initial={initial} onDone={() => setOpen(false)} /> : <GhostButton onClick={() => setOpen(true)}>Edit profile</GhostButton>;
}

export function ContactButton({ companyId, contactId, initial, label }: { companyId: string; contactId?: string; initial?: ContactValues; label: string }) {
  const [open, setOpen] = useState(false);
  return open ? <ContactForm companyId={companyId} contactId={contactId} initial={initial ?? emptyContact} onDone={() => setOpen(false)} /> : <GhostButton onClick={() => setOpen(true)}>{label}</GhostButton>;
}

export function LeadButton({ companyId, leadId, initial, contacts, label }: { companyId: string; leadId?: string; initial?: LeadValues; contacts: { id: string; full_name: string }[]; label: string }) {
  const [open, setOpen] = useState(false);
  return open ? <LeadForm companyId={companyId} leadId={leadId} initial={initial ?? emptyLead} contacts={contacts} onDone={() => setOpen(false)} /> : <GhostButton onClick={() => setOpen(true)}>{label}</GhostButton>;
}
