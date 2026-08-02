'use client';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Telemedicine Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            HIPAA-compliant healthcare consultations
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/auth/login"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              Login
            </a>
            <a
              href="/auth/register"
              className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition"
            >
              Register
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Video Consultations</h3>
            <p className="text-gray-600">
              Connect with doctors via secure video calls
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Appointment Scheduling</h3>
            <p className="text-gray-600">
              Book appointments at your convenience
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Medical Records</h3>
            <p className="text-gray-600">
              Access your health records securely
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
