'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';

interface VitalSign {
  id: string;
  type: string;
  value: number;
  unit: string;
  isAbnormal: boolean;
  severity: string;
  recordedAt: string;
}

interface Device {
  id: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  status: string;
  batteryLevel: number;
  lastSyncAt: string;
}

interface VitalSignsDashboardProps {
  patientId: string;
}

export default function VitalSignsDashboard({ patientId }: VitalSignsDashboardProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [patientId]);

  const fetchData = async () => {
    try {
      const [devicesRes, signsRes, alertsRes] = await Promise.all([
        api.get<Device[]>('/iot/devices'),
        api.get<VitalSign[]>('/iot/vital-signs'),
        api.get<any[]>('/iot/alerts?acknowledged=false'),
      ]);
      setDevices(devicesRes);
      setVitalSigns(signsRes);
      setAlerts(alertsRes);
    } catch (error) {
      console.error('Failed to fetch vital signs data');
    }
  };

  const getVitalSignColor = (type: string) => {
    const colors: Record<string, string> = {
      BLOOD_PRESSURE_SYSTOLIC: 'bg-red-500',
      BLOOD_PRESSURE_DIASTOLIC: 'bg-orange-500',
      HEART_RATE: 'bg-pink-500',
      BLOOD_GLUCOSE: 'bg-blue-500',
      OXYGEN_SATURATION: 'bg-cyan-500',
      TEMPERATURE: 'bg-yellow-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  const formatVitalSignName = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase();
  };

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-3">⚠️ Active Alerts</h3>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="bg-white p-3 rounded border border-red-200">
                <p className="font-medium text-red-700">{alert.message}</p>
                <p className="text-sm text-gray-600">Value: {alert.value} | Severity: {alert.severity}</p>
                <p className="text-xs text-gray-500">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Devices Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Connected Devices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <div
              key={device.id}
              onClick={() => setSelectedDevice(device.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition ${
                selectedDevice === device.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">{device.deviceType.replace(/_/g, ' ')}</h4>
                <span className={`w-3 h-3 rounded-full ${
                  device.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
              <p className="text-sm text-gray-600">{device.manufacturer} {device.model}</p>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>Battery: {device.batteryLevel}%</span>
                <span>Last sync: {new Date(device.lastSyncAt).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vital Signs Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Vital Signs</h3>
        <div className="space-y-4">
          {vitalSigns.slice(0, 10).map((sign) => (
            <div key={sign.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded ${getVitalSignColor(sign.type)}`} />
                <div>
                  <p className="font-medium">{formatVitalSignName(sign.type)}</p>
                  <p className="text-xs text-gray-500">{new Date(sign.recordedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${sign.isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>
                  {sign.value} {sign.unit}
                </p>
                {sign.isAbnormal && (
                  <span className="text-xs text-red-600 font-medium">Abnormal</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
