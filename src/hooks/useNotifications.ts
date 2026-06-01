import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbNotification } from '@/types/database';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<DbNotification[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('useNotifications', error);
      return;
    }
    setNotifications(data ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchAll();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchAll();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const markRead = useCallback(async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) console.error(error);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) console.error(error);
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return { notifications, unreadCount, markRead, markAllRead, refresh: fetchAll };
}
