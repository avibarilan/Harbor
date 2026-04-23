import clsx from 'clsx';

const variants = {
  green:  'badge-green',
  red:    'badge-red',
  orange: 'badge-orange',
  blue:   'badge-blue',
  gray:   'badge-gray',
  yellow: 'badge-yellow',
};

export default function Badge({ children, variant = 'gray', className }) {
  return (
    <span className={clsx('badge', variants[variant] || variants.gray, className)}>
      {children}
    </span>
  );
}
