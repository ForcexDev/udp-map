import type { ReactNode } from 'react'

type Tone = 'neutral' | 'udp' | 'green' | 'amber' | 'blue'

const tones: Record<Tone, string> = {
  neutral: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  udp: 'bg-udp-100 text-udp-800 dark:bg-udp-900 dark:text-udp-200',
  green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}
