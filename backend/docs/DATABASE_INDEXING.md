# Database Indexing Strategy

## Overview
This document describes the database indexing strategy for the telemedicine platform to optimize query performance for common access patterns.

## Index Categories

### 1. Patient Search Indexes

#### Composite Index for Patient Lookup
```sql
CREATE INDEX idx_patient_user ON "Patient"(userId);
```
- **Purpose**: Fast lookup of patient profile by user ID
- **Query Pattern**: `WHERE patientId = ?`
- **Selectivity**: High (unique)

#### Composite Index for Patient Medical Records
```sql
CREATE INDEX idx_medical_record_patient_recorded ON "MedicalRecord"(patientId, recordedAt DESC);
```
- **Purpose**: Retrieve patient's medical records in chronological order
- **Query Pattern**: `WHERE patientId = ? ORDER BY recordedAt DESC`
- **Covering**: Includes both patientId and recordedAt for index-only scans

#### Composite Index for Patient Appointments
```sql
CREATE INDEX idx_appointment_patient_scheduled ON "Appointment"(patientId, scheduledAt DESC);
```
- **Purpose**: Retrieve patient's appointments sorted by date
- **Query Pattern**: `WHERE patientId = ? ORDER BY scheduledAt DESC`
- **Use Case**: Patient appointment history, upcoming appointments

### 2. Doctor Search Indexes

#### Composite Index for Doctor Specialization
```sql
CREATE INDEX idx_doctor_specialization_status ON "Doctor"(specialization, status);
```
- **Purpose**: Find available doctors by specialization
- **Query Pattern**: `WHERE specialization = ? AND status = 'VERIFIED'`
- **Use Case**: Doctor search, appointment booking

#### Composite Index for Doctor Availability
```sql
CREATE INDEX idx_availability_doctor_day ON "AvailabilitySlot"(doctorId, dayOfWeek, isAvailable);
```
- **Purpose**: Find doctor's available time slots
- **Query Pattern**: `WHERE doctorId = ? AND dayOfWeek = ? AND isAvailable = true`
- **Use Case**: Appointment scheduling

#### Composite Index for Doctor Appointments
```sql
CREATE INDEX idx_appointment_doctor_scheduled_status ON "Appointment"(doctorId, scheduledAt, status);
```
- **Purpose**: Retrieve doctor's schedule with status filtering
- **Query Pattern**: `WHERE doctorId = ? AND scheduledAt >= ? AND status IN ('PENDING', 'CONFIRMED')`
- **Use Case**: Doctor calendar, availability check

### 3. Appointment Indexes

#### Composite Index for Date Range Queries
```sql
CREATE INDEX idx_appointment_scheduled_status ON "Appointment"(scheduledAt, status);
```
- **Purpose**: Find appointments in a date range with status filter
- **Query Pattern**: `WHERE scheduledAt BETWEEN ? AND ? AND status = ?`
- **Use Case**: Daily appointment lists, analytics

#### Partial Index for Active Appointments
```sql
CREATE INDEX idx_appointment_active ON "Appointment"(doctorId, scheduledAt) 
WHERE status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS');
```
- **Purpose**: Optimized query for active appointments only
- **Query Pattern**: `WHERE doctorId = ? AND scheduledAt >= ? AND status IN (...)`
- **Benefit**: Smaller index size, faster queries

### 4. Medical Record Indexes

#### Composite Index for Record Type and Date
```sql
CREATE INDEX idx_medical_record_type_recorded ON "MedicalRecord"(recordType, recordedAt DESC);
```
- **Purpose**: Find medical records by type with chronological ordering
- **Query Pattern**: `WHERE recordType = ? ORDER BY recordedAt DESC`
- **Use Case**: Lab results history, diagnosis timeline

#### GIN Index for FHIR JSON Search
```sql
CREATE INDEX idx_medical_record_fhir ON "MedicalRecord" USING GIN (fhirResource);
```
- **Purpose**: Full-text search within FHIR JSON documents
- **Query Pattern**: `WHERE fhirResource @> '{"resourceType": "Observation"}'`
- **Use Case**: Advanced medical record search

### 5. Vital Signs Indexes

#### Composite Index for Patient Vitals
```sql
CREATE INDEX idx_vitalsign_patient_type_recorded ON "VitalSign"(patientId, type, recordedAt DESC);
```
- **Purpose**: Retrieve patient's vital signs by type over time
- **Query Pattern**: `WHERE patientId = ? AND type = ? ORDER BY recordedAt DESC`
- **Use Case**: Vital signs history, trend analysis

#### Composite Index for Abnormal Vitals
```sql
CREATE INDEX idx_vitalsign_abnormal ON "VitalSign"(patientId, isAbnormal, recordedAt DESC) 
WHERE isAbnormal = true;
```
- **Purpose**: Quick access to abnormal vital signs
- **Query Pattern**: `WHERE patientId = ? AND isAbnormal = true ORDER BY recordedAt DESC`
- **Use Case**: Alert generation, patient monitoring

#### Composite Index for Device Vitals
```sql
CREATE INDEX idx_vitalsign_device_recorded ON "VitalSign"(deviceId, recordedAt DESC);
```
- **Purpose**: Retrieve all readings from a specific device
- **Query Pattern**: `WHERE deviceId = ? ORDER BY recordedAt DESC`
- **Use Case**: Device health monitoring, data validation

### 6. Payment Indexes

#### Composite Index for Payment Status
```sql
CREATE INDEX idx_payment_status_created ON "Payment"(status, createdAt);
```
- **Purpose**: Find payments by status with date ordering
- **Query Pattern**: `WHERE status = ? ORDER BY createdAt DESC`
- **Use Case**: Payment reconciliation, failed payment retry

#### Unique Index for Appointment Payment
```sql
CREATE UNIQUE INDEX idx_payment_appointment ON "Payment"(appointmentId);
```
- **Purpose**: Ensure one-to-one relationship between appointment and payment
- **Query Pattern**: `WHERE appointmentId = ?`
- **Constraint**: Prevents duplicate payments

### 7. Notification Indexes

#### Composite Index for User Notifications
```sql
CREATE INDEX idx_notification_user_status_sent ON "Notification"(userId, status, sentAt DESC);
```
- **Purpose**: Retrieve user's notifications with status filter
- **Query Pattern**: `WHERE userId = ? AND status = ? ORDER BY sentAt DESC`
- **Use Case**: Notification list, unread count

#### Composite Index for Notification Type
```sql
CREATE INDEX idx_notification_type_sent ON "Notification"(type, sentAt DESC);
```
- **Purpose**: Find notifications by type
- **Query Pattern**: `WHERE type = ? ORDER BY sentAt DESC`
- **Use Case**: Analytics, notification tracking

### 8. Audit Log Indexes

#### Composite Index for User Audit Trail
```sql
CREATE INDEX idx_auditlog_user_created ON "AuditLog"(userId, createdAt DESC);
```
- **Purpose**: Retrieve user's audit trail
- **Query Pattern**: `WHERE userId = ? ORDER BY createdAt DESC`
- **Use Case**: Compliance reporting, security audit

#### Composite Index for Resource Audit Trail
```sql
CREATE INDEX idx_auditlog_resource_created ON "AuditLog"(resource, resourceId, createdAt DESC);
```
- **Purpose**: Track all operations on a specific resource
- **Query Pattern**: `WHERE resource = ? AND resourceId = ? ORDER BY createdAt DESC`
- **Use Case**: Data lineage, change history

#### Composite Index for Action Audit
```sql
CREATE INDEX idx_auditlog_action_created ON "AuditLog"(action, createdAt DESC);
```
- **Purpose**: Find all actions of a specific type
- **Query Pattern**: `WHERE action = ? ORDER BY createdAt DESC`
- **Use Case**: Security monitoring, compliance audit

### 9. EHR Integration Indexes

#### Composite Index for Patient EHR Connections
```sql
CREATE INDEX idx_ehrconnection_patient_status ON "EHRConnection"(patientId, status);
```
- **Purpose**: Find patient's active EHR connections
- **Query Pattern**: `WHERE patientId = ? AND status = 'ACTIVE'`
- **Use Case**: EHR sync, data import

#### Composite Index for EHR System Connections
```sql
CREATE INDEX idx_ehrconnection_system_status ON "EHRConnection"(system, status);
```
- **Purpose**: Find all connections to a specific EHR system
- **Query Pattern**: `WHERE system = ? AND status = 'ACTIVE'`
- **Use Case**: System health monitoring, bulk sync

#### Composite Index for Sync Logs
```sql
CREATE INDEX idx_ehrsynclog_connection_started ON "EHRSyncLog"(connectionId, startedAt DESC);
```
- **Purpose**: Retrieve sync history for a connection
- **Query Pattern**: `WHERE connectionId = ? ORDER BY startedAt DESC`
- **Use Case**: Sync monitoring, error tracking

### 10. Analytics Indexes

#### Composite Index for Metrics by Period
```sql
CREATE INDEX idx_analyticsmetric_type_period ON "AnalyticsMetric"(type, periodStart, periodEnd);
```
- **Purpose**: Retrieve metrics for a specific type and period
- **Query Pattern**: `WHERE type = ? AND periodStart >= ? AND periodEnd <= ?`
- **Use Case**: Dashboard analytics, trend analysis

#### Composite Index for Doctor Metrics
```sql
CREATE INDEX idx_analyticsmetric_doctor_period ON "AnalyticsMetric"(doctorId, periodStart);
```
- **Purpose**: Retrieve doctor-specific metrics over time
- **Query Pattern**: `WHERE doctorId = ? AND periodStart >= ?`
- **Use Case**: Doctor performance tracking

#### Composite Index for Scheduled Reports
```sql
CREATE INDEX idx_analyticsreport_scheduled_nextrun ON "AnalyticsReport"(scheduled, nextRunAt);
```
- **Purpose**: Find reports scheduled to run
- **Query Pattern**: `WHERE scheduled = true AND nextRunAt <= ?`
- **Use Case**: Report generation scheduler

## Index Maintenance

### Monitoring Index Usage
```sql
-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Check index size
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Reindexing Strategy
- **Frequency**: Weekly during low-traffic periods
- **Strategy**: `REINDEX INDEX CONCURRENTLY` to avoid blocking
- **Automation**: Scheduled via cron job

### Index Bloat Management
```sql
-- Check for index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  pg_stat_get_dead_tuples(c.oid) as dead_tuples
FROM pg_stat_user_indexes s
JOIN pg_class c ON s.indexrelid = c.oid
WHERE pg_stat_get_dead_tuples(c.oid) > 1000;
```

## Performance Considerations

### Write Performance
- Indexes increase write latency
- Consider removing unused indexes
- Use partial indexes where possible
- Batch inserts with index rebuild after

### Read Performance
- Composite indexes should match query patterns
- Include frequently accessed columns in covering indexes
- Use index-only scans when possible
- Consider BRIN indexes for time-series data

### Memory Considerations
- Indexes consume memory in shared_buffers
- Monitor cache hit ratio
- Increase work_mem for complex queries
- Consider partitioning for large tables

## Query Optimization Examples

### Before Indexing
```sql
-- Slow query: full table scan
SELECT * FROM "Appointment" 
WHERE doctorId = 'xxx' 
  AND scheduledAt >= '2024-01-01' 
  AND status = 'CONFIRMED';
-- Execution time: ~500ms
```

### After Indexing
```sql
-- Fast query: index scan
SELECT * FROM "Appointment" 
WHERE doctorId = 'xxx' 
  AND scheduledAt >= '2024-01-01' 
  AND status = 'CONFIRMED';
-- Execution time: ~5ms (100x faster)
```

## Recommendations

1. **Monitor index usage** regularly and remove unused indexes
2. **Use EXPLAIN ANALYZE** to verify index usage
3. **Consider partial indexes** for frequently filtered queries
4. **Use covering indexes** to avoid table access
5. **Reindex periodically** to maintain performance
6. **Partition large tables** with date ranges
7. **Use BRIN indexes** for append-only time-series data
8. **Monitor index bloat** and reindex when necessary
