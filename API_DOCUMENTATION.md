# API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication

All endpoints (except auth endpoints) require a Bearer token in the Authorization header.

```
Authorization: Bearer <access_token>
```

## Endpoints

### Authentication

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "role": "PATIENT",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "string"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <token>
```

### Users

#### Get Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

#### Update Patient Profile
```http
PUT /users/patient/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE"
}
```

#### Get Doctors
```http
GET /users/doctors?specialization=CARDIOLOGY&status=VERIFIED
Authorization: Bearer <token>
```

### Appointments

#### Create Appointment
```http
POST /appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "doctorId": "doctor-uuid",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "duration": 30,
  "reason": "Annual checkup",
  "symptoms": "Mild headache"
}
```

#### Get Patient Appointments
```http
GET /appointments/patient
Authorization: Bearer <token>
```

#### Get Doctor Appointments
```http
GET /appointments/doctor
Authorization: Bearer <token>
```

#### Update Appointment Status
```http
PUT /appointments/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CONFIRMED"
}
```

### Medical Records

#### Create Medical Record
```http
POST /medical-records
Authorization: Bearer <token>
Content-Type: application/json

{
  "recordType": "DIAGNOSIS",
  "title": "Migraine",
  "description": "Patient reports recurring migraines",
  "code": "G43.1"
}
```

#### Get Patient Records
```http
GET /medical-records/patient
Authorization: Bearer <token>
```

#### Export FHIR
```http
GET /medical-records/patient/export/fhir
Authorization: Bearer <token>
```

### Prescriptions

#### Create Prescription
```http
POST /prescriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "appointmentId": "appointment-uuid",
  "diagnosis": "Migraine",
  "notes": "Take as needed",
  "drugs": [
    {
      "drugName": "Ibuprofen",
      "dosage": "400mg",
      "frequency": "Every 6 hours",
      "duration": "3 days",
      "instructions": "Take with food"
    }
  ]
}
```

#### Get Patient Prescriptions
```http
GET /prescriptions/patient
Authorization: Bearer <token>
```

### Video Consultation

#### Create Video Call
```http
POST /video-consultation/appointment/:appointmentId
Authorization: Bearer <token>
```

#### Start Video Call
```http
PUT /video-consultation/:id/start
Authorization: Bearer <token>
```

#### End Video Call
```http
PUT /video-consultation/:id/end
Authorization: Bearer <token>
Content-Type: application/json

{
  "duration": 1800
}
```

### Payments

#### Create Payment Intent
```http
POST /payments/appointment/:appointmentId/create-intent
Authorization: Bearer <token>
```

#### Confirm Payment
```http
POST /payments/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentIntentId": "pi_..."
}
```

### Notifications

#### Get Notifications
```http
GET /notifications
Authorization: Bearer <token>
```

#### Get Unread Count
```http
GET /notifications/unread-count
Authorization: Bearer <token>
```

#### Mark as	Read
```http
PUT /notifications/:id/read
Authorization: Bearer <token>
```

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

Common status codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 500: Internal Server Error
