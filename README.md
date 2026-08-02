# Telemedicine Platform

A comprehensive, HIPAA-compliant telemedicine platform built with modern technologies, featuring video consultations, remote patient monitoring, EHR/FHIR integration, and advanced analytics.

## 🏗️ Architecture

### Backend (NestJS)
- **Framework**: NestJS 10 (TypeScript)
- **Database**: PostgreSQL 15
- **ORM**: Prisma 5
- **Authentication**: JWT + RBAC with Passport
- **Real-time**: Socket.io for notifications
- **Video**: WebRTC integration
- **Scheduling**: @nestjs/schedule for cron jobs
- **Health Checks**: @nestjs/terminus

### Frontend (Next.js)
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios with interceptors
- **Charts**: Recharts for analytics

### Infrastructure
- **Storage**: AWS S3 (placeholder implementation)
- **Payments**: Stripe
- **Email**: SendGrid (placeholder implementation)
- **Containerization**: Docker & Docker Compose
- **Caching**: Redis (configured)

## ✨ Features

### Core Telemedicine Features
- **Video Consultations**: WebRTC-based real-time video calls
- **Appointment Scheduling**: Doctor availability slots, conflict checking
- **Medical Records**: FHIR R4 compliant patient records
- **Prescription Management**: Drug tracking, status updates
- **Real-time Notifications**: WebSocket-based alerts
- **Payment Processing**: Stripe integration for consultations

### Advanced Features (NEW)
- **Remote Patient Monitoring (IoT)**: 
  - IoT device registration and management
  - Real-time vital signs tracking (blood pressure, heart rate, glucose, SpO2, temperature)
  - Automated abnormality detection and alerts
  - Device health monitoring

- **EHR/FHIR Integration**:
  - FHIR R4 server client for data exchange
  - Support for Epic, Cerner, Allscripts, Athenahealth, eClinicalWorks
  - Bidirectional data synchronization
  - Sync history and error tracking

- **Analytics Dashboard**:
  - Appointment volume metrics
  - Revenue tracking
  - No-show rate analysis
  - Average consultation time
  - Trend visualization with charts
  - Scheduled report generation

### Security & Compliance
- **HIPAA Compliance**:
  - AES-256-GCM encryption for sensitive data
  - Comprehensive audit logging
  - Data retention policies (7+ years)
  - Role-based access control (RBAC)
  - Secure authentication with refresh tokens

### Production-Ready Features
- **Scheduled Jobs**:
  - Daily/weekly/monthly metric calculation
  - Automated EHR synchronization
  - Data archival and cleanup
  - IoT device health checks

- **Error Handling**:
  - Global exception filters
  - Validation error handling
  - Structured error responses

- **Health Monitoring**:
  - Health check endpoints
  - Database connection monitoring
  - Service status tracking

- **File Storage**:
  - S3 integration for document uploads
  - Presigned URL generation
  - File management API

- **Email Service**:
  - Appointment reminders
  - Prescription notifications
  - Payment confirmations
  - Welcome emails

## 👥 User Roles

- **Patients**: Book appointments, video consult, view records, manage IoT devices
- **Doctors**: Manage schedule, video consult, prescribe, view analytics
- **Admins**: Manage users, verify doctors, oversee platform, view reports

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

## 🚀 Getting Started

### Using Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd telemedicine-platform

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Update environment variables with your values

# Start all services
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001/api
# Health Check: http://localhost:3001/api/health
```

### Manual Setup

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run start:dev
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

## 🔧 Configuration

### Backend Environment Variables

See `backend/.env.example` for all required variables:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/telemedicine?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_SECRET="your-refresh-token-secret"
JWT_REFRESH_EXPIRES_IN="30d"

# Frontend
FRONTEND_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000"

# Server
PORT=3001
NODE_ENV="development"

# Stripe
STRIPE_SECRET_KEY="sk_test_your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
STRIPE_API_VERSION="2023-10-16"

# AWS S3
AWS_ACCESS_KEY_ID="your_aws_access_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="telemedicine-documents"

# Email (SendGrid)
SENDGRID_API_KEY="your_sendgrid_api_key"
SENDGRID_FROM_EMAIL="noreply@telemedicine.com"
SENDGRID_FROM_NAME="Telemedicine Platform"

# WebRTC
TURN_SERVER_URL="turn:your-turn-server.com:3478"
TURN_USERNAME="turnuser"
TURN_CREDENTIAL="turnpassword"
STUN_SERVER_URL="stun:stun.l.google.com:19302"

# FHIR Server
FHIR_SERVER_URL="https://hapi.fhir.org/baseR4"
FHIR_API_KEY="your_fhir_api_key_optional"

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key-here"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Logging
LOG_LEVEL="info"
LOG_FILE_PATH="./logs"

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

### Frontend Environment Variables

```env
NEXT_PUBLIC_API_URL="http://localhost:3001/api"
```

## 📁 Project Structure

```
telemedicine-platform/
├── backend/
│   ├── src/
│   │   ├── common/              # Shared utilities
│   │   │   ├── controllers/    # Health check
│   │   │   └── filters/         # Exception filters
│   │   ├── modules/            # Feature modules
│   │   │   ├── analytics/      # Analytics dashboard
│   │   │   ├── appointments/   # Appointment scheduling
│   │   │   ├── auth/           # Authentication & JWT
│   │   │   ├── ehr/            # EHR/FHIR integration
│   │   │   ├── email/          # Email service
│   │   │   ├── iot/            # Remote patient monitoring
│   │   │   ├── medical-records/# Medical records (FHIR)
│   │   │   ├── notifications/  # Real-time notifications
│   │   │   ├── payments/       # Stripe payments
│   │   │   ├── prescriptions/  # Prescription management
│   │   │   ├── prisma/         # Prisma ORM
│   │   │   ├── scheduler/      # Scheduled jobs
│   │   │   ├── security/       # HIPAA security features
│   │   │   ├── storage/        # S3 file storage
│   │   │   ├── users/          # User management
│   │   │   └── video-consultation/ # WebRTC video calls
│   │   ├── app.module.ts       # Main application module
│   │   └── main.ts             # Application bootstrap
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js pages
│   │   │   ├── auth/           # Login/Register pages
│   │   │   └── dashboard/      # Main dashboard
│   │   ├── components/         # React components
│   │   │   ├── AnalyticsDashboard.tsx
│   │   │   ├── EHRConnectionUI.tsx
│   │   │   ├── MedicalRecordsViewer.tsx
│   │   │   ├── NotificationsPanel.tsx
│   │   │   ├── PrescriptionsDisplay.tsx
│   │   │   ├── VideoCall.tsx
│   │   │   └── VitalSignsDashboard.tsx
│   │   ├── lib/                # Utilities
│   │   ├── store/              # Zustand state
│   │   └── types/              # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── API_DOCUMENTATION.md
├── DEPLOYMENT.md
└── README.md
```

## 🔌 API Endpoints

### Health & Monitoring
- `GET /api/health` - Full health check
- `GET /api/health/simple` - Simple health check

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - User logout

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments/patient` - Get patient appointments
- `GET /api/appointments/doctor` - Get doctor appointments
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

### Medical Records
- `POST /api/medical-records` - Create medical record
- `GET /api/medical-records/patient/:id` - Get patient records
- `GET /api/medical-records/:id` - Get single record
- `PUT /api/medical-records/:id` - Update record
- `GET /api/medical-records/patient/:id/export` - Export as FHIR

### IoT / Remote Monitoring
- `POST /api/iot/devices` - Register IoT device
- `GET /api/iot/devices` - Get patient devices
- `POST /api/iot/vital-signs` - Record vital sign
- `GET /api/iot/vital-signs` - Get vital signs
- `GET /api/iot/alerts` - Get alerts
- `PUT /api/iot/alerts/:id/acknowledge` - Acknowledge alert

### EHR Integration
- `POST /api/ehr/connections` - Create EHR connection
- `GET /api/ehr/connections` - Get patient connections
- `POST /api/ehr/connections/:id/sync` - Sync to EHR
- `POST /api/ehr/connections/:id/import` - Import from EHR
- `GET /api/ehr/connections/:id/logs` - Get sync logs

### Analytics
- `POST /api/analytics/metrics/appointments` - Calculate appointment metrics
- `POST /api/analytics/metrics/revenue` - Calculate revenue metrics
- `POST /api/analytics/metrics/no-show` - Calculate no-show metrics
- `POST /api/analytics/metrics/consultation-time` - Calculate consultation time
- `GET /api/analytics/metrics` - Get metrics
- `POST /api/analytics/reports` - Generate report
- `GET /api/analytics/reports` - Get reports

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## 🧪 Testing

```bash
# Backend
cd backend
npm run test              # Run unit tests
npm run test:cov          # Run tests with coverage
npm run test:e2e         # Run end-to-end tests
```

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions including:
- Environment setup
- Docker deployment
- Production configuration
- HIPAA compliance checklist
- Security best practices

## 🔒 HIPAA Compliance

This platform includes the following HIPAA compliance features:

- **Encryption**: AES-256-GCM for sensitive data at rest
- **Audit Logging**: Comprehensive logging of all PHI access
- **Access Control**: Role-based access control (RBAC)
- **Data Retention**: Configurable retention policies (default 7+ years)
- **Secure Communication**: TLS for all data in transit
- **Authentication**: JWT with refresh tokens
- **BAA Templates**: Business Associate Agreement templates included

## 📊 Scheduled Jobs

The platform includes automated scheduled jobs:

- **Daily** (midnight): Calculate daily metrics
- **Weekly** (Sunday 2 AM): Sync daily EHR connections
- **Weekly** (Sunday 3 AM): Sync weekly EHR connections
- **Daily** (4 AM): Archive old records
- **Weekly** (Sunday 5 AM): Clean up old logs
- **Hourly**: Check IoT device health

## 🤝 Contributing

This is a proprietary project. Please contact the development team for contribution guidelines.

## 📄 License

Proprietary - All rights reserved.

## 📞 Support

For support, contact the development team at support@telemedicine.com
