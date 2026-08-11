import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, locale = 'nl-NL', currency = 'EUR') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(date))
}
