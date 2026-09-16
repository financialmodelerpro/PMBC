/**
 * Shown above a tool page that the public cannot see, to signed-in staff only.
 *
 * Deliberately loud: amber, full width, and stating the consequence (a 404 for
 * everyone else, submissions saved as test leads), so a screenshot of a preview
 * is never mistaken for the live site.
 */
export function AdminPreviewBanner({ reason, manageHref }: { reason: string; manageHref: string }) {
  return (
    <div role="status" className="border-b border-[#E0B64A] bg-[#FEF3C7] px-6 py-3 text-[14px] text-[#78350F]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <p>
          <strong className="mr-2 uppercase tracking-[0.12em]">Admin preview</strong>
          {reason} Submissions made here are saved as test leads.
        </p>
        <a href={manageHref} className="font-semibold underline underline-offset-2">
          Manage visibility
        </a>
      </div>
    </div>
  );
}
