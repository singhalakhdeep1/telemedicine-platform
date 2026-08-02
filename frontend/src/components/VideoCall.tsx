'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoCallProps {
  roomId: string;
  token: string;
  onEnd: () => void;
}

export default function VideoCall({ roomId, token, onEnd }: VideoCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // WebRTC implementation
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      })
      .catch((err) => console.error('Error accessing media devices:', err));

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onconnectionstatechange = () => {
      setIsConnected(peerConnection.connectionState === 'connected');
    };

    return () => {
      peerConnection.close();
    };
  }, [roomId, token]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white"
        />
      </div>
      <div className="bg-gray-900 p-4 flex justify-center gap-4">
        <button
          onClick={onEnd}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          End Call
        </button>
        <div className="flex items-center gap-2 text-white">
          <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>
    </div>
  );
}
