require('dotenv').config();
const backupService = require('./src/services/backup.service');

async function testBackup() {
    console.log('--- MANUAL BACKUP TEST STARTED ---');
    try {
        const result = await backupService.performBackup();
        console.log('SUCCESS:', result);
    } catch (error) {
        console.error('FAILED:', error);
    } finally {
        console.log('--- MANUAL BACKUP TEST COMPLETED ---');
        process.exit();
    }
}

testBackup();
