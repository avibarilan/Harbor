import { useState } from 'react';

export default function Tooltip({ children, content, side = 'top' }) {
  const [visible, setVisible] = useState(false);
  if (!content) return children;

  const pos = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[side];

  return (
    <div className="relative inline-flex" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className={`absolute z-50 ${pos} whitespace-nowrap rounded-lg bg-gray-900 dark:bg-gray-700 px-2 py-1 text-xs text-white shadow-lg pointer-events-none`}>
          {content}
        </div>
      )}
    </div>
  );
}
