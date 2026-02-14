'use client';

import { useEffect } from 'react';
import { SparklesCore } from '@/components/ui/sparkles';
import { getBangRedirectUrl } from '@/lib/bangs';

export default function SearchPage() {
  useEffect(() => {
    const q = new URL(window.location.href).searchParams.get('q')?.trim() || '';

    if (q) {
      const redirectUrl = getBangRedirectUrl(q);
      window.location.replace(redirectUrl);
    } else {
      window.location.replace('/');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <SparklesCore
        id="redirect-sparkles"
        background="transparent"
        minSize={0.6}
        maxSize={1.2}
        particleDensity={120}
        particleColor="#FACC15"
        speed={2}
        className="w-full h-full"
      />
    </div>
  );
} 