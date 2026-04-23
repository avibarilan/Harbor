import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import Spinner from '../components/ui/Spinner.jsx';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTION_COLORS = {
  instance_adopted:          'badge-green',
  instance_removed:          'badge-red',
  instance_token_updated:    'badge-orange',
  site_created:              'badge-green',
  site_deleted:              'badge-red',
  core_restarted:            'badge-orange',
  host_rebooted:             'badge-orange',
  host_shutdown:             'badge-red',
  core_update_triggered:     'badge-blue',
  supervisor_update_triggered:'badge-blue',
  os_update_triggered:       'badge-blue',
  addon_update_triggered:    'badge-blue',
  backup_triggered:          'badge-blue',
  backup_restored:           'badge-orange',
  backup_downloaded:         'badge-gray',
  user_created:              'badge-green',
  user_deleted:              'badge-red',
  automation_toggled:        'badge-gray',
  automation_triggered:      'badge-gray',
  automation_deleted:        'badge-red',
  script_run:                'badge-gray',
  scene_activated:           'badge-gray',
  service_called:            'badge-gray',
};

export default function AuditPage() {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback((p) => {
    setLoading(true);
    api.get(`/audit?page=${p}&limit=50`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(page); }, [page, load]);

  const totalPages = Math.ceil(data.total / data.limit);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <ScrollText size={18} className="text-harbor-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Audit log</h1>
        <span className="badge badge-gray">{data.total} entries</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="card overflow-hidden mb-4">
            {/* Table header */}
            <div className="grid grid-cols-[160px_1fr_1fr_1fr_2fr] gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span>Time</span>
              <span>Site</span>
              <span>Instance</span>
              <span>Action</span>
              <span>Details</span>
            </div>

            {data.rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">No audit log entries yet.</div>
            ) : data.rows.map(row => (
              <div key={row.id} className="grid grid-cols-[160px_1fr_1fr_1fr_2fr] gap-4 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors items-start">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono shrink-0 pt-0.5">
                  {new Date(row.timestamp).toLocaleString()}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {row.site_name
                    ? <Link to={`/sites/${row.site_id}`} className="hover:text-harbor-600 dark:hover:text-harbor-400">{row.site_name}</Link>
                    : <span className="text-gray-300 dark:text-gray-600">—</span>
                  }
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {row.instance_name
                    ? <Link to={`/instances/${row.instance_id}`} className="hover:text-harbor-600 dark:hover:text-harbor-400">{row.instance_name}</Link>
                    : <span className="text-gray-300 dark:text-gray-600">—</span>
                  }
                </span>
                <span>
                  <span className={`badge ${ACTION_COLORS[row.action] || 'badge-gray'} text-xs`}>
                    {row.action.replace(/_/g, ' ')}
                  </span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 break-words">{row.details}</span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Page {page} of {totalPages} · {data.total} entries</span>
              <div className="flex items-center gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-sm btn-secondary flex items-center gap-1">
                  <ChevronLeft size={14} /> Prev
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-sm btn-secondary flex items-center gap-1">
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
