import { v2 as cloudinary } from 'cloudinary';
import type { ImageProvider } from './upload';

export function cloudinaryProvider(config: {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}): ImageProvider {
  const credentials = {
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  };
  return {
    upload: (buffer, publicId) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            ...credentials,
            public_id: publicId,
            resource_type: 'image',
            type: 'upload',
            overwrite: false,
            allowed_formats: ['jpg', 'png', 'webp'],
            max_pixels: 40_000_000,
          },
          (error, result) => {
            if (error || !result) return reject(new Error('Cloudinary upload failed.'));
            resolve({
              assetId: result.asset_id,
              publicId: result.public_id,
              version: result.version,
              format: result.format,
              width: result.width,
              height: result.height,
            });
          },
        );
        stream.on('error', () => reject(new Error('Cloudinary stream failed.')));
        stream.end(buffer);
      }),
    remove: async (publicId) => {
      await cloudinary.uploader.destroy(publicId, {
        ...credentials,
        resource_type: 'image',
        type: 'upload',
        invalidate: true,
      });
    },
  };
}
