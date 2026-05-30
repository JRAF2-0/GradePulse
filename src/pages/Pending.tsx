import { useAuth } from '@/context/AuthContext';
import { PersonalInfoCard } from '@/components/PersonalInfoCard';

export function Pending() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-app bg-gradient-to-br from-brand-500/10 via-app to-app px-4 py-12">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="card text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              stroke="currentColor"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight">Awaiting Approval</h1>
          <p className="text-content-muted">
            Hi {profile?.full_name ?? 'there'} — your account is pending admin review.
            While you wait, you can complete your profile below. An admin will assign your
            role (student or teacher) soon.
          </p>
          <button onClick={() => void signOut()} className="btn-secondary mt-6">
            Sign out
          </button>
        </div>

        <PersonalInfoCard defaultMode="edit" />
      </div>
    </div>
  );
}
