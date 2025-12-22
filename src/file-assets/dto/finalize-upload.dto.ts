export class FinalizeUploadDto {
  provider?: 's3' | 'minio' | 'gdrive' | 'external'
  bucket: string
  key: string
  mimeType?: string
  sizeBytes?: number
  sha256?: string
  previewKey?: string
  sourceUrl?: string
  expiresAt?: Date
}
