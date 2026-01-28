// Image Upload Service for Supabase Storage
const supabaseService = require('./supabaseService');
const { randomUUID } = require('crypto');

class ImageUploadService {
    /**
     * Upload image to Supabase Storage
     * @param {Buffer|File} file - The image file
     * @param {string} bucket - Bucket name (e.g., 'event-images')
     * @param {string} folder - Optional folder path
     * @returns {Promise<{url: string, path: string}>}
     */
    async uploadImage(file, bucket = 'event-images', folder = '') {
        try {
            // Generate unique filename
            const fileExt = file.originalname?.split('.').pop() || 'jpg';
            const fileName = `${randomUUID()}.${fileExt}`;
            const filePath = folder ? `${folder}/${fileName}` : fileName;

            console.log('📤 Uploading image:', { bucket, filePath, size: file.size });

            // Upload to Supabase Storage
            const { data, error } = await supabaseService.client.storage
                .from(bucket)
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('❌ Upload error:', error);
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabaseService.client.storage
                .from(bucket)
                .getPublicUrl(filePath);

            console.log('✅ Image uploaded:', publicUrl);

            return {
                url: publicUrl,
                path: filePath,
                bucket: bucket
            };
        } catch (error) {
            console.error('❌ Image upload failed:', error);
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }

    /**
     * Delete image from Supabase Storage
     * @param {string} filePath - The file path in storage
     * @param {string} bucket - Bucket name
     */
    async deleteImage(filePath, bucket = 'event-images') {
        try {
            console.log('🗑️ Deleting image:', { bucket, filePath });

            const { error } = await supabaseService.client.storage
                .from(bucket)
                .remove([filePath]);

            if (error) {
                console.error('❌ Delete error:', error);
                throw error;
            }

            console.log('✅ Image deleted');
            return { success: true };
        } catch (error) {
            console.error('❌ Image deletion failed:', error);
            throw new Error(`Failed to delete image: ${error.message}`);
        }
    }

    /**
     * Update image (delete old, upload new)
     * @param {Buffer|File} newFile - The new image file
     * @param {string} oldFilePath - The old file path to delete
     * @param {string} bucket - Bucket name
     * @param {string} folder - Optional folder path
     */
    async updateImage(newFile, oldFilePath, bucket = 'event-images', folder = '') {
        try {
            // Delete old image if exists
            if (oldFilePath) {
                await this.deleteImage(oldFilePath, bucket).catch(err => {
                    console.warn('⚠️ Could not delete old image:', err.message);
                });
            }

            // Upload new image
            return await this.uploadImage(newFile, bucket, folder);
        } catch (error) {
            console.error('❌ Image update failed:', error);
            throw new Error(`Failed to update image: ${error.message}`);
        }
    }

    /**
     * Validate image file
     * @param {File} file - The file to validate
     * @returns {boolean}
     */
    validateImage(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!file) {
            throw new Error('No file provided');
        }

        if (!allowedTypes.includes(file.mimetype)) {
            throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed');
        }

        if (file.size > maxSize) {
            throw new Error('File too large. Maximum size is 5MB');
        }

        return true;
    }
}

module.exports = new ImageUploadService();
