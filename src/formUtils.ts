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

function normalizeAbbreviationSource(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function normalizeAbbreviation(value: string) {
  const compact = normalizeAbbreviationSource(value).replace(/\s+/g, '')

  if (compact.length >= 3) {
    return compact.slice(0, 3)
  }

  return (compact + 'XXX').slice(0, 3)
}

function buildAbbreviationCandidates(value: string) {
  const normalized = normalizeAbbreviationSource(value)
  const words = normalized.split(' ').filter(Boolean)
  const compact = words.join('')
  const candidates = new Set<string>()

  if (words.length >= 3) {
    candidates.add(words.slice(0, 3).map((word) => word[0]).join(''))
  }

  if (words.length >= 2) {
    candidates.add(`${words[0][0]}${words[1].slice(0, 2)}`)
    candidates.add(`${words[0].slice(0, 2)}${words[1][0]}`)
    candidates.add(
      `${words[0][0]}${words.slice(1).map((word) => word[0]).join('')}`.slice(0, 3),
    )
  }

  if (words.length >= 1) {
    candidates.add(words[0].slice(0, 3))
  }

  if (words.length >= 2) {
    candidates.add(`${words[0].slice(0, 1)}${words[1].slice(0, 1)}${words[0].slice(1, 2)}`)
    candidates.add(`${words[0].slice(0, 1)}${words[1].slice(0, 1)}${words[1].slice(1, 2)}`)
  }

  for (let index = 0; index <= Math.max(0, compact.length - 3); index += 1) {
    candidates.add(compact.slice(index, index + 3))
  }

  const consonants = compact.replace(/[AEIOU]/g, '')
  if (consonants.length >= 3) {
    candidates.add(consonants.slice(0, 3))
  }

  return Array.from(candidates)
    .map((candidate) => candidate.replace(/[^A-Z0-9]/g, '').slice(0, 3))
    .filter((candidate) => candidate.length > 0)
    .map((candidate) => candidate.padEnd(3, 'X'))
}

export function buildUniqueScheduleAbbreviation(
  shiftName: string,
  existingAbbreviations: string[],
  currentAbbreviation?: string,
) {
  const blocked = new Set(
    existingAbbreviations
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item && item !== currentAbbreviation?.trim().toUpperCase()),
  )

  const candidates = buildAbbreviationCandidates(shiftName)

  for (const candidate of candidates) {
    if (!blocked.has(candidate)) {
      return candidate
    }
  }

  const fallbackBase = normalizeAbbreviation(shiftName).slice(0, 2)
  for (let digit = 1; digit <= 9; digit += 1) {
    const candidate = `${fallbackBase}${digit}`.slice(0, 3)
    if (!blocked.has(candidate)) {
      return candidate
    }
  }

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const candidate = `${String.fromCharCode(first)}${String.fromCharCode(second)}X`
      if (!blocked.has(candidate)) {
        return candidate
      }
    }
  }

  return normalizeAbbreviation(shiftName)
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
  ;([
    ['startTime', 'Horario de inicio'],
    ['endTime', 'Fim do turno'],
  ] as const).forEach(([field, label]) => {
    if (!isCompleteTimeInput(values[field])) {
      issues.push(`${label}: digite exatamente 4 numeros no formato 0000.`)
    }
  })

  const hasBreakStart = values.breakStart.trim().length > 0
  const hasBreakEnd = values.breakEnd.trim().length > 0
  const hasBreak = hasBreakStart || hasBreakEnd

  if (hasBreakStart !== hasBreakEnd) {
    issues.push('Para usar pausa, preencha tanto o inicio quanto o fim da pausa.')
  }

  if (hasBreakStart && !isCompleteTimeInput(values.breakStart)) {
    issues.push('Inicio de pausa: digite exatamente 4 numeros no formato 0000.')
  }

  if (hasBreakEnd && !isCompleteTimeInput(values.breakEnd)) {
    issues.push('Fim de pausa: digite exatamente 4 numeros no formato 0000.')
  }

  const start = parseTime(values.startTime, values.startPeriod)
  const breakStart = hasBreakStart ? parseTime(values.breakStart, values.breakStartPeriod) : null
  const breakEnd = hasBreakEnd ? parseTime(values.breakEnd, values.breakEndPeriod) : null
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

  if (start === null || end === null || (hasBreak && (breakStart === null || breakEnd === null))) {
    return { netMinutes: undefined, issues }
  }

  const safeStart = start as number
  const safeEnd = end as number

  if (!hasBreak) {
    const [normalizedStart, normalizedEnd] = normalizeSequentialTimes([safeStart, safeEnd])
    const netMinutes = normalizedEnd - normalizedStart

    if (netMinutes <= 0) {
      issues.push('A jornada liquida precisa ser maior que zero.')
      return { netMinutes: undefined, issues }
    }

    return {
      netMinutes,
      grossMinutes: netMinutes,
      breakDurationMinutes: 0,
      hasBreak: false,
      issues,
    }
  }

  const safeBreakStart = breakStart as number
  const safeBreakEnd = breakEnd as number

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

  return {
    netMinutes,
    grossMinutes: normalizedEnd - normalizedStart,
    breakDurationMinutes: normalizedBreakEnd - normalizedBreakStart,
    hasBreak: true,
    issues,
  }
}
