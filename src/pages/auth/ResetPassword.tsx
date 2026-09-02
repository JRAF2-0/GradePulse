import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import { Logo } from '@/components/Logo';

export function ResetPassword() {
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Check if user reached this page via a password reset email link
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
      setIsRecovery(true);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const onRequestLink = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
    } else {
      setDone(true);
    }
  };

  const onUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 2500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app bg-gradient-to-br from-brand-500/10 via-app to-app px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo full size="lg" />
          <p className="mt-3 text-base text-content-muted">Real-time academic transparency</p>
        </div>

        {isRecovery ? (
          <form onSubmit={onUpdatePassword} className="card space-y-4">
            <h2 className="text-lg font-semibold">Set new password</h2>
            <p className="text-sm text-content-muted">
              Enter your new password below to update your account.
            </p>

            {error && (
              <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
                {error}
              </div>
            )}

            {success ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
                  Password updated successfully! Redirecting to sign in…
                </div>
                <Link to="/login" className="btn-primary flex w-full justify-center">
                  Sign in now
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      className="input pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-content-subtle hover:text-content-muted"
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.6}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.6}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirm new password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                  />
                </div>

                <button disabled={busy} className="btn-primary w-full">
                  {busy ? 'Updating password…' : 'Update password'}
                </button>
              </>
            )}

            <div className="text-center text-sm">
              <Link to="/login" className="text-brand-600 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={onRequestLink} className="card space-y-4">
            <h2 className="text-lg font-semibold">Reset password</h2>
            <p className="text-sm text-content-muted">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {done ? (
              <div className="space-y-3">
                <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
                  Check your email for a password reset link.
                </p>
                <Link to="/login" className="btn-secondary flex w-full justify-center">
                  Back to sign in
                </Link>
              </div>
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
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
                <button disabled={busy} className="btn-primary w-full">
                  {busy ? 'Sending link…' : 'Send reset link'}
                </button>
              </>
            )}
            <div className="text-center text-sm">
              <Link to="/login" className="text-brand-600 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
