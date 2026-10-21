'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import type { Appointment } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-orange-100 text-orange-800',
};

export default function AppointmentsPage() {
  const user = useAuthStore((s) => s.user);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const path = user.role === 'PATIENT' ? '/appointments/patient' : '/appointments/doctor';
    api.get<Appointment[]>(path)
      .then(setAppointments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await api.put(`/appointments/${id}/status`, { status });
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
    } catch {}
    setUpdating(null);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
          <h1 className="text-2xl font-bold mt-1">Appointments</h1>
        </div>
        {user?.role === 'PATIENT' && (
          <Link href="/dashboard/appointments/book" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            Book Appointment
          </Link>
        )}
      </div>

      {appointments.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <p className="text-gray-400 text-lg mb-4">No appointments yet</p>
          {user?.role === 'PATIENT' && (
            <Link href="/dashboard/appointments/book" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Book your first appointment
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((apt) => (
            <div key={apt.id} className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{apt.reason}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[apt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {apt.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    {user?.role === 'PATIENT'
                      ? `Dr. ${apt.doctor?.firstName} ${apt.doctor?.lastName} · ${apt.doctor?.specialization}`
                      : `Patient: ${(apt as any).patient?.firstName} ${(apt as any).patient?.lastName}`}
                  </p>
                  {apt.symptoms && <p className="text-sm text-gray-600">Symptoms: {apt.symptoms}</p>}
                  <p className="text-sm text-gray-500 mt-2">
                    📅 {new Date(apt.scheduledAt).toLocaleDateString()} at {new Date(apt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    · {apt.duration} min
                  </p>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {apt.status === 'CONFIRMED' && (
                    <Link href={`/dashboard/video/${apt.id}`} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                      Join Video Call
                    </Link>
                  )}
                  {user?.role === 'DOCTOR' && apt.status === 'PENDING' && (
                    <button
                      onClick={() => updateStatus(apt.id, 'CONFIRMED')}
                      disabled={updating === apt.id}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  )}
                  {['PENDING', 'CONFIRMED'].includes(apt.status) && (
                    <button
                      onClick={() => updateStatus(apt.id, 'CANCELLED')}
                      disabled={updating === apt.id}
                      className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
