'use client';

import { useEffect, useState } from 'react';
import { getIdxSessionStatus, IdxSessionStatus } from '@/domain/market/tradingSession';

export function useIdxSessionStatus(): IdxSessionStatus {
  const [status, setStatus] = useState(() => getIdxSessionStatus(new Date()));

  useEffect(() => {
    const id = setInterval(() => setStatus(getIdxSessionStatus(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
