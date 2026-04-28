import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import ParticleBackground from '../ParticleBackground.jsx';

export default function AppShell() {
  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <ParticleBackground opacity={0.6} />
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative" style={{ zIndex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
