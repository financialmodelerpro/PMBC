/**
 * Text and list limits the lead API enforces, shared with the form so the form
 * can never accept what the server refuses. Before 2026-09-21 the form had none
 * of these: a 121 character name or a 26th peer passed in the browser, the save
 * was refused with 400, and the visitor saw results with no saved lead, no
 * email and no PDF, and no message saying why.
 */
export const LIMITS = {
  peers: 25,
  peerName: 120,
  gateName: 120,
  gateEmail: 200,
  gateCompany: 160,
} as const;
