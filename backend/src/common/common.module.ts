import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health.controller';
import { PrismaModule } from '../modules/prisma/prisma.module';

@Module({
  imports: [
    TerminusModule.forRoot({
      errorLogStyle: 'json',
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class CommonModule {}
