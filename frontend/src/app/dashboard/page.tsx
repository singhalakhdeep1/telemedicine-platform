'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import type { Appointment, MedicalRecord, Prescription } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    try {
      const [appts, recs, rx] = await Promise.all([
        api.get(user?.role === 'PATIENT' ? '/appointments/patient' : '/appointments/doctor'),
        api.get('/medical-records/patient'),
        api.get('/prescriptions/patient'),
      ]);
      setAppointments(appts.data);
      setRecords(recs.data);
      setPrescriptions(rx.data);
    } catch (error) {
      console.error('Failed to fetch data');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Telemedicine Platform</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user.email}</span>
            <button onClick={handleLogout} className="text-sm text-red-600">Logout</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Appointments</h3>
            <p className="text-3xl font-bold text-primary-600">{appointments.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Medical Records</h3>
            <p className="text-3xl font-bold text-primary-600">{records.length}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Prescriptions</h3>
            <p className="text-3xl font-bold text-primary-600">{prescriptions.length}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
            {appointments.slice(0, 3).map((apt) => (
              <div key={apt.id} className="border-b py-3">
                <p className="font-medium">{apt.reason}</p>
                <p className="text-sm text-gray-600">{new Date(apt.scheduledAt).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Recent Prescriptions</h3>
            {prescriptions.slice(0, 3).map((rx) => (
              <div key={rx.id} className="border-b py-3">
                <p className="font-medium">{rx.diagnosis}</p>
                <p className="text-sm text-gray-600">{rx.doctor.firstName} {rx.doctor.lastName}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
