import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export default function useUTMPersistence() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const params: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const val = searchParams.get(key);
      if (val) params[key] = val;
    }
    if (Object.keys(params).length > 0) {
      sessionStorage.setItem('utm_params', JSON.stringify(params));
    }
  }, [searchParams]);
}
