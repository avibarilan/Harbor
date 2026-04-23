export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={40} className="text-gray-300 dark:text-gray-600 mb-4" />}
      <p className="text-base font-medium text-gray-600 dark:text-gray-400">{title}</p>
      {description && <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
