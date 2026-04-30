import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import ParticleBackground from '../ParticleBackground.jsx';
import { api } from '../../api/client.js';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import Spinner from '../ui/Spinner.jsx';
import { Download, X, RefreshCw } from 'lucide-react';

function UpdateBanner() {
  const [versionInfo, setVersionInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    api.get('/harbor/version').then(info => {
      if (info?.updateAvailable) setVersionInfo(info);
    }).catch(() => {});
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    setShowConfirm(false);
    try {
      await api.post('/harbor/update');
      setPolling(true);
    } catch (e) {
      setUpdating(false);
    }
  };

  const pollForRestart = useCallback(async () => {
    const start = Date.now();
    const maxWait = 3 * 60 * 1000;
    const check = async () => {
      if (Date.now() - start > maxWait) {
        setPolling(false);
        setUpdating(false);
        return;
      }
      try {
        await api.get('/harbor/version');
        window.location.reload();
      } catch {
        setTimeout(check, 3000);
      }
    };
    setTimeout(check, 15000);
  }, []);

  useEffect(() => {
    if (polling) pollForRestart();
  }, [polling, pollForRestart]);

  if (dismissed || !versionInfo) return null;

  if (polling || updating) {
    return (
      <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-blue-600 text-white text-sm">
        <RefreshCw size={14} className="animate-spin" />
        <span>Updating Harbor… the page will reload automatically once the restart is complete.</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500 text-white text-sm">
        <Download size={14} className="shrink-0" />
        <span className="flex-1">
          Harbor v{versionInfo.latestVersion} is available — update now to get the latest features and fixes.
        </span>
        {versionInfo.dockerAvailable && (
          <button
            onClick={() => setShowConfirm(true)}
            className="shrink-0 px-3 py-1 bg-white text-amber-700 font-medium rounded text-xs hover:bg-amber-50 transition-colors"
          >
            Update
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-white/80 hover:text-white"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleUpdate}
        title="Update Harbor"
        confirmLabel="Update Now"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Harbor will update to{' '}
          <strong className="text-gray-900 dark:text-white">v{versionInfo.latestVersion}</strong> and restart.
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The new image will be pulled first (may take 1–2 minutes), then Harbor will restart automatically.
          Your data will not be affected.
        </p>
      </ConfirmDialog>
    </>
  );
}

export default function AppShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <UpdateBanner />
      <div
        className="flex flex-1 overflow-hidden relative"
        style={{ background: 'var(--color-bg-base)' }}
      >
        <ParticleBackground opacity={0.6} />
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative" style={{ zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
