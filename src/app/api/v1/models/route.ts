export const dynamic = 'force-dynamic'; // Force dynamic rendering
import { NextRequest, NextResponse } from 'next/server';
// Removed axios, keyManager, readSettings imports
import { VertexTarget } from '@/lib/models/VertexTarget'; // Import VertexTarget
import { logError } from '@/lib/services/logger';

/**
 * Returns a list of configured and active Vertex AI target names,
 * formatted like the OpenAI /v1/models response.
 * The load balancer uses these targets internally based on rotation logic,
 * ignoring the model specified by the client.
 */
export async function GET(req: NextRequest) {
  try {
    // Fetch active targets from the database
    const activeTargets = await VertexTarget.findAll({ isActive: true });

    if (!activeTargets || activeTargets.length === 0) {
      logError(new Error('No active Vertex AI targets found'), { context: 'Models endpoint - findAll active' });
      return NextResponse.json(
        { error: { message: 'No active Vertex AI targets configured or available.', type: 'no_targets_available' } },
        { status: 503 } // Service Unavailable
      );
    }

    // Format the response according to OpenAI API spec
    const modelsData = activeTargets.map(target => ({
      id: target.name || target._id, // Use target name or fallback to ID
      object: "model",
      // created: Math.floor(new Date(Date.now()).getTime() / 1000), // Removed 'created' field as no source data
      owned_by: "vertex-ai-lb", // Placeholder owner
      // Add other fields if needed, though 'id' and 'object' are primary
    }));

    return NextResponse.json({
      object: "list",
      data: modelsData,
    });

  } catch (error: any) {
    logError(error, { context: 'Models endpoint - Error fetching targets' });

    // Return a generic error
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Failed to fetch available models (targets).',
          type: 'internal_server_error'
        }
      },
      { status: 500 }
    );
  }
}