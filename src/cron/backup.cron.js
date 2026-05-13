const cron = require('node-cron');
const backupService = require('../services/backup.service');

/**
 * Initializes the backup cron job
 * Schedule: 0 2 * * * (Daily at 2:00 AM)
 * Timezone: Asia/Kolkata
 */
const initBackupCron = () => {
    console.log('[cron] Initializing MongoDB backup schedule for AnsariMart...');
    
    // Schedule: 0 2 * * * (2:00 AM IST)
    cron.schedule('0 2 * * *', async () => {
        console.log('[cron] Starting scheduled backup at 2:00 AM IST');
        try {
            await backupService.performBackup();
            console.log('[cron] Scheduled backup completed successfully.');
        } catch (error) {
            console.error('[cron] Scheduled backup failed:', error);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('[cron] Backup schedule set: 0 2 * * * (Asia/Kolkata)');
};

module.exports = initBackupCron;
