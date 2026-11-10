import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Private S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces...).
 * Objects are written without public ACLs; downloads use short-lived signed URLs.
 */
export function createS3Storage(env) {
  const missing = ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter((k) => !env[k]);
  if (missing.length) throw new Error(`S3 storage is selected but not configured: missing ${missing.join(', ')}`);

  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  const Bucket = env.S3_BUCKET;

  return {
    name: 's3',
    async put(key, buffer, contentType) {
      await client.send(new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: contentType, ServerSideEncryption: env.S3_ENDPOINT ? undefined : 'AES256' }));
    },
    async getStream(key) {
      const out = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      return out.Body;
    },
    async getBuffer(key) {
      const out = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      return Buffer.from(await out.Body.transformToByteArray());
    },
    async getSignedUrl(key, { downloadName, contentType } = {}) {
      const cmd = new GetObjectCommand({
        Bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `attachment; filename="${downloadName.replace(/"/g, '')}"` : 'attachment',
        ResponseContentType: contentType,
      });
      return getSignedUrl(client, cmd, { expiresIn: env.SIGNED_URL_TTL_SECONDS });
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
  };
}
