import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';

export function JoinClass() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.rpc('join_class_by_code', {
      p_class_code: code.trim().toUpperCase(),
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    if (Array.isArray(data) && data.length > 0) {
      navigate(`/student/classes`);
    } else {
      setError('Class code accepted but no class returned. Try refreshing.');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Join a Class</h1>
        <p className="text-sm text-content-muted">
          Enter the 6-character class code your teacher gave you.
        </p>
      </header>
      <form onSubmit={onSubmit} className="card space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">{error}</div>
        )}
        <div>
          <label className="label">Class code</label>
          <input
            className="input text-center font-mono text-lg tracking-[0.4em] uppercase"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            required
          />
        </div>
        <button disabled={busy || code.length !== 6} className="btn-primary w-full">
          {busy ? 'Joining…' : 'Join Class'}
        </button>
      </form>
    </div>
  );
}
