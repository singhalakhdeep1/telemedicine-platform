'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';

interface Metric {
  id: string;
  type: string;
  value: number;
  previousValue: number;
  changePercent: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  breakdown?: any;
}

interface Report {
  id: string;
  name: string;
  type: string;
  data: any;
  charts?: any;
  lastGeneratedAt: string;
}

interface AnalyticsDashboardProps {
  doctorId?: string;
}

export default function AnalyticsDashboard({ doctorId }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [selectedType, setSelectedType] = useState<string>('APPOINTMENT_VOLUME');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMetrics();
    fetchReports();
  }, [selectedPeriod, doctorId]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/metrics', {
        params: { period: selectedPeriod, doctorId },
      });
      setMetrics(res.data);
    } catch (error) {
      console.error('Failed to fetch metrics');
    }
    setLoading(false);
  };

  const fetchReports = async () => {
    try {
      const res = await api.get('/analytics/reports');
      setReports(res.data);
    } catch (error) {
      console.error('Failed to fetch reports');
    }
  };

  const generateReport = async (type: string) => {
    try {
      await api.post('/analytics/reports', { type, doctorId });
      fetchReports();
    } catch (error) {
      console.error('Failed to generate report');
    }
  };

  const calculateMetric = async (metricType: string) => {
    try {
      await api.post(`/analytics/metrics/${metricType.toLowerCase()}`, {
        period: selectedPeriod,
        doctorId,
      });
      fetchMetrics();
    } catch (error) {
      console.error('Failed to calculate metric');
    }
  };

  const formatMetricName = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase();
  };

  const formatValue = (type: string, value: number) => {
    if (type === 'REVENUE') return `$${value.toFixed(2)}`;
    if (type === 'AVERAGE_CONSULTATION_TIME') return `${Math.round(value / 60)} min`;
    if (type === 'NO_SHOW_RATE') return `${value.toFixed(1)}%`;
    return value.toString();
  };

  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 0) return '📈';
    if (changePercent < 0) return '📉';
    return '➡️';
  };

  const getTrendColor = (changePercent: number, type: string) => {
    if (type === 'NO_SHOW_RATE') {
      return changePercent < 0 ? 'text-green-600' : 'text-red-600';
    }
    return changePercent > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <div className="flex gap-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          'APPOINTMENT_VOLUME',
          'REVENUE',
          'NO_SHOW_RATE',
          'AVERAGE_CONSULTATION_TIME',
        ].map((type) => {
          const metric = metrics.find((m) => m.type === type);
          return (
            <div key={type} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                {formatMetricName(type)}
              </h3>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  {metric ? formatValue(type, metric.value) : '-'}
                </p>
                {metric && (
                  <span className={`text-sm ${getTrendColor(metric.changePercent, type)}`}>
                    {getTrendIcon(metric.changePercent)} {Math.abs(metric.changePercent).toFixed(1)}%
                  </span>
                )}
              </div>
              <button
                onClick={() => calculateMetric(type.toLowerCase())}
                className="mt-3 text-sm text-primary-600 hover:text-primary-700"
              >
                Refresh
              </button>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Trends Over Time</h3>
        <div className="space-y-4">
          {metrics.slice(0, 4).map((metric) => (
            <div key={metric.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium">{formatMetricName(metric.type)}</h4>
                <span className="text-sm text-gray-500">
                  {new Date(metric.periodStart).toLocaleDateString()} - {new Date(metric.periodEnd).toLocaleDateString()}
                </span>
              </div>
              {/* Simple bar chart visualization */}
              <div className="h-32 flex items-end gap-1">
                {metric.breakdown?.byStatus ? (
                  Object.entries(metric.breakdown.byStatus).map(([status, count]: [string, any]) => (
                    <div key={status} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-primary-500 rounded-t"
                        style={{
                          height: `${Math.min((count / metric.value) * 100, 100)}%`,
                        }}
                      />
                      <span className="text-xs mt-1">{status.slice(0, 3)}</span>
                    </div>
                  ))
                ) : (
                  <div className="w-full bg-gray-200 rounded h-full flex items-center justify-center">
                    <span className="text-gray-500 text-sm">No breakdown data</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reports Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Reports</h3>
          <button
            onClick={() => generateReport('PATIENT_OUTCOMES')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Generate Report
          </button>
        </div>
        {reports.length === 0 ? (
          <p className="text-gray-500">No reports generated yet</p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{report.name}</h4>
                    <p className="text-sm text-gray-600">{report.type}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {report.lastGeneratedAt ? new Date(report.lastGeneratedAt).toLocaleString() : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
