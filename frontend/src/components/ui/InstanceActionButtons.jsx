import { RotateCcw, PowerOff, Power } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Tooltip from './Tooltip.jsx';

export default function InstanceActionButtons({ instance, disabled }) {
  const { toast } = useToast();
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [rebootConfirm, setRebootConfirm] = useState(false);
  const [shutdownConfirm, setShutdownConfirm] = useState(false);
  const offline = disabled || instance.status !== 'connected';
  const companionEnabled = !!instance.companion_enabled;

  const handleRestart = async () => {
    try {
      await api.post(`/instances/${instance.id}/actions/restart`);
      toast('Restart triggered', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
    setRestartConfirm(false);
  };

  const handleReboot = async () => {
    try {
      await api.post(`/instances/${instance.id}/actions/reboot`);
      toast('Host reboot triggered', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
    setRebootConfirm(false);
  };

  const handleShutdown = async () => {
    try {
      await api.post(`/instances/${instance.id}/actions/shutdown`);
      toast('Host shutdown triggered', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
    setShutdownConfirm(false);
  };

  return (
    <>
      <Tooltip content={offline ? 'Instance offline' : 'Restart Core'}>
        <button
          disabled={offline}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRestartConfirm(true); }}
          className="btn-ghost btn-sm"
        >
          <RotateCcw size={13} />
        </button>
      </Tooltip>

      {companionEnabled && (
        <>
          <Tooltip content={offline ? 'Instance offline' : 'Reboot host'}>
            <button
              disabled={offline}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRebootConfirm(true); }}
              className="btn-ghost btn-sm"
            >
              <Power size={13} />
            </button>
          </Tooltip>
          <Tooltip content={offline ? 'Instance offline' : 'Shutdown host'}>
            <button
              disabled={offline}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShutdownConfirm(true); }}
              className="btn-ghost btn-sm"
            >
              <PowerOff size={13} />
            </button>
          </Tooltip>
        </>
      )}

      <ConfirmDialog
        open={restartConfirm}
        title="Restart Home Assistant"
        confirmLabel="Restart"
        onClose={() => setRestartConfirm(false)}
        onConfirm={handleRestart}
      >
        Restart Home Assistant Core on &ldquo;{instance.name}&rdquo;?
      </ConfirmDialog>

      <ConfirmDialog
        open={rebootConfirm}
        title="Reboot host"
        confirmLabel="Reboot"
        danger
        onClose={() => setRebootConfirm(false)}
        onConfirm={handleReboot}
      >
        Reboot the host running &ldquo;{instance.name}&rdquo;? The system will be briefly unavailable.
      </ConfirmDialog>

      <ConfirmDialog
        open={shutdownConfirm}
        title="Shutdown host"
        confirmLabel="Shutdown"
        danger
        onClose={() => setShutdownConfirm(false)}
        onConfirm={handleShutdown}
      >
        Shut down the host running &ldquo;{instance.name}&rdquo;? You will need physical access to power it back on.
      </ConfirmDialog>
    </>
  );
}
