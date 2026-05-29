import { FormEvent, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';

export function Profile() {
  const { profile, refreshProfile } = useAuth();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-content-muted">Update your name or change your password.</p>
      </header>

      {!profile ? (
        <div className="card text-sm text-content-subtle">Loading…</div>
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
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
          Name updated.
        </div>
      )}
      <div>
        <label className="label">Email</label>
        <input className="input bg-surface-2" value={email} disabled />
        <p className="mt-1 text-xs text-content-subtle">
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
        <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
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
      <label className="flex items-center gap-2 text-sm text-content-muted">
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
