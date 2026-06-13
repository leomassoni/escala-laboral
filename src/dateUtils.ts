export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export function startOfWeek(dateValue: string | Date) {
  const sourceDate = typeof dateValue === 'string' ? new Date(`${dateValue}T12:00:00`) : new Date(dateValue)
  const day = sourceDate.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDays(sourceDate, mondayOffset)
}

export function endOfWeek(dateValue: string | Date) {
  return addDays(startOfWeek(dateValue), 6)
}

export function getWeekDates(dateValue: string | Date) {
  const weekStart = startOfWeek(dateValue)
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function getMonthWeeks(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1, 12)
  const lastDay = new Date(year, month, 0, 12)
  const cursor = startOfWeek(firstDay)
  const finalWeekEnd = endOfWeek(lastDay)
  const weeks: Date[][] = []

  while (cursor <= finalWeekEnd) {
    weeks.push(getWeekDates(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  return weeks
}

export function getMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

export function formatWeekLabel(weekDates: Date[]) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })

  return `${formatter.format(weekDates[0])} a ${formatter.format(weekDates[6])}`
}

export function formatDayHeader(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
  }).format(date)
}

export function formatDateLabel(dateValue: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateValue}T12:00:00`))
}
