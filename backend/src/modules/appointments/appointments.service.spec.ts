import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: {
            doctor: { findUnique: jest.fn() },
            appointment: {
              findFirst: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            availabilitySlot: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAppointment', () => {
    it('should create a new appointment', async () => {
      const data = {
        doctorId: '1',
        scheduledAt: new Date(),
        duration: 30,
        reason: 'Checkup',
        symptoms: 'Headache',
      };

      jest.spyOn(prisma.doctor, 'findUnique').mockResolvedValue({
        id: '1',
        availabilitySlots: [],
      } as any);
      jest.spyOn(prisma.appointment, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.appointment, 'create').mockResolvedValue({
        id: '1',
        ...data,
      } as any);

      const result = await service.createAppointment('patient-1', data);

      expect(result).toHaveProperty('id');
    });
  });
});
