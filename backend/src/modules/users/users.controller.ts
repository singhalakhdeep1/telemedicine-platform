import { Controller, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, DoctorSpecialization, DoctorStatus } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('patient/profile')
  async updatePatientProfile(@Request() req, @Body() data: any) {
    return this.usersService.updatePatientProfile(req.user.id, data);
  }

  @Put('doctor/profile')
  async updateDoctorProfile(@Request() req, @Body() data: any) {
    return this.usersService.updateDoctorProfile(req.user.id, data);
  }

  @Get('doctors')
  async getDoctors(
    @Param('specialization') specialization?: DoctorSpecialization,
    @Param('status') status?: DoctorStatus,
  ) {
    return this.usersService.getDoctors({ specialization, status });
  }

  @Get('doctors/:id')
  async getDoctorById(@Param('id') id: string) {
    return this.usersService.getDoctorById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('all')
  async getAllUsers(@Param('role') role?: UserRole) {
    return this.usersService.getAllUsers(role);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id/status')
  async updateUserStatus(@Param('id') id: string, @Body() data: { status: any }) {
    return this.usersService.updateUserStatus(id, data.status);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('doctors/:id/verify')
  async verifyDoctor(@Param('id') id: string, @Body() data: { status: DoctorStatus }) {
    return this.usersService.verifyDoctor(id, data.status);
  }
}
