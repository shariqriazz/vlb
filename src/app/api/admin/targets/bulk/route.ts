import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { VertexTarget } from '@/lib/models/VertexTarget'; // Updated import
import { logError } from '@/lib/services/logger';
// Removed iron-session imports - assuming middleware handles auth

export async function PATCH(req: NextRequest) {
  // Removed explicit session check - assuming middleware handles auth
  let action: string = 'unknown'; // Declare action outside try block
  try {
    const body = await req.json();
    // Assign action from body inside the try block
    action = body.action;
    const { targetIds, dailyRateLimit } = body; // Renamed keyIds to targetIds, dailyRequestLimit to dailyRateLimit

    // --- Input Validation ---
    if (!action || (action !== 'setLimit' && action !== 'delete')) {
        return NextResponse.json({ error: 'Invalid or missing action specified. Must be "setLimit" or "delete".' }, { status: 400 });
    }
    if (!Array.isArray(targetIds) || targetIds.length === 0) { // Use targetIds
      return NextResponse.json({ error: 'targetIds must be a non-empty array' }, { status: 400 });
    }
    if (targetIds.some(id => typeof id !== 'string' || id.trim() === '')) { // Use targetIds
        return NextResponse.json({ error: 'All targetIds must be non-empty strings' }, { status: 400 });
    }

    // Validate specific fields based on action
    if (action === 'setLimit') {
        // Validate dailyRateLimit (allow null for no limit)
        if (dailyRateLimit !== null && (typeof dailyRateLimit !== 'number' || !Number.isInteger(dailyRateLimit) || dailyRateLimit < 0)) { // Use dailyRateLimit
            return NextResponse.json({ error: 'dailyRateLimit must be a non-negative integer or null' }, { status: 400 });
        }
    }
    // --- End Validation ---

    const db = await getDb();

    // Construct the placeholders for the IN clause
    const placeholders = targetIds.map(() => '?').join(','); // Use targetIds
    let result;
    let successMessage = '';
    let count = 0;

    if (action === 'setLimit') {
        const stmt = await db.prepare(
            `UPDATE vertex_targets SET dailyRateLimit = ? WHERE _id IN (${placeholders})` // Updated table name
        );
        // Bind parameters: first the limit, then all the IDs
        result = await stmt.run(dailyRateLimit, ...targetIds); // Use dailyRateLimit and targetIds
        await stmt.finalize();
        count = result.changes || 0;
        successMessage = `Successfully updated daily limit for ${count} targets.`; // Updated message
        if (count === 0) {
            console.warn(`Bulk update limit attempted for target IDs [${targetIds.join(', ')}] but no rows were changed.`); // Updated message
        }

    } else if (action === 'delete') {
        const stmt = await db.prepare(
            `DELETE FROM vertex_targets WHERE _id IN (${placeholders})` // Updated table name
        );
        // Bind parameters: all the IDs
        result = await stmt.run(...targetIds); // Use targetIds
        await stmt.finalize();
        count = result.changes || 0;
        successMessage = `Successfully deleted ${count} targets.`; // Updated message
        if (count === 0) {
            console.warn(`Bulk delete attempted for target IDs [${targetIds.join(', ')}] but no rows were changed.`); // Updated message
        }
        // Optionally log the bulk delete event here if needed using logTargetEvent
    }

    return NextResponse.json({ message: successMessage, count });

  } catch (error: any) {
    logError(error, { context: `API Bulk Target Action (${action})` }); // Updated context
    let errorMessage = `Failed to perform bulk target action (${action})`; // Updated message
    if (error instanceof SyntaxError) { // Handle JSON parsing errors
        errorMessage = 'Invalid request body format.';
    } else if (error.message) {
        // Include more specific DB errors if safe and available
        // errorMessage = `Failed to perform bulk key update: ${error.message}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}