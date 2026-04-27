import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useSites } from '../context/SitesContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { CheckCircle, ChevronRight, Plus, MapPin, X } from 'lucide-react';

const STEPS = ['Instance', 'Location', 'Done'];

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

function Step1Instance({ onNext }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
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

  const handleNext = (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !token.trim()) {
      setError('Name, URL, and token are all required');
      return;
    }
    onNext({ name: name.trim(), url: url.trim(), token: token.trim() });
  };

  return (
    <form onSubmit={handleNext} className="space-y-5">
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

      <button type="button" onClick={handleTest} disabled={testing || !url || !token} className="btn-md btn-secondary flex items-center gap-2">
        {testing && <Spinner size="sm" />} Test connection
      </button>

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

      <div className="flex justify-end">
        <button type="submit" className="btn-md btn-primary flex items-center gap-2">
          Next <ChevronRight size={16} />
        </button>
      </div>
    </form>
  );
}

function Step2Location({ instanceData, locations, onBack, onDone }) {
  const [selectedLocId, setSelectedLocId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let locId = selectedLocId;

      if (creatingNew && newLocName.trim()) {
        const loc = await api.post('/locations', { name: newLocName.trim() });
        locId = loc.id;
      }

      await api.post('/instances', {
        name: instanceData.name,
        url: instanceData.url,
        token: instanceData.token,
        location_id: locId || undefined,
      });

      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Optionally assign <strong className="text-gray-900 dark:text-white">{instanceData.name}</strong> to a location for grouping on the dashboard. You can change this later.
      </p>

      <div className="space-y-2">
        {/* No location option */}
        <button
          type="button"
          onClick={() => { setSelectedLocId(null); setCreatingNew(false); }}
          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
            !selectedLocId && !creatingNew
              ? 'border-harbor-500 bg-harbor-50 dark:bg-harbor-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${!selectedLocId && !creatingNew ? 'border-harbor-600' : 'border-gray-300'}`}>
            {!selectedLocId && !creatingNew && <div className="w-2 h-2 rounded-full bg-harbor-600" />}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">No location (ungrouped)</span>
        </button>

        {/* Existing locations */}
        {locations.map(loc => (
          <button
            key={loc.id}
            type="button"
            onClick={() => { setSelectedLocId(loc.id); setCreatingNew(false); }}
            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
              selectedLocId === loc.id
                ? 'border-harbor-500 bg-harbor-50 dark:bg-harbor-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedLocId === loc.id ? 'border-harbor-600' : 'border-gray-300'}`}>
              {selectedLocId === loc.id && <div className="w-2 h-2 rounded-full bg-harbor-600" />}
            </div>
            <MapPin size={13} className="text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{loc.name}</span>
          </button>
        ))}

        {/* Create new location */}
        <button
          type="button"
          onClick={() => { setCreatingNew(true); setSelectedLocId(null); }}
          className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
            creatingNew
              ? 'border-harbor-500 bg-harbor-50 dark:bg-harbor-900/20'
              : 'border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${creatingNew ? 'border-harbor-600' : 'border-gray-300'}`}>
            {creatingNew && <div className="w-2 h-2 rounded-full bg-harbor-600" />}
          </div>
          <Plus size={13} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-600 dark:text-gray-400">Create new location</span>
        </button>

        {creatingNew && (
          <input
            className="input ml-7"
            placeholder="Location name…"
            value={newLocName}
            onChange={e => setNewLocName(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onBack} className="btn-md btn-ghost">← Back</button>
        <button type="submit" disabled={saving || (creatingNew && !newLocName.trim())} className="btn-md btn-primary flex items-center gap-2">
          {saving && <Spinner size="sm" />} Adopt instance
        </button>
      </div>
    </form>
  );
}

function Step3Done({ instanceName, onAddAnother, onGoToDashboard }) {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Instance adopted!</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Harbor is now connecting to <strong>{instanceName}</strong> in the background.
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
  const { locations, refresh } = useSites();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [instanceData, setInstanceData] = useState(null);

  const handleInstanceNext = (data) => { setInstanceData(data); setStep(1); };
  const handleDone = async () => { await refresh(); setStep(2); };
  const handleAddAnother = () => { setInstanceData(null); setStep(0); };
  const handleDashboard = () => navigate('/');

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Adopt a new instance</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Add a Home Assistant installation to your Harbor fleet.</p>

      <StepIndicator current={step} />

      <div className="card p-6 shadow-sm">
        {step === 0 && <Step1Instance onNext={handleInstanceNext} />}
        {step === 1 && (
          <Step2Location
            instanceData={instanceData}
            locations={locations}
            onBack={() => setStep(0)}
            onDone={handleDone}
          />
        )}
        {step === 2 && (
          <Step3Done
            instanceName={instanceData?.name}
            onAddAnother={handleAddAnother}
            onGoToDashboard={handleDashboard}
          />
        )}
      </div>
    </div>
  );
}
