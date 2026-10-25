import i18n from './config'

export function locale(): string {
  return i18n.resolvedLanguage ?? i18n.language ?? 'en'
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale(), options).format(value)
}

export function formatList(
  values: readonly string[],
  type: Intl.ListFormatType = 'conjunction'
): string {
  return new Intl.ListFormat(locale(), { style: 'long', type }).format(values)
}

export function formatDate(
  value: Date,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale(), options).format(value)
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit
): string {
  return new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' }).format(
    value,
    unit
  )
}
