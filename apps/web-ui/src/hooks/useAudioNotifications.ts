import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIO_NOTIFICATIONS, type AudioNotificationId } from '../audio/notifications';

export function useAudioNotifications() {
  const [enabled, setEnabled] = useState(false);
  const audioMap = useRef<Record<AudioNotificationId, HTMLAudioElement>>({});

  useEffect(() => {
    const handler = () => setEnabled(true);
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  const playNotification = useCallback(
    (id: AudioNotificationId) => {
      if (!enabled) return;
      const config = AUDIO_NOTIFICATIONS[id];
      if (!config?.file) return;
      if (!audioMap.current[id]) {
        audioMap.current[id] = new Audio(config.file);
      }
      const player = audioMap.current[id];
      try {
        player.currentTime = 0;
        player.play().catch(() => {});
      } catch (err) {
        console.warn('Audio playback failed', err);
      }
    },
    [enabled]
  );

  return { playNotification, audioEnabled: enabled };
}
