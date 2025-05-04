import { NextRequest, NextResponse } from 'next/server';
import { VertexTarget, VertexTargetData } from '@/lib/models/VertexTarget'; // Updated imports
import { logError, logTargetEvent } from '@/lib/services/logger'; // Updated import
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db'; // Import getDb for transaction

export async function POST(req: NextRequest) {
  // --- Authentication Check ---
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (process.env.REQUIRE_ADMIN_LOGIN !== 'false' && !session.isLoggedIn) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // --- End Authentication Check ---

  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

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
    let importedTargets: Partial<VertexTargetData>[]; // Renamed variable and type

    try {
      importedTargets = JSON.parse(fileContent); // Renamed variable
      if (!Array.isArray(importedTargets)) { // Check renamed variable
        throw new Error('Invalid JSON format: Expected an array of target objects.'); // Updated error message
      }
    } catch (parseError: any) {
      logError(parseError, { context: 'Import Vertex Targets - JSON Parsing' }); // Updated context
      return NextResponse.json(
        { message: 'Failed to parse JSON file', error: parseError.message },
        { status: 400 }
      );
    }

    const db = await getDb();
    await db.run('BEGIN TRANSACTION'); // Start transaction

    try {
      for (const targetData of importedTargets) { // Loop through targets
        // Basic validation for required VertexTarget fields
        const requiredFields: (keyof VertexTargetData)[] = ['projectId', 'location', 'modelId', 'serviceAccountKeyJson'];
        const missingFields = requiredFields.filter(field => !targetData[field] || typeof targetData[field] !== 'string');

        if (missingFields.length > 0) {
          errors.push(`Skipped entry due to missing or invalid required fields (${missingFields.join(', ')}): ${JSON.stringify(targetData)}`);
          skippedCount++;
          continue;
        }

        try {
          // Find existing target by unique combination or _id if provided
          let existingTarget: VertexTarget | null = null;
          if (targetData._id) {
              existingTarget = await VertexTarget.findOne({ _id: targetData._id });
          }
          // If not found by _id or _id wasn't provided, try the unique combination
          if (!existingTarget) {
              existingTarget = await VertexTarget.findOne({
                  projectId: targetData.projectId,
                  location: targetData.location,
                  modelId: targetData.modelId
              });
          }


          if (existingTarget) {
            // Update existing target
            existingTarget.name = targetData.name !== undefined ? targetData.name : existingTarget.name;
            existingTarget.isActive = targetData.isActive !== undefined ? targetData.isActive : existingTarget.isActive;
            existingTarget.dailyRateLimit = targetData.dailyRateLimit !== undefined ? targetData.dailyRateLimit : existingTarget.dailyRateLimit;
            // IMPORTANT: Update the SA Key JSON
            existingTarget.serviceAccountKeyJson = targetData.serviceAccountKeyJson!; // Already validated non-null/string
            // Reset stats/status fields on update? Or keep existing? Keeping existing for now.
            // existingTarget.failureCount = 0;
            // existingTarget.rateLimitResetAt = null;
            // existingTarget.dailyRequestsUsed = 0;
            // existingTarget.lastResetDate = null;
            // existingTarget.isDisabledByRateLimit = false;

            await existingTarget.save(); // Assumes save() works within transaction
            updatedCount++;
            logTargetEvent('Target Updated (Import)', { targetId: existingTarget._id }); // Use logTargetEvent
          } else {
            // Create new target
            const createData: Partial<VertexTargetData> = {
                ...targetData, // Spread imported data
                // Ensure defaults for fields that might be missing or need resetting
                failureCount: targetData.failureCount ?? 0,
                requestCount: targetData.requestCount ?? 0,
                dailyRequestsUsed: targetData.dailyRequestsUsed ?? 0,
                lastUsed: targetData.lastUsed ?? null,
                rateLimitResetAt: targetData.rateLimitResetAt ?? null,
                lastResetDate: targetData.lastResetDate ?? null,
                isDisabledByRateLimit: targetData.isDisabledByRateLimit ?? false,
                isActive: targetData.isActive ?? true,
            };
             // Remove undefined fields that might cause issues with DB constraints if not nullable
            Object.keys(createData).forEach(k => createData[k as keyof Partial<VertexTargetData>] === undefined && delete createData[k as keyof Partial<VertexTargetData>]);


            const newTarget = await VertexTarget.create(createData as VertexTargetData); // Assumes create() works within transaction
            addedCount++;
            logTargetEvent('Target Added (Import)', { targetId: newTarget._id }); // Use logTargetEvent
          }
        } catch (targetError: any) {
          // Construct a more informative error identifier
          const identifier = targetData._id || `${targetData.projectId}/${targetData.location}/${targetData.modelId}`;
          errors.push(`Error processing target '${identifier}': ${targetError.message}`);
          errorCount++;
          // Continue processing other targets
        }
      }

      await db.run('COMMIT'); // Commit transaction if all loops succeed

    } catch (transactionError: any) {
        await db.run('ROLLBACK'); // Rollback on error during loop/commit
        throw transactionError; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({
      message: 'Import process completed.',
      added: addedCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorDetails: errors,
    });

  } catch (error: any) {
    logError(error, { context: 'Import Vertex Targets' }); // Updated context
    return NextResponse.json(
      { message: 'Failed to import Vertex targets', error: error.message }, // Updated message
      { status: 500 }
    );
  }
}