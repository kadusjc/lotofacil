const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const int = new Intl.NumberFormat('pt-BR')

export const formatBRL = (value: number) => brl.format(value)
export const formatInt = (value: number) => int.format(Math.round(value))
export const formatOneIn = (oneIn: number) => `1 em ${int.format(oneIn)}`
export const pad2 = (n: number) => String(n).padStart(2, '0')

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatPct(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`
}
