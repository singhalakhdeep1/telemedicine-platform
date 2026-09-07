import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Bucket: string;
  private readonly awsRegion: string;

  constructor(private configService: ConfigService) {
    this.s3Bucket = this.configService.get('AWS_S3_BUCKET');
    this.awsRegion = this.configService.get('AWS_REGION');
  }

  async uploadFile(file: Express.Multer.File, key: string): Promise<string> {
    this.logger.log(`Uploading file: ${key} to S3 bucket: ${this.s3Bucket}`);

    const fileUrl = `https://${this.s3Bucket}.s3.${this.awsRegion}.amazonaws.com/${key}`;

    this.logger.log(`File uploaded successfully: ${fileUrl}`);
    return fileUrl;
  }

  async deleteFile(key: string): Promise<void> {
    this.logger.log(`Deleting file: ${key} from S3 bucket: ${this.s3Bucket}`);
    
    // Mock implementation - replace with actual S3 delete
    // await s3Client.send(new DeleteObjectCommand({ Bucket: this.s3Bucket, Key: key }));
    
    this.logger.log(`File deleted successfully: ${key}`);
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.logger.log(`Generating presigned URL for: ${key}`);
    
    // Mock implementation - replace with actual S3 presigned URL generation
    const fileUrl = `https://${this.s3Bucket}.s3.${this.awsRegion}.amazonaws.com/${key}`;
    
    return fileUrl;
  }

  generateKey(prefix: string, fileName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    return `${prefix}/${timestamp}-${randomString}-${fileName}`;
  }
}
