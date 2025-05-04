export const dynamic = 'force-dynamic'; // Force dynamic rendering
import { NextRequest, NextResponse } from 'next/server';
// Removed axios, keyManager, readSettings imports
// Removed VertexTarget import
import { logError } from '@/lib/services/logger';

/**
 * Returns a static list of usable models, formatted like the OpenAI /v1/models response.
 * In this refactored version, the client specifies the model.
 */
export async function GET(req: NextRequest) {
  try {
    // Define the list of models this load balancer supports
    // For now, just the one specified by the user. This could be made dynamic later.
    const supportedModels = [
      {
        id: "gemini-2.5-pro-exp-03-25", // The specific model ID
        object: "model",
        owned_by: "google", // Or appropriate owner
        // Add other relevant fields if known (e.g., context window)
      },
      // Add other models here if the load balancer intends to support them
    ];

    // Check if there are any active targets at all, otherwise models aren't really available
    // This check can be refined later if needed
    // const activeTargets = await VertexTarget.findAll({ isActive: true });
    // if (!activeTargets || activeTargets.length === 0) {
    //   logError(new Error('No active Vertex AI targets found'), { context: 'Models endpoint - Check active targets' });
    //   return NextResponse.json(
    //     { error: { message: 'No active Vertex AI targets configured or available to serve models.', type: 'no_targets_available' } },
    //     { status: 503 } // Service Unavailable
    //   );
    // }

    return NextResponse.json({
      object: "list",
      data: supportedModels,
    });

  } catch (error: any) {
    logError(error, { context: 'Models endpoint - Error generating model list' });

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