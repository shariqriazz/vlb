import { NextRequest, NextResponse } from 'next/server';
import { VertexTarget, VertexTargetData } from '@/lib/models/VertexTarget'; // Changed ApiKey to VertexTarget
import { RequestLogData } from '@/lib/models/RequestLog'; // Keep for type checking
import { Settings } from '@/lib/db'; // Import Settings type
import { logError } from '@/lib/services/logger'; // Removed logKeyEvent import
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db'; // Import getDb for transaction

// Helper to convert boolean to DB value (0/1) - needed if inserting raw
function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}


export async function POST(req: NextRequest) {
  // --- Authentication Check ---
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (process.env.REQUIRE_ADMIN_LOGIN !== 'false' && !session.isLoggedIn) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // --- End Authentication Check ---

  let results = {
    targets: 0, // Renamed keys to targets
    settings: 0,
    logs: 0,
    errors: [] as string[],
  };

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/json') {
      return NextResponse.json({ message: 'Invalid file type. Please upload a JSON file.' }, { status: 400 });
    }

    const fileContent = await file.text();
    // Updated importData type to expect vertex_targets
    let importData: { version?: number; exportedAt?: string; data?: { vertex_targets?: any[], settings?: any, request_logs?: any[] } };

    try {
      importData = JSON.parse(fileContent);
      // Basic validation of structure
      if (!importData || typeof importData !== 'object' || !importData.data || typeof importData.data !== 'object') {
          throw new Error('Invalid JSON structure: Missing top-level "data" object.');
      }
       // Updated validation to check for vertex_targets array
       if (!Array.isArray(importData.data.vertex_targets)) {
           throw new Error('Invalid JSON structure: "data.vertex_targets" is not an array.');
       }
       if (typeof importData.data.settings !== 'object' || importData.data.settings === null) {
           throw new Error('Invalid JSON structure: "data.settings" is not an object.');
       }
       if (!Array.isArray(importData.data.request_logs)) {
           throw new Error('Invalid JSON structure: "data.request_logs" is not an array.');
       }
       // Add version check if needed in the future
       // if (importData.version !== 1) { ... }

    } catch (parseError: any) {
      logError(parseError, { context: 'Import All Data - JSON Parsing' });
      return NextResponse.json(
        { message: 'Failed to parse JSON file or invalid structure', error: parseError.message },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.run('BEGIN TRANSACTION'); // Start transaction

    try {
      // Clear existing data
      await db.run('DELETE FROM request_logs');
      await db.run('DELETE FROM vertex_targets'); // Changed api_keys to vertex_targets
      await db.run('DELETE FROM settings'); // Should only be one row, but DELETE is safe

      // Import Settings (only one row expected)
      if (importData.data.settings) {
          const settingsString = JSON.stringify(importData.data.settings);
          await db.run('INSERT INTO settings (id, config) VALUES (?, ?)', 1, settingsString);
          results.settings = 1;
      }

      // Import Vertex Targets
      if (importData.data.vertex_targets) { // Changed api_keys to vertex_targets
        // Updated INSERT statement for vertex_targets table with correct column names
        const stmtTargets = await db.prepare(
          `INSERT INTO vertex_targets (_id, projectId, location, serviceAccountKeyJson, name, isActive, lastUsed, failureCount, requestCount, dailyRequestsUsed, lastResetDate, isDisabledByRateLimit, rateLimitResetAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const target of importData.data.vertex_targets) {
          // Add basic validation if needed, or rely on DB constraints
          // modelId is removed from the table and should not be inserted
          const { modelId, ...targetWithoutModelId } = target; // Ensure modelId is not passed
          await stmtTargets.run(
            targetWithoutModelId._id, targetWithoutModelId.projectId, targetWithoutModelId.location,
            targetWithoutModelId.serviceAccountKeyJson,
            targetWithoutModelId.name,
            booleanToDb(targetWithoutModelId.isActive), // Convert boolean
            target.lastUsed,
            target.failureCount ?? 0, target.requestCount ?? 0,
            target.dailyRequestsUsed ?? 0,
            target.lastResetDate,
            // Handle both old and new field names for backward compatibility
            booleanToDb(target.isDisabledByRateLimit ?? target.isDisabledByFailure ?? false),
            target.rateLimitResetAt ?? null
          );
          results.targets++; // Renamed keys to targets
        }
        await stmtTargets.finalize(); // Changed stmtKeys to stmtTargets
      }

      // Import Request Logs
      if (importData.data.request_logs) {
        const stmtLogs = await db.prepare(
          // Updated INSERT statement for request_logs to use targetId
          `INSERT INTO request_logs (_id, targetId, timestamp, modelUsed, responseTime, statusCode, isError, errorType, errorMessage, ipAddress, promptTokens, completionTokens, totalTokens, isStreaming, requestId, requestedModel)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        for (const log of importData.data.request_logs) {
           // Add basic validation if needed
           await stmtLogs.run(
             log._id, log.targetId, log.timestamp, // Changed apiKeyId to targetId
             log.modelUsed, log.responseTime, log.statusCode,
             booleanToDb(log.isError), // Convert boolean
             log.errorType, log.errorMessage, log.ipAddress,
             // Add new fields (assuming they might be in the export)
             log.promptTokens, log.completionTokens, log.totalTokens,
             booleanToDb(log.isStreaming ?? false), // Handle potential null
             log.requestId, log.requestedModel
           );
           results.logs++;
        }
        await stmtLogs.finalize();
      }

      await db.run('COMMIT'); // Commit transaction

    } catch (importError: any) {
        await db.run('ROLLBACK'); // Rollback on any error during import
        logError(importError, { context: 'Import All Data - DB Operation' });
        results.errors.push(`Database import failed: ${importError.message}`);
        // Re-throw or handle differently if needed
         return NextResponse.json(
            { message: 'Database import failed during transaction.', error: importError.message, results },
            { status: 500 }
         );
    }

    return NextResponse.json({
      message: 'Data import completed successfully.',
      results
    });

  } catch (error: any) {
    // Catch errors outside the transaction (e.g., file read)
    logError(error, { context: 'Import All Data - General' });
    return NextResponse.json(
      { message: 'Failed to import data', error: error.message },
      { status: 500 }
    );
  }
}