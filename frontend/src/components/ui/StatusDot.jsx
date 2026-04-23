import clsx from 'clsx';

const colors = {
  connected:    'bg-green-500',
  disconnected: 'bg-red-500',
  auth_failed:  'bg-orange-500',
  unknown:      'bg-gray-400',
};

export default function StatusDot({ status = 'unknown', size = 'md' }) {
  return (
    <span
      className={clsx(
        'rounded-full shrink-0',
        colors[status] ?? colors.unknown,
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
      )}
      title={status}
    />
  );
}
