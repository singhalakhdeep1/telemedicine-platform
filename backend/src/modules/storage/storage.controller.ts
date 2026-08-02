import { Controller, Post, Delete, Get, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body: { prefix?: string }) {
    const key = this.storageService.generateKey(body.prefix || 'uploads', file.originalname);
    const fileUrl = await this.storageService.uploadFile(file, key);
    return { fileUrl, key };
  }

  @Delete('file/:key')
  async deleteFile(@Param('key') key: string) {
    await this.storageService.deleteFile(key);
    return { message: 'File deleted successfully' };
  }

  @Get('url/:key')
  async getFileUrl(@Param('key') key: string, @Body() body?: { expiresIn?: number }) {
    const expiresIn = body?.expiresIn || 3600;
    const fileUrl = await this.storageService.getFileUrl(key, expiresIn);
    return { fileUrl };
  }
}
