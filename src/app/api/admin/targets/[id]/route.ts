import { NextRequest, NextResponse } from 'next/server';
import { VertexTarget } from '@/lib/models/VertexTarget';
import { logError, logTargetEvent } from '@/lib/services/logger'; // Assuming logKeyEvent is renamed/adapted to logTargetEvent

// DELETE /api/admin/targets/:id - Delete a Vertex Target
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Target ID is required' },
        { status: 400 }
      );
    }

    const deleted = await VertexTarget.deleteById(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Vertex Target not found' },
        { status: 404 }
      );
    }

    logTargetEvent('Target Deleted', { targetId: id });
    return NextResponse.json({
      message: 'Vertex Target deleted successfully'
    });
  } catch (error: any) {
    logError(error, { context: 'DELETE /api/admin/targets/:id' });
    return NextResponse.json(
      { error: error.message || 'Failed to delete Vertex Target' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/targets/:id - Toggle Vertex Target active status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Target ID is required' },
        { status: 400 }
      );
    }

    // Find the target
    const target = await VertexTarget.findOne({ _id: id });

    if (!target) {
      return NextResponse.json(
        { error: 'Vertex Target not found' },
        { status: 404 }
      );
    }

    // Toggle the active status
    const wasActive = target.isActive; // Store previous state
    target.isActive = !target.isActive;

    // If activating the target, reset failure count and rate limit status
    if (!wasActive && target.isActive) {
      target.failureCount = 0; // Reset failure count
      target.rateLimitResetAt = null; // Clear global rate limit cooldown
      target.isDisabledByRateLimit = false; // Ensure it's not marked as disabled by daily limit
      logTargetEvent('Target Reactivated', { targetId: target._id, reason: 'Manual activation' });
    } else if (wasActive && !target.isActive) {
      logTargetEvent('Target Deactivated', { targetId: target._id, reason: 'Manual deactivation' });
    }

    // Save the changes
    await target.save();

    return NextResponse.json({
      message: `Vertex Target ${target.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: target.isActive
    });
  } catch (error: any) {
    logError(error, { context: 'PATCH /api/admin/targets/:id' });
    return NextResponse.json(
      { error: error.message || 'Failed to update Vertex Target status' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/targets/:id - Update Vertex Target details (name, project, location, model, rate limit)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    // Expecting fields for VertexTarget, excluding serviceAccountKeyJson for standard PUT
    const { name, projectId, location, modelId, dailyRateLimit } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Target ID is required' },
        { status: 400 }
      );
    }

    // --- Validate Input Fields ---
    const errors: { [key: string]: string } = {};
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
        errors.name = 'Name must be a non-empty string.';
    }
    if (projectId !== undefined && (typeof projectId !== 'string' || projectId.trim() === '')) {
        errors.projectId = 'Project ID must be a non-empty string.';
    }
    if (location !== undefined && (typeof location !== 'string' || location.trim() === '')) {
        errors.location = 'Location must be a non-empty string.';
    }
     if (modelId !== undefined && (typeof modelId !== 'string' || modelId.trim() === '')) {
        errors.modelId = 'Model ID must be a non-empty string.';
    }

    let validatedRateLimit: number | null | undefined = undefined; // Keep track of validated value
    if (dailyRateLimit !== undefined) {
      if (dailyRateLimit === null || String(dailyRateLimit).trim() === '') {
        validatedRateLimit = null; // Allow setting to null or empty string (disable limit)
      } else {
          const numLimit = Number(dailyRateLimit);
          if (!isNaN(numLimit) && numLimit >= 0) {
              validatedRateLimit = numLimit; // Valid non-negative number
          } else {
              errors.dailyRateLimit = 'Invalid value for Daily Rate Limit. Must be a non-negative number or empty.';
          }
      }
    }

    if (Object.keys(errors).length > 0) {
        return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    // --- End Validation ---


    // Find the target
    const target = await VertexTarget.findOne({ _id: id });

    if (!target) {
      return NextResponse.json(
        { error: 'Vertex Target not found' },
        { status: 404 }
      );
    }

    // Update fields if they were provided and validated
    const updatedFields: string[] = [];
    if (name !== undefined) {
      target.name = name.trim();
      updatedFields.push('name');
    }
     if (projectId !== undefined) {
      target.projectId = projectId.trim();
      updatedFields.push('projectId');
    }
     if (location !== undefined) {
      target.location = location.trim();
      updatedFields.push('location');
    }
     if (modelId !== undefined) {
      target.modelId = modelId.trim();
      updatedFields.push('modelId');
    }
    if (validatedRateLimit !== undefined) {
      target.dailyRateLimit = validatedRateLimit;
      updatedFields.push('dailyRateLimit');
      // If the limit is removed or set to 0, ensure the target isn't disabled by the limit anymore
      if (validatedRateLimit === null || validatedRateLimit === 0) {
          target.isDisabledByRateLimit = false;
          // Optionally reset daily count here, or let the daily reset handle it
          // target.dailyRequestsUsed = 0;
      }
    }

    // Save the changes
    await target.save();

    if (updatedFields.length > 0) {
      logTargetEvent('Target Updated', { targetId: target._id, updatedFields: updatedFields });
    }

    // Prepare response object, excluding sensitive data
    const responseTarget = {
      _id: target._id,
      name: target.name,
      projectId: target.projectId,
      location: target.location,
      modelId: target.modelId,
      isActive: target.isActive,
      lastUsed: target.lastUsed,
      rateLimitResetAt: target.rateLimitResetAt,
      failureCount: target.failureCount,
      requestCount: target.requestCount,
      dailyRateLimit: target.dailyRateLimit,
      dailyRequestsUsed: target.dailyRequestsUsed,
      lastResetDate: target.lastResetDate,
      isDisabledByRateLimit: target.isDisabledByRateLimit,
    };


    return NextResponse.json({
      message: 'Vertex Target updated successfully',
      target: responseTarget
    });
  } catch (error: any) {
    logError(error, { context: 'PUT /api/admin/targets/:id' });
     // Check for specific duplicate key error if your DB driver provides it
    if (error.message?.includes('duplicate key error')) { // Example check
        return NextResponse.json(
            { error: "Updating this target would conflict with another existing target (e.g., same Project ID, Location, Model ID)." },
            { status: 409 } // Conflict
        );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update Vertex Target' },
      { status: 500 }
    );
  }
}