export type TimePeriod = 'AM' | 'PM'

export type SchedulePreviewInput = {
  startTime: string
  startPeriod: TimePeriod
  breakStart: string
  breakStartPeriod: TimePeriod
  breakEnd: string
  breakEndPeriod: TimePeriod
  endTime: string
  endPeriod: TimePeriod
}

export function normalizeAbbreviation(value: string) {
  const compact = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .trim()
    .toUpperCase()

  if (compact.length >= 3) {
    return compact.slice(0, 3)
  }

  return (compact + 'XXX').slice(0, 3)
}

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, '$1-$2')
}

export function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 1) {
    return digits
  }

  if (digits.length === 2) {
    return digits
  }

  if (digits.length === 3) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function normalizeTypedTime(value: string, currentPeriod: TimePeriod) {
  const digits = value.replace(/\D/g, '').slice(0, 4)

  if (digits.length < 4) {
    return {
      time: formatTimeInput(digits),
      period: currentPeriod,
    }
  }

  const rawHours = Number(digits.slice(0, 2))
  const rawMinutes = Number(digits.slice(2))

  if (rawMinutes > 59 || rawHours > 24 || (rawHours === 24 && rawMinutes > 0)) {
    return {
      time: formatTimeInput(digits),
      period: currentPeriod,
    }
  }

  if (rawHours <= 12) {
    return {
      time: `${digits.slice(0, 2)}:${digits.slice(2)}`,
      period: 'AM' as const,
    }
  }

  const normalizedHour = rawHours === 24 ? 12 : rawHours - 12

  return {
    time: `${String(normalizedHour).padStart(2, '0')}:${digits.slice(2)}`,
    period: 'PM' as const,
  }
}

function isCompleteTimeInput(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export function normalizeLocationValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizeSequentialTimes(values: number[]) {
  const result: number[] = []

  values.forEach((value, index) => {
    if (index === 0) {
      result.push(value)
      return
    }

    let candidate = value
    while (candidate <= result[index - 1]) {
      candidate += 24 * 60
    }
    result.push(candidate)
  })

  return result
}

export function parseTime(value: string, period: TimePeriod) {
  if (!isCompleteTimeInput(value)) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (hours < 0 || hours > 24 || minutes > 59) {
    return null
  }

  if (hours === 24 && minutes > 0) {
    return null
  }

  if (period === 'AM') {
    if (hours === 0 && minutes === 0) {
      return null
    }

    if (hours > 12) {
      return null
    }

    if (hours === 12 && minutes > 0) {
      return null
    }

    return hours * 60 + minutes
  }

  if (hours >= 13 && hours <= 24) {
    return hours * 60 + minutes
  }

  if (hours === 0 || hours > 12) {
    return null
  }

  if (hours === 12) {
    if (minutes === 0) {
      return 24 * 60
    }

    return hours * 60 + minutes
  }

  return (hours + 12) * 60 + minutes
}

export function buildSchedulePreview(values: SchedulePreviewInput) {
  const issues: string[] = []
  const labels = [
    ['startTime', 'Horario de inicio'],
    ['breakStart', 'Inicio de pausa'],
    ['breakEnd', 'Fim de pausa'],
    ['endTime', 'Fim do turno'],
  ] as const

  labels.forEach(([field, label]) => {
    if (!isCompleteTimeInput(values[field])) {
      issues.push(`${label}: digite exatamente 4 numeros no formato 0000.`)
    }
  })

  const start = parseTime(values.startTime, values.startPeriod)
  const breakStart = parseTime(values.breakStart, values.breakStartPeriod)
  const breakEnd = parseTime(values.breakEnd, values.breakEndPeriod)
  const end = parseTime(values.endTime, values.endPeriod)

  if (isCompleteTimeInput(values.startTime) && start === null) {
    issues.push('Horario de inicio invalido para o periodo selecionado.')
  }

  if (isCompleteTimeInput(values.breakStart) && breakStart === null) {
    issues.push('Inicio de pausa invalido para o periodo selecionado.')
  }

  if (isCompleteTimeInput(values.breakEnd) && breakEnd === null) {
    issues.push('Fim de pausa invalido para o periodo selecionado.')
  }

  if (isCompleteTimeInput(values.endTime) && end === null) {
    issues.push('Fim do turno invalido para o periodo selecionado.')
  }

  if ([start, breakStart, breakEnd, end].some((item) => item === null)) {
    return { netMinutes: undefined, issues }
  }

  const safeStart = start as number
  const safeBreakStart = breakStart as number
  const safeBreakEnd = breakEnd as number
  const safeEnd = end as number

  const [normalizedStart, normalizedBreakStart, normalizedBreakEnd, normalizedEnd] =
    normalizeSequentialTimes([safeStart, safeBreakStart, safeBreakEnd, safeEnd])

  if (
    !(
      normalizedStart < normalizedBreakStart &&
      normalizedBreakStart < normalizedBreakEnd &&
      normalizedBreakEnd < normalizedEnd
    )
  ) {
    issues.push('A sequencia de inicio, pausa e fim do turno esta invalida.')
    return { netMinutes: undefined, issues }
  }

  const netMinutes =
    normalizedEnd - normalizedStart - (normalizedBreakEnd - normalizedBreakStart)

  if (netMinutes <= 0) {
    issues.push('A jornada liquida precisa ser maior que zero.')
    return { netMinutes: undefined, issues }
  }

  return { netMinutes, issues }
}
