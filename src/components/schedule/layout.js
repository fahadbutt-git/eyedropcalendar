// Splits a schedule into printed pages that fit a letter landscape sheet.
import { MONTHS, addDays, fmtShort } from "../../lib/dates.js";

// Height budget in CSS pixels (7.75 in of printable height at 96 px per inch).
const PAGE = 745;
// Each print size: its scale on paper (--s, in px at 96 per inch), how many
// weeks a page holds, and how many tick boxes fit on a line in a day cell.
// Heights below are in units of that scale, matching the sheet styles.
export const PRINT_SIZES = {
  standard: { s: 0.17 * 96, maxWeeks: 2, perLine: 4, cols: 3, dose: 1.95, months: false, marks: "roomy", label: "Two weeks a page", hint: "Clear and roomy. The default" },
  large: { s: 0.22 * 96, maxWeeks: 1, perLine: 3, cols: 2, dose: 1.95, months: false, marks: "roomy", label: "Large print, one week a page", hint: "For low vision" },
  compact: { s: 0.15 * 96, maxWeeks: 5, perLine: 6, cols: 3, dose: 1.46, months: true, marks: "small", label: "A month a page", hint: "Fewest pages, smallest print" },
};
const UNITS = { header: 7.8, qr: 2.8, thead: 2.2, compactRow: 1.9, fullRow: 4.9, dayLabel: 1.95 };
const sizeOf = (size) => {
  const p = PRINT_SIZES[size] || PRINT_SIZES.standard;
  return { ...p, ...Object.fromEntries(Object.entries(UNITS).map(([k, v]) => [k, v * p.s])), dose: p.dose * p.s };
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
// `changes` marks drugs that start, change or stop, which adds a line for the
// "Now 3x" or "Stop" marker on those days.
// `measured` holds the heights the sheet's header and legends actually take on
// screen, in units of the sheet scale (see useSheetMeasure). They replace the
// estimates once known, since long taper wording can wrap onto extra lines.
export function buildPages({ size, start, span, peaks, changes = [], qr = false, measured = {} }) {
  const count = peaks.length;
  const z = sizeOf(size);
  const legendRows = Math.ceil(count / z.cols);
  const header = measured.header ? measured.header * z.s : z.header;
  // The QR box makes the first page header taller.
  const qrExtra = !qr ? 0 : measured.headerQr ? Math.max(0, measured.headerQr * z.s - header) : z.qr;
  const fullLegend = measured.full ? measured.full * z.s : legendRows * z.fullRow;
  const shortLegend = measured.compact ? measured.compact * z.s : legendRows * z.compactRow;
  const thead = measured.thead ? measured.thead * z.s : z.thead;
  const base = PAGE - header - thead - 28;
  const calendarOnly = base - shortLegend;
  const withLegend = base - fullLegend - qrExtra;
  const rowNeed = z.dayLabel + peaks.reduce((h, p, i) => h + z.dose * (Math.max(1, Math.ceil(p / z.perLine)) + (changes[i] ? 1 : 0)), 0);
  const fitWeeks = Math.max(1, Math.floor(calendarOnly / rowNeed));

  let pages = null;
  if (z.months && start.getDate() <= 7 && (span.months.length === 1 || span.end.getDate() >= 21)) {
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
    const room = combined && i === 0 ? withLegend : calendarOnly - (i === 0 ? qrExtra : 0);
    // A row never takes more than its share of the page; the marks shrink to
    // fit instead (fitMarks), so a busy week cannot push onto another sheet.
    p.rowHeight = Math.max(z.dayLabel * 2, Math.floor(room / p.weeks.length) - 2);
  });
  // One size of marks across every page, so the pages look alike.
  const marks = fitMarks(z, peaks, changes, Math.min(...pages.map((p) => p.rowHeight)));
  pages.forEach((p) => Object.assign(p, marks));
  return { pages, combined };
}

// Printable width of a day cell in px (10.3 in across, 7 days, less the cell
// padding), with a little kept spare.
const cellWidth = (z) => ((10.3 * 96) / 7 - 0.75 * z.s) * 0.95;
// In units of the sheet scale: a tick box with its gap, the marker with its
// gap and the row's padding, one dose line, and a "Now 3x" note. The month
// page starts from smaller marks so a whole month fits.
const MARKS = {
  roomy: { box: 1.37, mark: 2.55, line: 1.98, note: 0.95 },
  small: { box: 1.11, mark: 2.1, line: 1.6, note: 0.8 },
};

// Sizes the marks and tick boxes in each day cell to fill the room the page
// leaves: larger for a sparse plan, smaller (down to MIN_SCALE) for a busy
// one, so it always fits. Tries each number of boxes per line and keeps
// whichever allows the biggest marks.
const MIN_SCALE = 0.6;
// How many sheets the checklist table takes. Its column headings repeat on
// every sheet, the first also carries the header and short legend, and a row
// never splits across sheets. Measured heights are used when known,
// otherwise a row count per size.
const CHECKLIST_ROWS = { standard: 19, large: 12, compact: 22 };
export function checklistPageCount({ size, days, measured = {} }) {
  const z = sizeOf(size);
  const { header, compact, chkHead, chkRows } = measured;
  if (!chkHead || chkRows?.length !== days) return Math.ceil(days / CHECKLIST_ROWS[size]);
  const head = chkHead * z.s;
  let room = PAGE - ((header || 0) + (compact || 0)) * z.s - head - 28;
  let pages = 1;
  for (const h of chkRows) {
    if (h * z.s > room) {
      pages += 1;
      room = PAGE - head;
    }
    room -= h * z.s;
  }
  return pages;
}

export function fitMarks(z, peaks, changes, rowHeight) {
  const { box: BOX, mark: MARK, line: LINE, note: NOTE } = MARKS[z.marks];
  let best = { scale: 0, perLine: z.perLine };
  for (let per = 1; per <= 6; per++) {
    const lines = peaks.reduce((h, p, i) => h + LINE + (Math.max(1, Math.ceil(p / per)) - 1) * BOX + (changes[i] ? NOTE : 0), 0);
    const byWidth = cellWidth(z) / (z.s * (MARK + Math.min(per, Math.max(...peaks, 1)) * BOX));
    const byHeight = (rowHeight - z.dayLabel) / (z.s * lines);
    const scale = Math.min(2.2, byWidth, byHeight);
    if (scale > best.scale + 0.01) best = { scale: Math.floor(scale * 100) / 100, perLine: per };
  }
  return { ...best, scale: Math.max(MIN_SCALE, best.scale) };
}
