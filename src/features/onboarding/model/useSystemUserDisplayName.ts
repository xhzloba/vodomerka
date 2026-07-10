import { useEffect, useState } from 'react';

export function useSystemUserDisplayName() {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void window.electronAPI?.system
      .getUserDisplayName()
      .then((name) => {
        if (!cancelled) {
          setDisplayName(name);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDisplayName(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return displayName;
}
