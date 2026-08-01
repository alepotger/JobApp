/* Content for the weekly digest. Pure: takes rows and a clock, returns text. */

export type DigestRow = {
  id: string;
  company: string;
  role: string;
  status: string;
  activity: string;
};

export type Report = {
  count: number;
  oldestDays: number;
  items: Array<{ company: string; role: string; status: string; days: number }>;
  interviews: number;
  offers: number;
};

const DAY = 86400000;

/* Only stages where the ball is plausibly in your court. "To apply" has not
   been sent, and "Closed" is finished. */
const LIVE = ["applied", "replied", "interview"];

const STAGE_LABEL: Record<string, string> = {
  "to-apply": "To apply",
  applied: "Applied",
  replied: "Replied",
  interview: "Interview",
  offer: "Offer",
  closed: "Closed",
};

export const daysSince = (iso: string, now: number): number =>
  Math.floor((now - new Date(iso).getTime()) / DAY);

export function staleReport(rows: DigestRow[], now: number, staleAfter: number): Report {
  const stale = rows
    .filter((r) => LIVE.includes(r.status) && daysSince(r.activity, now) >= staleAfter)
    .map((r) => ({
      company: r.company.trim() || "Untitled application",
      role: r.role.trim(),
      status: STAGE_LABEL[r.status] || r.status,
      days: daysSince(r.activity, now),
    }))
    .sort((a, b) => b.days - a.days);

  return {
    count: stale.length,
    oldestDays: stale.length ? stale[0].days : 0,
    items: stale,
    interviews: rows.filter((r) => r.status === "interview").length,
    offers: rows.filter((r) => r.status === "offer").length,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const digestSubject = (report: Report): string =>
  report.count === 0
    ? "Your pipeline is up to date"
    : `${plural(report.count, "application", "applications")} awaiting follow-up`;

/* The headline the brief asked for, phrased so it reads correctly at n=1. */
export function headline(report: Report): string {
  if (report.count === 0) return "Nothing is awaiting follow-up. Everything live has been touched recently.";
  return (
    `You have ${plural(report.count, "app", "apps")} awaiting follow-up. ` +
    `Last touched ${plural(report.oldestDays, "day", "days")} ago.`
  );
}

export function digestText(report: Report): string {
  const lines = [headline(report), ""];

  for (const item of report.items) {
    const role = item.role ? ` — ${item.role}` : "";
    lines.push(`• ${item.company}${role} · ${item.status} · ${plural(item.days, "day", "days")} ago`);
  }

  if (report.interviews || report.offers) {
    lines.push("");
    const bits = [];
    if (report.interviews) bits.push(`${plural(report.interviews, "interview", "interviews")} in progress`);
    if (report.offers) bits.push(`${plural(report.offers, "offer", "offers")} on the table`);
    lines.push(bits.join(" · "));
  }

  return lines.join("\n").trim();
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );

export function digestHtml(report: Report, appUrl: string): string {
  const rows = report.items
    .map((item) => {
      const role = item.role ? ` — ${escapeHtml(item.role)}` : "";
      return (
        `<tr><td style="padding:6px 0;border-bottom:1px solid #ded7c5">` +
        `<strong>${escapeHtml(item.company)}</strong>${role}<br>` +
        `<span style="color:#7a7365;font-size:12px">${escapeHtml(item.status)} · ` +
        `${plural(item.days, "day", "days")} ago</span></td></tr>`
      );
    })
    .join("");

  const link = appUrl
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(appUrl)}" ` +
      `style="color:#8a6d28">Open the tracker</a></p>`
    : "";

  return (
    `<div style="font-family:system-ui,sans-serif;color:#545454;max-width:520px">` +
    `<p style="font-size:16px;margin:0 0 16px">${escapeHtml(headline(report))}</p>` +
    (rows ? `<table style="width:100%;border-collapse:collapse">${rows}</table>` : "") +
    link +
    `</div>`
  );
}
