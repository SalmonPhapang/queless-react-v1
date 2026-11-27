import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  onDeliveryCompleted,
  startDeliveryCompletionWatch,
  type DeliveryCompletion,
} from '../services/deliveryCompletionService';

/** Owns the signed-in customer's delivery-completion watcher and modal state. */
export function useDeliveryCompletion(): {
  completion: DeliveryCompletion | null;
  dismiss: () => void;
} {
  const [completion, setCompletion] = useState<DeliveryCompletion | null>(null);

  useEffect(() => {
    let disposed = false;
    let stopWatch: (() => void) | null = null;
    let watchedUserId: string | null = null;

    const watchUser = (userId: string | null) => {
      if (disposed || userId === watchedUserId) return;
      stopWatch?.();
      stopWatch = null;
      watchedUserId = userId;
      if (userId) {
        stopWatch = startDeliveryCompletionWatch(userId);
      } else {
        setCompletion(null);
      }
    };

    const off = onDeliveryCompleted((next) => {
      if (!disposed) setCompletion(next);
    });

    void supabase.auth.getUser().then(({ data }) => {
      watchUser(data.user?.id ?? null);
    }).catch((error) => {
      console.warn('Delivery completion auth check failed:', error);
    });

    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        watchUser(null);
        return;
      }
      watchUser(session?.user?.id ?? null);
    });

    return () => {
      disposed = true;
      off();
      stopWatch?.();
      auth.subscription.unsubscribe();
    };
  }, []);

  const dismiss = useCallback(() => setCompletion(null), []);
  return { completion, dismiss };
}
