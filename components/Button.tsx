import type { ButtonHTMLAttributes } from 'react';
import type { Icon } from '@phosphor-icons/react';

const VARIANT = {
  primary: 'bg-accent text-surface hover:bg-accent-hover',
  quiet: 'border border-line bg-surface text-ink hover:border-muted/40 hover:bg-page',
  text: 'text-muted hover:bg-slate-tint hover:text-ink',
  danger: 'bg-danger text-surface hover:bg-danger/90',
  'danger-quiet': 'border border-danger-line bg-surface text-danger hover:bg-danger-tint',
} as const;

const SIZE = {
  md: 'px-5 text-[15px]',
  sm: 'px-4 text-sm',
} as const;

export type ButtonVariant = keyof typeof VARIANT;

export function buttonClass(variant: ButtonVariant = 'quiet', size: keyof typeof SIZE = 'md') {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE;
  icon?: Icon;
};

export default function Button({ variant, size, icon: IconCmp, className = '', children, ...props }: Props) {
  return (
    <button {...props} className={`${buttonClass(variant, size)} ${className}`}>
      {IconCmp && <IconCmp aria-hidden size={18} weight="bold" />}
      {children}
    </button>
  );
}

export function IconButton({
  icon: IconCmp, variant = 'text', className = '', ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  'aria-label': string;
  icon: Icon;
  variant?: 'text' | 'quiet';
}) {
  return (
    <button
      {...props}
      className={`inline-grid size-11 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${className}`}
    >
      <IconCmp aria-hidden size={20} />
    </button>
  );
}
