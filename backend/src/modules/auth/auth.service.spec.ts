import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            patient: { create: jest.fn() },
            doctor: { create: jest.fn() },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        role: 'PATIENT',
        firstName: 'John',
        lastName: 'Doe',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
      jest.spyOn(prisma.user, 'create').mockResolvedValue({
        id: '1',
        email: registerDto.email,
        role: registerDto.role,
        status: 'PENDING_VERIFICATION',
      } as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
    });

    it('should throw error if email already exists', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        role: 'PATIENT',
        firstName: 'John',
        lastName: 'Doe',
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: '1' } as any);

      await expect(service.register(registerDto)).rejects.toThrow();
    });
  });
});
