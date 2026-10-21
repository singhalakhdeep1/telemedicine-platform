'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);

  if (user?.role === 'PATIENT') return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-gray-500">Analytics is available for doctors and admins only.</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      <div className="mt-4">
        <AnalyticsDashboard doctorId={user?.doctorId} />
      </div>
    </div>
  );
}
