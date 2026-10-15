import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

// A base width utility in className would fight w-full; narrow a control with a breakpoint width (sm:w-64) or max-w-*.
const CONTROL = 'w-full rounded-input border border-line bg-surface px-3.5 text-[15px] text-ink transition-colors placeholder:text-muted focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-tint disabled:bg-slate-tint disabled:text-muted aria-invalid:border-danger';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${CONTROL} min-h-11 ${className}`} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${CONTROL} min-h-11 ${className}`} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} py-2.5 ${className}`} />;
}
