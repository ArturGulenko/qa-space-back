import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma.service'
import { PresignUploadDto } from './dto/presign-upload.dto'
import { FinalizeUploadDto } from './dto/finalize-upload.dto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class FileAssetsService {
  private s3: S3Client | null = null
  private readonly bucket: string
  private readonly forcePathStyle: boolean

  constructor(private configService: ConfigService, private prisma: PrismaService) {
    this.bucket = this.configService.get<string>('S3_BUCKET') || ''
    this.forcePathStyle = (this.configService.get<string>('S3_FORCE_PATH_STYLE') || 'true') === 'true'
  }

  private getS3Client(): S3Client {
    if (this.s3) return this.s3
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1'
    const endpoint = this.configService.get<string>('S3_ENDPOINT')
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY')
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY')

    if (!accessKeyId || !secretAccessKey || !this.bucket) {
      throw new InternalServerErrorException('S3 is not configured')
    }

    this.s3 = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: this.forcePathStyle,
    })
    return this.s3
  }

  async presignUpload(projectId: number, workspaceId: number, dto: PresignUploadDto, userId: number) {
    const key = `${workspaceId}/${projectId}/${uuidv4()}-${dto.fileName}`
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.mimeType,
    })

    const uploadUrl = await getSignedUrl(this.getS3Client(), command, { expiresIn: 60 * 10 })

    return {
      provider: 's3',
      bucket: this.bucket,
      key,
      uploadUrl,
      expiresIn: 600,
    }
  }

  async finalize(projectId: number, workspaceId: number, dto: FinalizeUploadDto, userId: number) {
    const asset = await this.prisma.fileAsset.create({
      data: {
        provider: dto.provider || 's3',
        bucket: dto.bucket,
        key: dto.key,
        mimeType: dto.mimeType ?? null,
        sizeBytes: dto.sizeBytes ?? null,
        sha256: dto.sha256 ?? null,
        previewKey: dto.previewKey ?? null,
        sourceUrl: dto.sourceUrl ?? null,
        expiresAt: dto.expiresAt ?? null,
        workspaceId,
        projectId,
        uploadedById: userId,
      },
    })

    return asset
  }
}
