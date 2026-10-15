import type { ReactNode } from 'react';
import { CheckCircle, Clock, Spinner, type Icon } from '@phosphor-icons/react';

const TONE = {
  accent: 'bg-accent-tint text-accent',
  outline: 'border-[1.5px] border-muted text-ink',
  neutral: 'bg-slate-tint text-ink',
  danger: 'bg-danger-tint text-danger',
} as const;

export function Chip({ tone = 'neutral', icon: IconCmp, children }: {
  tone?: keyof typeof TONE;
  icon?: Icon;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap ${TONE[tone]}`}>
      {IconCmp && <IconCmp aria-hidden size={16} />}
      {children}
    </span>
  );
}

export type Status = 'paid' | 'unpaid' | 'pending' | 'in_progress' | 'done';

const STATUS: Record<Status, { label: string; tone: keyof typeof TONE; icon: Icon; }> = {
  paid: { label: 'Paid', tone: 'accent', icon: CheckCircle },
  unpaid: { label: 'Unpaid', tone: 'outline', icon: Clock },
  // Laundry statuses show their raw value, which the verify specs and staff already read.
  pending: { label: 'pending', tone: 'outline', icon: Clock },
  in_progress: { label: 'in_progress', tone: 'neutral', icon: Spinner },
  done: { label: 'done', tone: 'accent', icon: CheckCircle },
};

export default function StatusChip({ status }: { status: Status; }) {
  const { label, tone, icon } = STATUS[status];
  return <Chip tone={tone} icon={icon}>{label}</Chip>;
}
