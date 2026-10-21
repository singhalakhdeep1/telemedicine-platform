'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import VideoCall from '@/components/VideoCall';

interface VideoCallData {
  id: string;
  roomId: string;
  patientToken: string;
  doctorToken: string;
}

export default function VideoCallPage() {
  const router = useRouter();
  const params = useParams();
  const user = useAuthStore((s) => s.user);
  const appointmentId = params.appointmentId as string;
  const [videoCall, setVideoCall] = useState<VideoCallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!appointmentId) return;
    // Try to get existing call, create if not exists
    api.get<VideoCallData>(`/video-consultation/appointment/${appointmentId}`)
      .then((data) => {
        setVideoCall(data);
        setLoading(false);
      })
      .catch(async () => {
        try {
          const created = await api.post<VideoCallData>(`/video-consultation/appointment/${appointmentId}`);
          setVideoCall(created);
        } catch (err: any) {
          setError(err.data?.message || 'Could not start video call');
        }
        setLoading(false);
      });
  }, [appointmentId]);

  const handleEnd = async () => {
    if (videoCall) {
      try {
        await api.put(`/video-consultation/${videoCall.id}/end`, { duration: 0 });
      } catch {}
    }
    router.push('/dashboard/appointments');
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-white text-center">
        <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4" />
        <p>Connecting to video call...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="text-center">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <button onClick={() => router.push('/dashboard/appointments')} className="px-6 py-2 bg-white text-gray-900 rounded-lg">
          Back to Appointments
        </button>
      </div>
    </div>
  );

  if (!videoCall) return null;

  const token = user?.role === 'DOCTOR' ? videoCall.doctorToken : videoCall.patientToken;

  return <VideoCall roomId={videoCall.roomId} token={token} onEnd={handleEnd} />;
}
