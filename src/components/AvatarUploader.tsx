import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { humanizeError } from '@/utils/errorMessage';

interface Props {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  onUploaded: (url: string) => void | Promise<void>;
  size?: 'md' | 'lg';
}

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

export function AvatarUploader({ userId, fullName, avatarUrl, onUploaded, size = 'lg' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = fullName
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const onPick = () => inputRef.current?.click();

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!ACCEPT.includes(file.type)) {
      setError('Use a JPG, PNG, or WEBP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 2 MB or smaller.');
      return;
    }
    setBusy(true);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${userId}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
    if (uploadErr) {
      setBusy(false);
      setError(humanizeError(uploadErr));
      return;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-bust so the new image shows immediately.
    const url = `${data.publicUrl}?t=${Date.now()}`;
    await onUploaded(url);
    setBusy(false);
  };

  const dim = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';
  const text = size === 'lg' ? 'text-xl' : 'text-sm';

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${dim}`}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName}
            className={`${dim} rounded-2xl object-cover ring-2 ring-line`}
          />
        ) : (
          <div
            className={`${dim} ${text} inline-flex items-center justify-center rounded-2xl bg-brand-600 font-bold text-white ring-2 ring-line`}
          >
            {initials || '?'}
          </div>
        )}
        <button
          type="button"
          onClick={onPick}
          disabled={busy}
          className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg ring-2 ring-surface transition hover:bg-brand-500 disabled:opacity-60"
          aria-label="Change avatar"
          title="Upload new avatar"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(',')}
          onChange={onChange}
          className="hidden"
        />
      </div>
      {error && (
        <div className="mt-2 max-w-[200px] text-center text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
