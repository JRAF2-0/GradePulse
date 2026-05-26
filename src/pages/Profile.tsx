import { FormEvent, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';

export function Profile() {
  const { profile, refreshProfile } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-slate-600">Update your name or change your password.</p>
      </header>

      {!profile ? (
        <div className="card text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <NameForm
            currentName={profile.full_name}
            email={profile.email}
            onSaved={() => void refreshProfile()}
          />
          <PasswordForm />
        </>
      )}
    </div>
  );
}

function NameForm({
  currentName,
  email,
  onSaved,
}: {
  currentName: string;
  email: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (fullName.trim() === currentName) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    const { error: err } = await supabase
      .from('users')
      .update({ full_name: fullName.trim() })
      .eq('id', user.id);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setSuccess(true);
    onSaved();
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-lg font-semibold">Account info</h2>
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Name updated.
        </div>
      )}
      <div>
        <label className="label">Email</label>
        <input className="input bg-slate-50" value={email} disabled />
        <p className="mt-1 text-xs text-slate-500">
          Contact your admin to change your email.
        </p>
      </div>
      <div>
        <label className="label">Full name</label>
        <input
          required
          className="input"
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            setSuccess(false);
          }}
        />
      </div>
      <div className="flex justify-end">
        <button
          disabled={busy || fullName.trim() === currentName || !fullName.trim()}
          className="btn-primary"
        >
          {busy ? 'Saving…' : 'Save name'}
        </button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setPassword('');
    setConfirm('');
    setSuccess(true);
  };

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-lg font-semibold">Change password</h2>
      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Password updated. Use the new password next time you sign in.
        </div>
      )}
      <div>
        <label className="label">New password</label>
        <input
          type={showPassword ? 'text' : 'password'}
          required
          minLength={6}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="label">Confirm new password</label>
        <input
          type={showPassword ? 'text' : 'password'}
          required
          minLength={6}
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(e) => setShowPassword(e.target.checked)}
        />
        Show passwords
      </label>
      <div className="flex justify-end">
        <button
          disabled={busy || !password || !confirm}
          className="btn-primary"
        >
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}
