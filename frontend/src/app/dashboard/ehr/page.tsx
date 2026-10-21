'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import EHRConnectionUI from '@/components/EHRConnectionUI';

export default function EHRPage() {
  const user = useAuthStore((s) => s.user);
  if (!user?.patientId) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-gray-500">Patient profile required to manage EHR connections.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      <div className="mt-4">
        <EHRConnectionUI patientId={user.patientId} />
      </div>
    </div>
  );
}
