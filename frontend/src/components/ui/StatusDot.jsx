const COLORS = {
  connected:    { dot: '#3fb950', glow: 'rgba(63, 185, 80, 0.4)' },
  disconnected: { dot: '#f85149', glow: null },
  auth_failed:  { dot: '#d29922', glow: null },
  unknown:      { dot: '#484f58', glow: null },
};

export default function StatusDot({ status = 'unknown', size = 'md' }) {
  const px = size === 'sm' ? 8 : 10;
  const { dot, glow } = COLORS[status] ?? COLORS.unknown;

  return (
    <span
      className="relative inline-flex shrink-0 rounded-full"
      style={{
        width:  px,
        height: px,
        background: dot,
        animation: glow ? 'pulse-online 2s ease infinite' : undefined,
        boxShadow: glow ? `0 0 0 0 ${glow}` : undefined,
      }}
      title={status}
    />
  );
}
