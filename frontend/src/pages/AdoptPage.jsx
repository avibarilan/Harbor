import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useSites } from '../context/SitesContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { CheckCircle, ChevronRight, Plus, Server, X, Tag } from 'lucide-react';

const STEPS = ['Site', 'Instance', 'Done'];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-colors
            ${i < current ? 'bg-green-500 text-white' : i === current ? 'bg-harbor-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
            {i < current ? <CheckCircle size={14} /> : i + 1}
          </div>
          <span className={`text-sm ${i === current ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-400'}`}>{label}</span>
          {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
        </div>
      ))}
    </div>
  );
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) onChange([...tags, val]);
    setInput('');
  };
  return (
    <div>
      <label className="label">Tags <span className="text-gray-400 font-normal">(optional)</span></label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map(t => (
          <span key={t} className="badge badge-blue flex items-center gap-1">
            {t}
            <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} className="hover:text-blue-900 dark:hover:text-blue-200"><X size={11} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="e.g. residential, commercial"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add} className="btn-md btn-secondary shrink-0"><Tag size={14} /></button>
      </div>
    </div>
  );
}

function Step1Site({ onNext, existingSites }) {
  const [mode, setMode] = useState('new');
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [tags, setTags] = useState([]);
  const [notes, setNotes] = useState('');
  const [selectedSite, setSelectedSite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'existing' && selectedSite) {
        onNext(selectedSite);
      } else {
        const site = await api.post('/sites', { name, customer_name: customerName, tags, notes });
        onNext(site);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {existingSites.length > 0 && (
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2">
          {['new', 'existing'].map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors
                ${mode === m ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {m === 'new' ? 'New site' : 'Existing site'}
            </button>
          ))}
        </div>
      )}

      {mode === 'new' ? (
        <>
          <div>
            <label className="label">Site name <span className="text-red-500">*</span></label>
            <input className="input" placeholder="Cohen Residence" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Customer name <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input" placeholder="David Cohen" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <TagInput tags={tags} onChange={setTags} />
          <div>
            <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input min-h-[80px] resize-none" placeholder="Any notes about this site…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {existingSites.map(site => (
            <button key={site.id} type="button" onClick={() => setSelectedSite(site)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
                ${selectedSite?.id === site.id
                  ? 'border-harbor-500 bg-harbor-50 dark:bg-harbor-900/20 dark:border-harbor-500'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedSite?.id === site.id ? 'border-harbor-600' : 'border-gray-300'}`}>
                {selectedSite?.id === site.id && <div className="w-2 h-2 rounded-full bg-harbor-600" />}
              </div>
              <div>
                <div className="font-medium text-sm text-gray-900 dark:text-white">{site.name}</div>
                {site.customer_name && <div className="text-xs text-gray-400">{site.customer_name}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end">
        <button type="submit" disabled={loading || (mode === 'existing' && !selectedSite)} className="btn-md btn-primary flex items-center gap-2">
          {loading && <Spinner size="sm" />}
          Next <ChevronRight size={16} />
        </button>
      </div>
    </form>
  );
}

function Step2Instance({ site, onBack, onDone }) {
  const [name, setName] = useState('Production');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleTest = async () => {
    setError('');
    setTestResult(null);
    setTesting(true);
    try {
      const res = await api.post('/instances/0/test', { url: url.trim(), token: token.trim() });
      setTestResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/instances', { site_id: site.id, name: name.trim(), url: url.trim(), token: token.trim() });
      onDone(site);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex items-center gap-2 px-3 py-2 bg-harbor-50 dark:bg-harbor-900/20 rounded-lg text-sm">
        <Server size={14} className="text-harbor-600 shrink-0" />
        <span className="text-harbor-700 dark:text-harbor-400">Adding instance to <strong>{site.name}</strong></span>
      </div>

      <div>
        <label className="label">Instance name <span className="text-red-500">*</span></label>
        <input className="input" placeholder="Production" value={name} onChange={e => setName(e.target.value)} required />
      </div>
      <div>
        <label className="label">Home Assistant URL <span className="text-red-500">*</span></label>
        <input className="input" placeholder="http://192.168.1.100:8123" value={url} onChange={e => setUrl(e.target.value)} required />
      </div>
      <div>
        <label className="label">Long-Lived Access Token <span className="text-red-500">*</span></label>
        <textarea
          className="input min-h-[80px] font-mono text-xs resize-none"
          placeholder="Paste your LLAT here…"
          value={token}
          onChange={e => setToken(e.target.value)}
          required
        />
        <p className="text-xs text-gray-400 mt-1">Generate in HA → Profile → Long-Lived Access Tokens</p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={handleTest} disabled={testing || !url || !token} className="btn-md btn-secondary flex items-center gap-2">
          {testing && <Spinner size="sm" />}
          Test connection
        </button>
      </div>

      {testResult && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
          <CheckCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Connection successful</div>
            <div className="text-xs mt-0.5">Version: {testResult.version} · {testResult.installation_type}</div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onBack} className="btn-md btn-ghost">← Back</button>
        <button type="submit" disabled={saving} className="btn-md btn-primary flex items-center gap-2">
          {saving && <Spinner size="sm" />}
          Adopt instance
        </button>
      </div>
    </form>
  );
}

function Step3Done({ site, onAddAnother, onGoToDashboard }) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Instance adopted!</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Harbor is now connecting to <strong>{site.name}</strong> in the background.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button onClick={onAddAnother} className="btn-md btn-secondary flex items-center gap-2 justify-center">
          <Plus size={15} /> Add another instance
        </button>
        <button onClick={onGoToDashboard} className="btn-md btn-primary">Go to dashboard</button>
      </div>
    </div>
  );
}

export default function AdoptPage() {
  const { sites, refresh } = useSites();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [site, setSite] = useState(null);

  const handleSiteNext = (s) => { setSite(s); setStep(1); };
  const handleInstanceDone = async (s) => { await refresh(); setSite(s); setStep(2); };
  const handleAddAnother = () => setStep(1);
  const handleDashboard = () => navigate('/');

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Adopt a new instance</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add a Home Assistant installation to your Harbor fleet.</p>

      <StepIndicator current={step} />

      <div className="card p-6 shadow-sm">
        {step === 0 && <Step1Site onNext={handleSiteNext} existingSites={sites} />}
        {step === 1 && <Step2Instance site={site} onBack={() => setStep(0)} onDone={handleInstanceDone} />}
        {step === 2 && <Step3Done site={site} onAddAnother={handleAddAnother} onGoToDashboard={handleDashboard} />}
      </div>
    </div>
  );
}
