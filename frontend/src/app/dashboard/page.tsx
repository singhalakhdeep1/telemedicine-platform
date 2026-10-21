'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { Appointment, MedicalRecord, Prescription } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/auth/login'); return; }
    Promise.all([
      api.get<Appointment[]>(user.role === 'PATIENT' ? '/appointments/patient' : '/appointments/doctor'),
      api.get<MedicalRecord[]>('/medical-records/patient'),
      api.get<Prescription[]>('/prescriptions/patient'),
    ])
      .then(([appts, recs, rx]) => {
        setAppointments(appts);
        setRecords(recs);
        setPrescriptions(rx);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (!user) return null;

  const nav = [
    { href: '/dashboard/appointments', label: 'Appointments' },
    { href: '/dashboard/medical-records', label: 'Medical Records' },
    { href: '/dashboard/prescriptions', label: 'Prescriptions' },
    ...(user.role === 'PATIENT' ? [
      { href: '/dashboard/vitals', label: 'Vitals' },
      { href: '/dashboard/ehr', label: 'EHR Connections' },
    ] : []),
    ...(user.role === 'DOCTOR' || user.role === 'ADMIN' ? [
      { href: '/dashboard/analytics', label: 'Analytics' },
    ] : []),
    { href: '/dashboard/notifications', label: 'Notifications' },
    { href: '/dashboard/profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-blue-700">Telemedicine</span>
            <div className="hidden md:flex gap-4">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-sm text-gray-600 hover:text-blue-600">
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.email}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{user.role}</span>
            <button onClick={() => { logout(); router.push('/auth/login'); }} className="text-sm text-red-600 hover:text-red-800">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">
          Welcome back{user.role === 'DOCTOR' ? ', Doctor' : ''}
        </h2>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Link href="/dashboard/appointments" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Appointments</h3>
                <p className="text-3xl font-bold text-blue-600">{appointments.length}</p>
                <p className="text-xs text-gray-400 mt-1">View all →</p>
              </Link>
              <Link href="/dashboard/medical-records" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Medical Records</h3>
                <p className="text-3xl font-bold text-green-600">{records.length}</p>
                <p className="text-xs text-gray-400 mt-1">View all →</p>
              </Link>
              <Link href="/dashboard/prescriptions" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Prescriptions</h3>
                <p className="text-3xl font-bold text-purple-600">{prescriptions.length}</p>
                <p className="text-xs text-gray-400 mt-1">View all →</p>
              </Link>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Upcoming Appointments</h3>
                  <Link href="/dashboard/appointments" className="text-sm text-blue-600 hover:underline">See all</Link>
                </div>
                {appointments.length === 0 ? (
                  <p className="text-gray-400 text-sm">No appointments yet.</p>
                ) : appointments.slice(0, 4).map((apt) => (
                  <div key={apt.id} className="flex justify-between items-start border-b py-3 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{apt.reason}</p>
                      <p className="text-xs text-gray-500">
                        Dr. {apt.doctor?.firstName} {apt.doctor?.lastName} · {apt.doctor?.specialization}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{new Date(apt.scheduledAt).toLocaleDateString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        apt.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' :
                        apt.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        apt.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{apt.status}</span>
                    </div>
                  </div>
                ))}
                <Link href="/dashboard/appointments/book" className="mt-4 block text-center py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                  Book Appointment
                </Link>
              </div>

              <div className="bg-white p-6 rounded-xl shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Recent Prescriptions</h3>
                  <Link href="/dashboard/prescriptions" className="text-sm text-blue-600 hover:underline">See all</Link>
                </div>
                {prescriptions.length === 0 ? (
                  <p className="text-gray-400 text-sm">No prescriptions yet.</p>
                ) : prescriptions.slice(0, 4).map((rx) => (
                  <div key={rx.id} className="border-b py-3 last:border-0">
                    <p className="font-medium text-sm">{rx.diagnosis}</p>
                    <p className="text-xs text-gray-500">
                      Dr. {rx.doctor?.firstName} {rx.doctor?.lastName} · {new Date(rx.prescribedAt).toLocaleDateString()}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rx.drugs?.slice(0, 2).map((d) => (
                        <span key={d.id} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{d.drugName}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              {user.role === 'PATIENT' && (
                <Link href="/dashboard/vitals" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xl">❤️</div>
                  <div>
                    <h3 className="font-semibold">Vital Signs</h3>
                    <p className="text-sm text-gray-500">Monitor your health metrics</p>
                  </div>
                </Link>
              )}
              {user.role === 'PATIENT' && (
                <Link href="/dashboard/ehr" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 text-xl">🏥</div>
                  <div>
                    <h3 className="font-semibold">EHR Connections</h3>
                    <p className="text-sm text-gray-500">Connect your health records</p>
                  </div>
                </Link>
              )}
              {(user.role === 'DOCTOR' || user.role === 'ADMIN') && (
                <Link href="/dashboard/analytics" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl">📊</div>
                  <div>
                    <h3 className="font-semibold">Analytics</h3>
                    <p className="text-sm text-gray-500">View platform metrics</p>
                  </div>
                </Link>
              )}
              <Link href="/dashboard/medical-records" className="bg-white p-6 rounded-xl shadow hover:shadow-md transition flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 text-xl">📋</div>
                <div>
                  <h3 className="font-semibold">Medical Records</h3>
                  <p className="text-sm text-gray-500">View your health history</p>
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
