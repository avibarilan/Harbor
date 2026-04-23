import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Spinner from '../components/ui/Spinner.jsx';
import StatusDot from '../components/ui/StatusDot.jsx';
import { Search, Bot, Code, Sunset, Box, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const TYPE_META = {
  entity:     { label: 'Entity',     icon: Box,    tab: 'entities' },
  automation: { label: 'Automation', icon: Bot,    tab: 'automations' },
  script:     { label: 'Script',     icon: Code,   tab: 'scripts' },
  scene:      { label: 'Scene',      icon: Sunset, tab: 'scripts' },
};

function useDebounce(fn, delay) {
  let timer;
  return useCallback((...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
    } catch {}
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length >= 2) {
      setLoading(true);
      clearTimeout(window._searchTimer);
      window._searchTimer = setTimeout(() => doSearch(val), 300);
    } else {
      setResults([]);
      setSearched(false);
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(query);
  };

  const handleResultClick = (result) => {
    const tab = TYPE_META[result.result_type]?.tab || 'entities';
    navigate(`/instances/${result.instance_id}?tab=${tab}`);
  };

  // Group by instance
  const grouped = results.reduce((acc, r) => {
    const key = `${r.site_name} / ${r.instance_name}`;
    if (!acc[key]) acc[key] = { siteId: r.site_id, instanceId: r.instance_id, siteName: r.site_name, instanceName: r.instance_name, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Fleet search</h1>

      <form onSubmit={handleSubmit} className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9 pr-4 py-2.5"
          placeholder="Search entities, automations, scripts, scenes across all instances…"
          value={query}
          onChange={handleChange}
          autoFocus
        />
        {loading && <Spinner size="sm" className="absolute right-3 top-1/2 -translate-y-1/2" />}
      </form>

      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-10">No results for "{query}"</p>
      )}

      {Object.values(grouped).map(group => (
        <div key={group.instanceId} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">{group.siteName}</span>
            <ChevronRight size={12} className="text-gray-300" />
            <button
              onClick={() => navigate(`/instances/${group.instanceId}`)}
              className="text-sm font-semibold text-harbor-600 dark:text-harbor-400 hover:underline"
            >
              {group.instanceName}
            </button>
            <span className="badge badge-gray">{group.items.length}</span>
          </div>

          <div className="card divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
            {group.items.map((result, i) => {
              const meta = TYPE_META[result.result_type] || TYPE_META.entity;
              const Icon = meta.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left"
                >
                  <Icon size={14} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {result.friendly_name}
                    </div>
                    <div className="text-xs text-gray-400 font-mono truncate">{result.entity_id}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="badge badge-gray">{meta.label}</span>
                    {result.state && (
                      <span className="text-xs text-gray-400 font-mono">{result.state}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
