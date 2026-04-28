import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ParticleBackground from '../components/ParticleBackground.jsx';
import { Anchor } from 'lucide-react';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4"
      style={{ background: '#0e1117' }}
    >
      <ParticleBackground opacity={1} particleCount={60} />

      <div
        className="relative flex flex-col w-full max-w-[400px]"
        style={{
          zIndex: 10,
          background: 'rgba(22, 27, 34, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '40px',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'rgba(37, 99, 235, 0.12)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              boxShadow: '0 0 28px rgba(37, 99, 235, 0.25)',
            }}
          >
            <Anchor size={32} style={{ color: '#2563eb' }} />
          </div>
          <h1
            className="font-semibold"
            style={{ color: '#e6edf3', fontSize: 'var(--text-2xl)' }}
          >
            Harbor
          </h1>
          <p
            className="mt-1"
            style={{ color: '#8b949e', fontSize: 'var(--text-sm)' }}
          >
            Fleet Management for Home Assistant
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block mb-1.5 text-[11px] font-medium uppercase tracking-wide"
              style={{ color: '#8b949e' }}
            >
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #30363d',
                background: '#0e1117',
                color: '#e6edf3',
                fontSize: 'var(--text-sm)',
                padding: '8px 12px',
                outline: 'none',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#30363d';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div>
            <label
              className="block mb-1.5 text-[11px] font-medium uppercase tracking-wide"
              style={{ color: '#8b949e' }}
            >
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #30363d',
                background: '#0e1117',
                color: '#e6edf3',
                fontSize: 'var(--text-sm)',
                padding: '8px 12px',
                outline: 'none',
                transition: 'border-color 150ms, box-shadow 150ms',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#30363d';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <p
              className="text-sm px-3 py-2"
              style={{
                color: '#f85149',
                background: 'rgba(248, 81, 73, 0.1)',
                border: '1px solid rgba(248, 81, 73, 0.2)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center font-medium mt-2"
            style={{
              background: loading ? '#1d4ed8' : '#2563eb',
              color: '#ffffff',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              fontSize: 'var(--text-sm)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 150ms, box-shadow 150ms, transform 100ms',
              border: 'none',
              boxShadow: '0 0 0 0 rgba(37,99,235,0)',
              opacity: loading ? 0.8 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 16px rgba(37,99,235,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 0 0 rgba(37,99,235,0)'; }}
            onMouseDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p
          className="text-center mt-6"
          style={{ color: '#484f58', fontSize: '11px' }}
        >
          Harbor v1.3.0
        </p>
      </div>
    </div>
  );
}
