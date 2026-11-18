/**
 * Calendar reminders as a standard .ics file (RFC 5545), made on the phone. Nothing goes through a server.
 * By default the title is neutral ("Appointment", "Reminder"), so a calendar on a shared phone says nothing
 * about men's health. The person can choose to show details.
 */
export interface CalendarEvent {
  id: string
  title: string
  /** "YYYY-MM-DD" for an all-day reminder, or local "YYYY-MM-DDTHH:mm". */
  start: string
  minutes?: number
  details?: string
  /** Minutes before the event for the alert (default: a day before). */
  alertBefore?: number
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Lines longer than 75 octets are folded, as the standard requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (size + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const compact = (s: string) => s.replace(/[-:]/g, '')
const pad = (n: number) => String(n).padStart(2, '0')

function addMinutes(local: string, minutes: number): string {
  const [d, t] = local.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const dt = new Date(y, m - 1, day, hh, mm + minutes)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1, 12)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function toIcs(events: CalendarEvent[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wiqaya//Companion//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const e of events) {
    const allDay = !e.start.includes('T')
    lines.push('BEGIN:VEVENT', `UID:${e.id}@wiqaya`, `DTSTAMP:${stamp}`)
    if (allDay) lines.push(`DTSTART;VALUE=DATE:${compact(e.start)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.start))}`)
    else lines.push(`DTSTART:${compact(e.start)}00`, `DTEND:${compact(addMinutes(e.start, e.minutes ?? 30))}00`)
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.details) lines.push(`DESCRIPTION:${esc(e.details)}`)
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.alertBefore ?? 1440}M`, 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(name: string, events: CalendarEvent[]): void {
  const blob = new Blob([toIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
