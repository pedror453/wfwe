import { useCallback, useEffect, useState } from 'react';

const read = () => window.location.hash.replace(/^#/, '') || '/overview';

export function useHashRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((to: string) => { window.location.hash = to; }, []);
  return [route, navigate];
}
