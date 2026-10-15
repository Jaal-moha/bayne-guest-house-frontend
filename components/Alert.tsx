import type { HTMLAttributes } from 'react';

const TONE = {
  danger: 'border-danger-line bg-danger-tint text-danger',
  accent: 'border-accent/25 bg-accent-tint text-accent',
  neutral: 'border-line bg-slate-tint text-ink',
} as const;

export default function Alert({ tone = 'danger', className = '', ...props }: HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof TONE; }) {
  return <div {...props} className={`rounded-input border px-3.5 py-2.5 text-sm ${TONE[tone]} ${className}`} />;
}
