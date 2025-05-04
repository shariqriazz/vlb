import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { readSettings } from '@/lib/settings'; // Import readSettings from lib
import { logError, logTargetEvent } from '@/lib/services/logger'; // Use logTargetEvent for admin/target events
import { getDb } from '@/lib/db'; // Import getDb for database operations

// Function to parse date from log filename (similar to stats route)
function parseDateFromFilename(filename: string): Date | null {
  // Match YYYY-MM-DD format
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  // Create date object - important to treat it as UTC to avoid timezone issues
  const [year, month, day] = match[1].split('-').map(Number);
  // JavaScript Date months are 0-indexed
  return new Date(Date.UTC(year, month - 1, day));
}

export async function POST() { // Use POST for actions with side effects
  try {
    logTargetEvent('Admin Action', { action: 'Log cleanup started' });
    const settings = await readSettings();
    const retentionDays = settings.logRetentionDays;

    if (retentionDays <= 0) {
      logTargetEvent('Admin Action', { action: 'Log cleanup skipped', reason: 'Retention days set to 0 or less.' });
      return NextResponse.json({ message: 'Log retention is disabled (retention days <= 0). No files deleted.' });
    }

    // Set cutoffDate to the beginning of the day, retentionDays ago (UTC)
    const cutoffDate = new Date();
    cutoffDate.setUTCHours(0, 0, 0, 0);
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays);

    // Format cutoff date for SQL query (ISO string)
    const cutoffDateISO = cutoffDate.toISOString();

    // Initialize counters and error collection
    let deletedFileCount = 0;
    let deletedDbLogCount = 0;
    const errors: string[] = [];

    // 1. Clean up database logs
    try {
      const db = await getDb();
      const result = await db.run(
        `DELETE FROM request_logs WHERE timestamp < ?`,
        cutoffDateISO
      );

      deletedDbLogCount = result.changes || 0;
      logTargetEvent('Admin Action', {
        action: 'Deleted old database logs',
        count: deletedDbLogCount,
        cutoffDate: cutoffDateISO
      });
    } catch (error: any) {
      const errorMessage = `Failed to delete database logs: ${error.message}`;
      logError(error, { context: 'Log Cleanup - Database' });
      errors.push(errorMessage);
    }

    // 2. Clean up file-based logs
    const logsDir = path.join(process.cwd(), 'logs');
    let files: string[] = [];

    try {
      files = await fs.readdir(logsDir);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        logTargetEvent('Admin Action', { action: 'File log cleanup skipped', reason: 'Logs directory does not exist.' });
        // Continue with the process since we might have cleaned up database logs
      } else {
        const errorMessage = `Failed to read logs directory: ${error.message}`;
        logError(error, { context: 'Log Cleanup - Files' });
        errors.push(errorMessage);
      }
    }

    for (const file of files) {
      // Skip key logs - IMPORTANT: Preserve key logs for usage statistics
      if (file.startsWith('keys-')) {
        continue;
      }
      // Now only process request and error logs
      if (!file.match(/^(requests|errors)-\d{4}-\d{2}-\d{2}\.log$/)) {
          continue; // Skip non-request/error log files
      }

      const fileDate = parseDateFromFilename(file);

      if (fileDate && fileDate < cutoffDate) {
        const filePath = path.join(logsDir, file);
        try {
          await fs.unlink(filePath);
          deletedFileCount++;
          logTargetEvent('Admin Action', { action: 'Deleted old log file', file: file });
        } catch (error: any) {
          const errorMessage = `Failed to delete log file ${file}: ${error.message}`;
          logError(error, { context: 'Log Cleanup - Files', file: file });
          errors.push(errorMessage);
        }
      }
    }

    const summary = {
      message: `Log cleanup finished. Deleted ${deletedDbLogCount} database records and ${deletedFileCount} files older than ${retentionDays} days.`,
      database: {
        deletedCount: deletedDbLogCount,
      },
      files: {
        deletedCount: deletedFileCount,
      },
      retentionDays,
      cutoffDate: cutoffDate.toISOString().split('T')[0], // Show YYYY-MM-DD
      errors,
    };

    logTargetEvent('Admin Action', {
      action: 'Log cleanup finished',
      deletedDbLogCount,
      deletedFileCount,
      errorCount: errors.length
    });
    return NextResponse.json(summary);

  } catch (error: any) {
    logError(error, { context: 'POST /api/admin/cleanup-logs' });
    return NextResponse.json(
      { error: error.message || 'Failed to perform log cleanup' },
      { status: 500 }
    );
  }
}

// Optional: Add a GET handler if you want to check status without running cleanup
// export async function GET() {
//   return NextResponse.json({ message: "Send POST request to trigger log cleanup." });
// }