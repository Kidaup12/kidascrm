"use client";

import { Suspense } from 'react';
import Transactions from '../../pages/Transactions';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-xl text-center">Loading...</div>}>
      <Transactions />
    </Suspense>
  );
}
