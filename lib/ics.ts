export interface ParsedEvent {
  title: string;
  date: string; // YYYY-MM-DD
}

/** iCal lines can be folded with a leading space/tab on continuation lines. */
function unfold(text: string): string {
  return (text || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/** Handles DTSTART formats like 20250714, 20250714T090000Z, 20250714T090000. */
function parseDate(value: string): string | null {
  const digits = (value || "").replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Parses a raw .ics file's text into a flat list of events. Never
 * throws: malformed blocks are simply skipped rather than aborting the
 * whole import.
 */
export function parseIcs(icsText: string): ParsedEvent[] {
  try {
    const text = unfold(icsText || "");
    const events: ParsedEvent[] = [];
    const blocks = text.split("BEGIN:VEVENT").slice(1);

    for (const block of blocks) {
      try {
        const body = block.split("END:VEVENT")[0] || "";
        const summaryMatch = body.match(/SUMMARY:(.*)/);
        const dateMatch = body.match(/DTSTART[^:]*:(\S+)/);
        if (!summaryMatch || !dateMatch) continue;
        const date = parseDate(dateMatch[1]);
        if (!date) continue;
        events.push({
          title: summaryMatch[1].trim().replace(/\\,/g, ",").replace(/\\;/g, ";"),
          date,
        });
      } catch {
        continue;
      }
    }

    return events;
  } catch {
    return [];
  }
}
