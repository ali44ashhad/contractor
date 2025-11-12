import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import streamifier from 'streamifier';
import { cloudinary } from '../config/cloudinary';

type CloudinaryUploadOptions = {
  folder?: string;
  resource_type?: 'image' | 'raw' | 'video' | 'auto';
  use_filename?: boolean;
  unique_filename?: boolean;
  filename_override?: string;
} & Record<string, unknown>;

export const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  options: CloudinaryUploadOptions = {}
): Promise<UploadApiResponse> =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        ...options
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error('Cloudinary upload failed without an error response'));
        }

        return resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });


