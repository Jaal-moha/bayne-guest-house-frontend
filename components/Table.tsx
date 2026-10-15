import type { TableHTMLAttributes } from 'react';

// Cells inherit padding and type from here so pages write bare <th> and <td>.
const TABLE = [
  'min-w-full text-left text-[15px]',
  '[&_th]:h-11 [&_th]:px-4 [&_th]:text-[12.5px] [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-muted [&_th]:whitespace-nowrap',
  '[&_td]:px-4 [&_td]:py-3 [&_td]:align-middle',
  '[&_tbody_tr]:border-t [&_tbody_tr]:border-line-soft',
].join(' ');

export default function Table({ className = '', ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={`${TABLE} ${className}`} />;
}
