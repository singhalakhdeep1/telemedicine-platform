'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import VitalSignsDashboard from '@/components/VitalSignsDashboard';

export default function VitalsPage() {
  const user = useAuthStore((s) => s.user);
  if (!user?.patientId) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-gray-500">Patient profile required to view vitals.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6">Vital Signs &amp; IoT Devices</h1>
      <VitalSignsDashboard patientId={user.patientId} />
    </div>
  );
}
