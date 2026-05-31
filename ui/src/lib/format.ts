export const MONTHS = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function money(value: number | string, currency = 'AOA'): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isNaN(n) ? 0 : n) + ' ' + currency
}

export function monthName(m: number): string {
  return MONTHS[m] ?? String(m)
}
