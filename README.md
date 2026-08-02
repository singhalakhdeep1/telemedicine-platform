# Telemedicine Platform

A HIPAA-compliant telemedicine platform with video consultations, appointment scheduling, patient records, and prescription management.

## Tech Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + RBAC
- **Real-time**: Socket.io
- **Video**: WebRTC

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Context + SWR

### Infrastructure
- **Storage**: AWS S3
- **Payments**: Stripe
- **Email**: SendGrid
- **Container**: Docker

## Features

### Core Features
- Video consultations (WebRTC)
- Appointment scheduling
- Patient medical records (FHIR compliant)
- Prescription management
- Real-time notifications
- Payment processing

### User Roles
- **Patients**: Book appointments, video consult, view records
- **Doctors**: Manage schedule, video consult, prescribe
- **Admins**: Manage users, verify doctors, oversee platform

## HIPAA Compliance

- Data encryption at rest and in transit
- Audit logging for all PHI access
- Role-based access control
- BAA templates
- Data retention policies

## Getting Started

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
```

## License

Proprietary - All rights reserved.
