'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react'; // Import loader icon

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard after a short delay
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    // Use flexbox and Tailwind utilities for centering
    <div className="flex items-center justify-center min-h-screen">
      {/* Use flexbox and Tailwind for vertical stacking and spacing */}
      <div className="flex flex-col items-center space-y-4">
        {/* Use lucide-react icon with animation */}
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        {/* Use standard p tag with Tailwind class */}
        <p className="text-xl text-muted-foreground">Loading Load Balancer...</p>
      </div>
    </div>
  );
}