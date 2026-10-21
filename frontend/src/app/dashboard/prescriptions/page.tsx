'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import PrescriptionsDisplay from '@/components/PrescriptionsDisplay';
import type { Prescription } from '@/types';

export default function PrescriptionsPage() {
  const user = useAuthStore((s) => s.user);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const path = user.role === 'PATIENT' ? '/prescriptions/patient' : '/prescriptions/doctor';
    api.get<Prescription[]>(path)
      .then(setPrescriptions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
      <h1 className="text-2xl font-bold mt-1 mb-6">Prescriptions</h1>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <PrescriptionsDisplay prescriptions={prescriptions} />
      )}
    </div>
  );
}
