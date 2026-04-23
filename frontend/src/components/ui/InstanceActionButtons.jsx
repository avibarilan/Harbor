import { RotateCcw, Power, PowerOff } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Tooltip from './Tooltip.jsx';

export default function InstanceActionButtons({ instance, disabled }) {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState(null); // { action, label, description }
  const isHaos = instance.installation_type === 'Home Assistant OS';
  const offline = disabled || instance.status !== 'connected';

  const actions = {
    restart:  { fn: () => api.post(`/instances/${instance.id}/actions/restart`),  successMsg: 'Restart triggered' },
    reboot:   { fn: () => api.post(`/instances/${instance.id}/actions/reboot`),   successMsg: 'Reboot triggered' },
    shutdown: { fn: () => api.post(`/instances/${instance.id}/actions/shutdown`), successMsg: 'Shutdown triggered' },
  };

  const handleAction = async (action) => {
    try {
      await actions[action].fn();
      toast(actions[action].successMsg, 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
    setConfirm(null);
  };

  const tip = offline ? 'Instance offline' : null;

  return (
    <>
      <div className="flex items-center gap-1">
        <Tooltip content={tip || 'Restart Core'}>
          <button
            disabled={offline}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirm({ action: 'restart', label: 'Restart', description: `Restart Home Assistant Core on "${instance.name}"?` }); }}
            className="btn-ghost btn-sm"
          >
            <RotateCcw size={13} />
          </button>
        </Tooltip>
        {isHaos && (
          <>
            <Tooltip content={tip || 'Reboot host'}>
              <button
                disabled={offline}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirm({ action: 'reboot', label: 'Reboot host', description: `Reboot the host machine for "${instance.name}"? This will cause a short outage.` }); }}
                className="btn-ghost btn-sm"
              >
                <Power size={13} />
              </button>
            </Tooltip>
            <Tooltip content={tip || 'Shutdown host'}>
              <button
                disabled={offline}
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setConfirm({ action: 'shutdown', label: 'Shutdown host', description: `Shut down the host for "${instance.name}"? You will need physical access to restart it.` }); }}
                className="btn-ghost btn-sm"
              >
                <PowerOff size={13} />
              </button>
            </Tooltip>
          </>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          open
          title={confirm.label}
          confirmLabel={confirm.label}
          danger={confirm.action !== 'restart'}
          onClose={() => setConfirm(null)}
          onConfirm={() => handleAction(confirm.action)}
        >
          {confirm.description}
        </ConfirmDialog>
      )}
    </>
  );
}
