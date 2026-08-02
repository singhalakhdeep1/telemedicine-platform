# Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)
- AWS Account (for S3 storage)
- Stripe Account (for payments)
- SendGrid Account (for emails)

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/telemedicine
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
FRONTEND_URL=http://localhost:3000
PORT=3001

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=telemedicine-uploads

# SendGrid
SENDGRID_API_KEY=SG.xxx

# WebRTC
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=username
TURN_CREDENTIAL=credential
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
```

## Deployment Steps

### Backend (NestJS)

1. **Build the application**
```bash
cd backend
npm install
npm run build
```

2. **Run database migrations**
```bash
npx prisma migrate deploy
```

3. **Start the server**
```bash
npm run start:prod
```

Or use PM2 for production:
```bash
pm2 start dist/main.js --name telemedicine-api
```

### Frontend (Next.js)

1. **Build the application**
```bash
cd frontend
npm install
npm run build
```

2. **Start the server**
```bash
npm run start
```

Or deploy to Vercel:
```bash
vercel --prod
```

### Docker Deployment

1. **Build and run with Docker Compose**
```bash
docker-compose up -d
```

2. **Run migrations**
```bash
docker-compose exec backend npx prisma migrate deploy
```

## Production Considerations

- Use HTTPS for all endpoints
- Enable rate limiting
- Set up proper logging (Winston, ELK)
- Configure backups for PostgreSQL
- Set up monitoring (Prometheus, Grafana)
- Enable CORS only for trusted domains
- Use environment-specific configurations
- Implement proper error handling
- Set up CI/CD pipeline (GitHub Actions, GitLab CI)

## HIPAA Compliance Checklist

- [ ] All data encrypted at rest (AES-256)
- [ ] All data encrypted in transit (TLS 1.3)
- [ ] Audit logging enabled for all PHI access
- [ ] Role-based access control implemented
- [ ] Business Associate Agreements (BAAs) signed with vendors
- [ ] Data retention policy implemented (7+ years)
- [ ] Secure authentication (MFA recommended)
- [ ] Regular security audits
- [ ] Incident response plan in place
- [ ] Employee training on HIPAA requirements
