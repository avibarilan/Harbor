import clsx from 'clsx';

const colors = {
  connected:    'bg-green-500',
  disconnected: 'bg-red-500',
  auth_failed:  'bg-amber-500',
  unknown:      'bg-gray-400',
};

export default function StatusDot({ status = 'unknown', size = 'md' }) {
  const isConnected = status === 'connected';
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size === 'sm' ? 6 : 8, height: size === 'sm' ? 6 : 8 }}>
      {isConnected && (
        <span
          className={clsx('absolute inset-0 rounded-full opacity-75 status-pulse', colors.connected)}
        />
      )}
      <span
        className={clsx('relative inline-flex rounded-full w-full h-full', colors[status] ?? colors.unknown)}
        title={status}
      />
    </span>
  );
}
