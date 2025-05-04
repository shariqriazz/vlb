import { NextResponse } from 'next/server';
import { VertexTarget } from '@/lib/models/VertexTarget'; // Updated import
import { logError } from '@/lib/services/logger';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  // --- Authentication Check ---
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (process.env.REQUIRE_ADMIN_LOGIN !== 'false' && !session.isLoggedIn) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  // --- End Authentication Check ---

  try {
    // Fetch all targets from the database
    const targets = await VertexTarget.findAll({}); // Fetch VertexTarget instances

    // Convert instances to plain data objects, including the SA key
    const targetsData = targets.map(targetInstance => ({
        _id: targetInstance._id,
        name: targetInstance.name,
        projectId: targetInstance.projectId,
        location: targetInstance.location,
        // modelId: targetInstance.modelId, // Removed
        serviceAccountKeyJson: targetInstance.serviceAccountKeyJson, // Include SA Key
        isActive: targetInstance.isActive,
        lastUsed: targetInstance.lastUsed,
        rateLimitResetAt: targetInstance.rateLimitResetAt,
        failureCount: targetInstance.failureCount,
        requestCount: targetInstance.requestCount,
        dailyRateLimit: targetInstance.dailyRateLimit,
        dailyRequestsUsed: targetInstance.dailyRequestsUsed,
        lastResetDate: targetInstance.lastResetDate,
        isDisabledByRateLimit: targetInstance.isDisabledByRateLimit,
    }));


    // Create a JSON response with headers for file download
    const jsonString = JSON.stringify(targetsData, null, 2); // Pretty print JSON
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    // Updated filename
    headers.set('Content-Disposition', `attachment; filename="lb-targets-export-${new Date().toISOString().split('T')[0]}.json"`);

    return new NextResponse(jsonString, { status: 200, headers });

  } catch (error: any) {
    logError(error, { context: 'Export Vertex Targets' }); // Updated context
    return NextResponse.json(
      { message: 'Failed to export Vertex targets', error: error.message }, // Updated message
      { status: 500 }
    );
  }
}