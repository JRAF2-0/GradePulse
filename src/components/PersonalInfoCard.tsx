import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  UserCircle2,
  Phone,
  MapPin,
  HeartPulse,
  Pencil,
  X,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';
import { AvatarUploader } from './AvatarUploader';
import type { CivilStatus, DbUser, Gender } from '@/types/database';

interface Props {
  defaultMode?: 'read' | 'edit';
}

type Draft = Pick<
  DbUser,
  | 'phone'
  | 'birthdate'
  | 'gender'
  | 'civil_status'
  | 'nationality'
  | 'emergency_contact_name'
  | 'emergency_contact_phone'
  | 'emergency_contact_relation'
  | 'address_street'
  | 'address_city'
  | 'address_province'
  | 'address_postal_code'
  | 'address_country'
>;

const COUNTED_KEYS: (keyof Draft)[] = [
  'phone',
  'birthdate',
  'gender',
  'civil_status',
  'nationality',
  'address_street',
  'address_city',
  'address_province',
  'address_postal_code',
  'address_country',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relation',
];

const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;
const POSTAL_RE = /^[\d-]{3,12}$/;

function blankDraft(profile: DbUser | null): Draft {
  return {
    phone: profile?.phone ?? null,
    birthdate: profile?.birthdate ?? null,
    gender: (profile?.gender as Gender | null) ?? null,
    civil_status: (profile?.civil_status as CivilStatus | null) ?? null,
    nationality: profile?.nationality ?? null,
    emergency_contact_name: profile?.emergency_contact_name ?? null,
    emergency_contact_phone: profile?.emergency_contact_phone ?? null,
    emergency_contact_relation: profile?.emergency_contact_relation ?? null,
    address_street: profile?.address_street ?? null,
    address_city: profile?.address_city ?? null,
    address_province: profile?.address_province ?? null,
    address_postal_code: profile?.address_postal_code ?? null,
    address_country: profile?.address_country ?? null,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function humanize(v: string | null): string {
  if (!v) return '—';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function PersonalInfoCard({ defaultMode = 'read' }: Props) {
  const { profile, refreshProfile } = useAuth();
  const [mode, setMode] = useState<'read' | 'edit'>(defaultMode);
  const [draft, setDraft] = useState<Draft>(blankDraft(profile));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validation, setValidation] = useState<Partial<Record<keyof Draft, string>>>({});

  useEffect(() => {
    setDraft(blankDraft(profile));
  }, [profile]);

  const filledCount = useMemo(
    () =>
      profile
        ? COUNTED_KEYS.reduce(
            (n, k) => n + (profile[k] != null && String(profile[k]).trim() !== '' ? 1 : 0),
            0,
          )
        : 0,
    [profile],
  );
  const total = COUNTED_KEYS.length;
  const pct = Math.round((filledCount / total) * 100);

  if (!profile) return <div className="skeleton h-64" />;

  const setField = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setValidation((vs) => ({ ...vs, [k]: undefined }));
    setSuccess(false);
  };

  const validate = (): boolean => {
    const v: Partial<Record<keyof Draft, string>> = {};
    if (draft.phone && !PHONE_RE.test(draft.phone)) {
      v.phone = 'Use digits, spaces, +, (, ), or -. 7–20 chars.';
    }
    if (draft.emergency_contact_phone && !PHONE_RE.test(draft.emergency_contact_phone)) {
      v.emergency_contact_phone = 'Use digits, spaces, +, (, ), or -. 7–20 chars.';
    }
    if (draft.birthdate) {
      const d = new Date(draft.birthdate);
      const now = new Date();
      const age = (now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      if (Number.isNaN(d.getTime())) {
        v.birthdate = 'Invalid date.';
      } else if (d > now) {
        v.birthdate = 'Birthdate cannot be in the future.';
      } else if (age < 5 || age > 120) {
        v.birthdate = 'Birthdate is out of range.';
      }
    }
    if (draft.address_postal_code && !POSTAL_RE.test(draft.address_postal_code)) {
      v.address_postal_code = 'Use digits or hyphens, 3–12 chars.';
    }
    setValidation(v);
    return Object.keys(v).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    const payload: Record<string, string | null> = {};
    (Object.keys(draft) as (keyof Draft)[]).forEach((k) => {
      const raw = draft[k];
      payload[k] = typeof raw === 'string' ? raw.trim() || null : (raw ?? null);
    });
    const { error: err } = await supabase.from('users').update(payload).eq('id', profile.id);
    setBusy(false);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    await refreshProfile();
    setSuccess(true);
    setMode('read');
  };

  const onAvatarUploaded = async (url: string) => {
    const { error: err } = await supabase
      .from('users')
      .update({ avatar_url: url })
      .eq('id', profile.id);
    if (err) {
      setError(humanizeError(err));
      return;
    }
    await refreshProfile();
  };

  const onCancel = () => {
    setDraft(blankDraft(profile));
    setValidation({});
    setError(null);
    setMode('read');
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <AvatarUploader
          userId={profile.id}
          fullName={profile.full_name}
          avatarUrl={profile.avatar_url}
          onUploaded={onAvatarUploaded}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold tracking-tight text-content">
            {profile.full_name}
          </h2>
          <p className="truncate text-sm text-content-muted">{profile.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="badge-neutral capitalize">{profile.role.replace(/_/g, ' ')}</span>
            <span className="text-xs text-content-subtle">
              {profile.updated_at ? `Updated ${formatDate(profile.updated_at)}` : 'Not updated yet'}
            </span>
          </div>
        </div>
        {mode === 'read' ? (
          <button onClick={() => setMode('edit')} className="btn-secondary shrink-0">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        ) : (
          <div className="flex shrink-0 gap-2">
            <button onClick={onCancel} className="btn-ghost">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Progress meter */}
      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-content-muted">Profile completeness</span>
          <span className="text-content-subtle">
            {filledCount} of {total} fields · {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className={`h-full rounded-full transition-all ${
              pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-brand-500' : 'bg-amber-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 ring-1 ring-red-500/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 ring-1 ring-emerald-500/30 dark:text-emerald-300">
          Profile saved.
        </div>
      )}

      {/* Body */}
      {mode === 'read' ? (
        <ReadView profile={profile} />
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <Section icon={UserCircle2} title="Identity">
            <Field
              label="Birthdate"
              error={validation.birthdate}
              input={
                <input
                  type="date"
                  className="input"
                  value={draft.birthdate ?? ''}
                  onChange={(e) => setField('birthdate', e.target.value || null)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              }
            />
            <Field
              label="Gender"
              input={
                <select
                  className="input"
                  value={draft.gender ?? ''}
                  onChange={(e) => setField('gender', (e.target.value as Gender) || null)}
                >
                  <option value="">— Select —</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              }
            />
            <Field
              label="Civil status"
              input={
                <select
                  className="input"
                  value={draft.civil_status ?? ''}
                  onChange={(e) =>
                    setField('civil_status', (e.target.value as CivilStatus) || null)
                  }
                >
                  <option value="">— Select —</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="widowed">Widowed</option>
                  <option value="separated">Separated</option>
                  <option value="divorced">Divorced</option>
                </select>
              }
            />
            <Field
              label="Nationality"
              input={
                <input
                  className="input"
                  value={draft.nationality ?? ''}
                  onChange={(e) => setField('nationality', e.target.value || null)}
                  placeholder="Filipino"
                />
              }
            />
          </Section>

          <Section icon={Phone} title="Contact">
            <Field
              label="Email"
              input={<input className="input bg-surface-2" value={profile.email} disabled />}
              hint="Contact your admin to change your email."
              full
            />
            <Field
              label="Phone"
              error={validation.phone}
              input={
                <input
                  type="tel"
                  className="input"
                  value={draft.phone ?? ''}
                  onChange={(e) => setField('phone', e.target.value || null)}
                  placeholder="+63 9xx xxx xxxx"
                  autoComplete="tel"
                />
              }
              full
            />
          </Section>

          <Section icon={MapPin} title="Address">
            <Field
              label="Street"
              full
              input={
                <input
                  className="input"
                  value={draft.address_street ?? ''}
                  onChange={(e) => setField('address_street', e.target.value || null)}
                  placeholder="123 Sampaguita St., Brgy. San Roque"
                  autoComplete="street-address"
                />
              }
            />
            <Field
              label="City / Municipality"
              input={
                <input
                  className="input"
                  value={draft.address_city ?? ''}
                  onChange={(e) => setField('address_city', e.target.value || null)}
                  placeholder="Quezon City"
                  autoComplete="address-level2"
                />
              }
            />
            <Field
              label="Province / Region"
              input={
                <input
                  className="input"
                  value={draft.address_province ?? ''}
                  onChange={(e) => setField('address_province', e.target.value || null)}
                  placeholder="Metro Manila"
                  autoComplete="address-level1"
                />
              }
            />
            <Field
              label="Postal code"
              error={validation.address_postal_code}
              input={
                <input
                  className="input"
                  value={draft.address_postal_code ?? ''}
                  onChange={(e) => setField('address_postal_code', e.target.value || null)}
                  placeholder="1100"
                  autoComplete="postal-code"
                  inputMode="numeric"
                />
              }
            />
            <Field
              label="Country"
              input={
                <input
                  className="input"
                  value={draft.address_country ?? ''}
                  onChange={(e) => setField('address_country', e.target.value || null)}
                  placeholder="Philippines"
                  autoComplete="country-name"
                />
              }
            />
          </Section>

          <Section icon={HeartPulse} title="Emergency contact">
            <Field
              label="Name"
              full
              input={
                <input
                  className="input"
                  value={draft.emergency_contact_name ?? ''}
                  onChange={(e) => setField('emergency_contact_name', e.target.value || null)}
                  placeholder="Maria Dela Cruz"
                />
              }
            />
            <Field
              label="Phone"
              error={validation.emergency_contact_phone}
              input={
                <input
                  type="tel"
                  className="input"
                  value={draft.emergency_contact_phone ?? ''}
                  onChange={(e) => setField('emergency_contact_phone', e.target.value || null)}
                  placeholder="+63 9xx xxx xxxx"
                />
              }
            />
            <Field
              label="Relationship"
              input={
                <input
                  className="input"
                  value={draft.emergency_contact_relation ?? ''}
                  onChange={(e) => setField('emergency_contact_relation', e.target.value || null)}
                  placeholder="Mother / Father / Guardian"
                />
              }
            />
          </Section>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserCircle2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-content-muted">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  input,
  error,
  hint,
  full,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  hint?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      {input}
      {error && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-content-subtle">{hint}</p>}
    </div>
  );
}

function ReadView({ profile }: { profile: DbUser }) {
  const addressLines = [
    profile.address_street,
    [profile.address_city, profile.address_province, profile.address_postal_code]
      .filter(Boolean)
      .join(', '),
    profile.address_country,
  ].filter((s) => s && String(s).trim() !== '');

  return (
    <div className="mt-6 space-y-6">
      <ReadSection icon={UserCircle2} title="Identity">
        <ReadField label="Birthdate" value={formatDate(profile.birthdate)} />
        <ReadField label="Gender" value={humanize(profile.gender)} />
        <ReadField label="Civil status" value={humanize(profile.civil_status)} />
        <ReadField label="Nationality" value={profile.nationality ?? '—'} />
      </ReadSection>

      <ReadSection icon={Phone} title="Contact">
        <ReadField label="Email" value={profile.email} />
        <ReadField label="Phone" value={profile.phone ?? '—'} />
      </ReadSection>

      <ReadSection icon={MapPin} title="Address">
        {addressLines.length === 0 ? (
          <p className="text-sm text-content-subtle">Not set</p>
        ) : (
          <div className="text-sm text-content-muted">
            {addressLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
      </ReadSection>

      <ReadSection icon={HeartPulse} title="Emergency contact">
        <ReadField label="Name" value={profile.emergency_contact_name ?? '—'} />
        <ReadField label="Phone" value={profile.emergency_contact_phone ?? '—'} />
        <ReadField label="Relationship" value={profile.emergency_contact_relation ?? '—'} />
      </ReadSection>
    </div>
  );
}

function ReadSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserCircle2;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wide text-content-muted">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  const empty = value === '—' || value === '';
  return (
    <div className="flex items-start gap-2">
      {empty ? (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-content-subtle" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      )}
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-content-subtle">{label}</div>
        <div className={`truncate text-sm ${empty ? 'text-content-subtle' : 'text-content'}`}>
          {empty ? 'Not set' : value}
        </div>
      </div>
    </div>
  );
}
