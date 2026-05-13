const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

class BackupService {
    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    /**
     * Main method to perform the backup process
     */
    async performBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
        const backupName = `backup-${timestamp}`;
        const backupDir = path.join(process.cwd(), 'backups');
        const dumpPath = path.join(backupDir, backupName);
        const zipPath = `${dumpPath}.zip`;

        try {
            // Ensure backup directory exists
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
                console.log(`[cleanup] Created backup directory: ${backupDir}`);
            }

            // 1. Execute mongodump
            console.log(`[dump] Starting MongoDB dump for: ${process.env.DB_NAME}`);
            await this.executeMongoDump(dumpPath);
            console.log(`[dump] MongoDB dump completed at: ${dumpPath}`);

            // 2. Compress the dump directory
            console.log(`[zip] Creating ZIP archive: ${zipPath}`);
            await this.compressDirectory(dumpPath, zipPath);
            console.log(`[zip] ZIP archive created successfully.`);

            // 3. Upload to AWS S3
            console.log(`[upload] Uploading to S3 bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
            await this.uploadToS3(zipPath, `${backupName}.zip`);
            console.log(`[upload] Backup successfully uploaded to S3.`);

            return { success: true, backupName };

        } catch (error) {
            console.error(`[error] Backup process failed:`, error);
            throw error;
        } finally {
            // 4. Cleanup local files
            // Wait 1 second for file streams to fully close on Windows
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log(`[cleanup] Starting cleanup of temporary files...`);
            this.cleanup(dumpPath, zipPath);
            console.log(`[cleanup] Cleanup completed.`);
        }
    }

    executeMongoDump(outputPath) {
        return new Promise((resolve, reject) => {
            // Construct URI for MongoDB Atlas (SRV)
            const mongoUri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/${process.env.DB_NAME}`;
            
            const command = process.env.MONGODUMP_PATH || 'mongodump';

            console.log(`[dump] Executing: ${command}`);
            const dump = spawn(command, [
                `--uri=${mongoUri}`,
                `--out=${outputPath}`
            ], { shell: true });

            dump.stdout.on('data', (data) => process.stdout.write(data));
            dump.stderr.on('data', (data) => process.stderr.write(data));

            dump.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`mongodump process exited with code ${code}`));
                }
            });

            dump.on('error', (err) => {
                reject(new Error(`Failed to start mongodump: ${err.message}`));
            });
        });
    }

    /**
     * Compresses a directory into a zip file
     */
    compressDirectory(sourceDir, outPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            output.on('close', () => {
                resolve();
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);
            archive.directory(sourceDir, false);
            archive.finalize();
        });
    }

    /**
     * Uploads a file to AWS S3
     */
    async uploadToS3(filePath, fileName) {
        const fileStream = fs.createReadStream(filePath);
        
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: `db-backups/${fileName}`,
            Body: fileStream,
            ContentType: 'application/zip'
        });

        try {
            const result = await this.s3Client.send(command);
            return result;
        } catch (error) {
            throw new Error(`S3 Upload failed: ${error.message}`);
        } finally {
            fileStream.destroy();
        }
    }

    /**
     * Deletes temporary files and directories
     */
    cleanup(dumpPath, zipPath) {
        try {
            if (fs.existsSync(dumpPath)) {
                fs.rmSync(dumpPath, { recursive: true, force: true });
                console.log(`[cleanup] Deleted dump directory: ${dumpPath}`);
            }
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
                console.log(`[cleanup] Deleted zip file: ${zipPath}`);
            }
        } catch (err) {
            console.error(`[cleanup] Error during cleanup:`, err);
        }
    }
}

module.exports = new BackupService();
