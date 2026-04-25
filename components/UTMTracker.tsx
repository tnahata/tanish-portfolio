'use client';

import { Suspense } from 'react';
import useUTMPersistence from '@/lib/useUTMPersistence';

function UTMTrackerInner() {
  useUTMPersistence();
  return null;
}

export default function UTMTracker() {
  return (
    <Suspense>
      <UTMTrackerInner />
    </Suspense>
  );
}
