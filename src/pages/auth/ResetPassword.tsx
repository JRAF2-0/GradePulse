import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';

export function ResetPassword() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setBusy(false);
    if (err) setError(humanizeError(err));
    else setDone(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app bg-gradient-to-br from-brand-500/10 via-app to-app px-4">
      <div className="w-full max-w-md">
        <form onSubmit={onSubmit} className="card space-y-4">
          <h2 className="text-lg font-semibold">Reset password</h2>
          {done ? (
            <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
              Check your email for a reset link.
            </p>
          ) : (
            <>
              {error && (
                <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
                  {error}
                </div>
              )}
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button disabled={busy} className="btn-primary w-full">
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </>
          )}
          <div className="text-center text-sm">
            <Link to="/login" className="text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
