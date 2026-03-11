"use client";

import { Suspense } from 'react';
import Projects from '../../pages/Projects';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-xl text-center">Loading...</div>}>
      <Projects />
    </Suspense>
  );
}
