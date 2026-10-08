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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children(id)}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
