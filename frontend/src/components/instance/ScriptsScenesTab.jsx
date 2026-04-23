import { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import Spinner from '../ui/Spinner.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { Play, Sunset, Code } from 'lucide-react';

function ItemList({ title, icon: Icon, items, onAction, actionLabel, offline, emptyText }) {
  if (items === null) return <div className="flex justify-center py-8"><Spinner /></div>;
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <Icon size={15} className="text-harbor-500" /> {title}
      </h2>
      {items.length === 0 ? (
        <div className="text-sm text-gray-400 italic mb-6">{emptyText}</div>
      ) : (
        <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden mb-6">
          {items.map(item => (
            <div key={item.entity_id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.friendly_name}</div>
                {item.last_triggered && (
                  <div className="text-xs text-gray-400 mt-0.5">Last: {new Date(item.last_triggered).toLocaleString()}</div>
                )}
              </div>
              <Tooltip content={offline ? 'Instance offline' : actionLabel}>
                <button
                  disabled={offline}
                  onClick={() => onAction(item)}
                  className="btn-sm btn-secondary flex items-center gap-1.5"
                >
                  <Play size={12} /> {actionLabel}
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScriptsScenesTab({ inst }) {
  const { toast } = useToast();
  const [scripts, setScripts] = useState(null);
  const [scenes, setScenes] = useState(null);
  const offline = inst.status !== 'connected';

  useEffect(() => {
    api.get(`/instances/${inst.id}/scripts`).then(setScripts).catch(() => setScripts([]));
    api.get(`/instances/${inst.id}/scenes`).then(setScenes).catch(() => setScenes([]));
  }, [inst.id]);

  const runScript = async (script) => {
    try {
      await api.post(`/instances/${inst.id}/scripts/${encodeURIComponent(script.entity_id)}/run`);
      toast(`Running: ${script.friendly_name}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const activateScene = async (scene) => {
    try {
      await api.post(`/instances/${inst.id}/scenes/${encodeURIComponent(scene.entity_id)}/activate`);
      toast(`Activated: ${scene.friendly_name}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <ItemList
        title="Scripts"
        icon={Code}
        items={scripts}
        onAction={runScript}
        actionLabel="Run"
        offline={offline}
        emptyText="No scripts found."
      />
      <ItemList
        title="Scenes"
        icon={Sunset}
        items={scenes}
        onAction={activateScene}
        actionLabel="Activate"
        offline={offline}
        emptyText="No scenes found."
      />
    </div>
  );
}
