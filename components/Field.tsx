import { ReactNode, useId } from 'react';

export default function Field({
  label, error, className, children,
}: {
  label: ReactNode;
  error?: string;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</label>
      {children(id)}
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
