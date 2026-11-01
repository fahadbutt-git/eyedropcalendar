// Splits a schedule into printed pages that fit a letter landscape sheet.
import { MONTHS, addDays, fmtShort } from "../../lib/dates.js";

// Height budget in CSS pixels (7.75 in of printable height at 96 px per inch).
const PAGE = 745;
const SIZES = {
  standard: { header: 112, qr: 40, thead: 32, compactRow: 26, fullRow: 66, cols: 3, dayLabel: 28, dose: 21, perLine: 7, maxWeeks: 5 },
  large: { header: 124, qr: 56, thead: 42, compactRow: 36, fullRow: 92, cols: 2, dayLabel: 42, dose: 32, perLine: 4, maxWeeks: 2 },
};

function monthWeeks(year, month) {
  const cells = Array(new Date(year, month, 1).getDay()).fill(null);
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

function weeksFrom(start, end) {
  const weeks = [];
  for (let d = addDays(start, -start.getDay()); d <= end; d = addDays(d, 7))
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

// Month pages are the most familiar, so they are used when each month fits on
// a page and the plan fills most of its first and last month. Otherwise pages
// hold whole weeks starting from the week of the start date, spread evenly.
// Page 1 carries the full legend when it fits, otherwise the short one.
// `peaks` holds each drug's highest number of doses in a day, so drugs with
// many doses get the extra lines their tick boxes wrap onto.
export function buildPages({ size, start, span, peaks, qr = false }) {
  const count = peaks.length;
  const z = SIZES[size];
  const base = PAGE - z.header - z.thead - 16;
  const legendRows = Math.ceil(count / z.cols);
  const calendarOnly = base - legendRows * z.compactRow;
  // The QR box makes the first page header taller.
  const withLegend = base - legendRows * z.fullRow - (qr ? z.qr : 0);
  const rowNeed = z.dayLabel + peaks.reduce((h, p) => h + z.dose * Math.max(1, Math.ceil(p / z.perLine)), 0);
  const fitWeeks = Math.max(1, Math.floor(calendarOnly / rowNeed));

  let pages = null;
  if (size === "standard" && start.getDate() <= 7 && (span.months.length === 1 || span.end.getDate() >= 21)) {
    const months = span.months.map(({ year, month }) => ({ title: `${MONTHS[month]} ${year}`, weeks: monthWeeks(year, month), month }));
    if (months.every((m) => m.weeks.length <= fitWeeks)) pages = months;
  }
  if (!pages) {
    const weeks = weeksFrom(start, span.end);
    const perPage = Math.ceil(weeks.length / Math.ceil(weeks.length / Math.min(z.maxWeeks, fitWeeks)));
    pages = [];
    for (let i = 0; i < weeks.length; i += perPage) {
      const chunk = weeks.slice(i, i + perPage);
      const last = chunk.at(-1)[6];
      pages.push({ title: `${fmtShort(chunk[0][0])} to ${fmtShort(last)}, ${last.getFullYear()}`, weeks: chunk, month: null });
    }
  }

  const combined = pages[0].weeks.length * rowNeed <= withLegend;
  pages.forEach((p, i) => {
    const room = combined && i === 0 ? withLegend : calendarOnly - (qr && i === 0 ? z.qr : 0);
    p.rowHeight = Math.max(rowNeed, Math.floor(room / p.weeks.length) - 2);
  });
  return { pages, combined };
}
