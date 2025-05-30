import { NextRequest, NextResponse } from "next/server";
import { VertexTarget } from "@/lib/models/VertexTarget";
import targetManager from "@/lib/services/targetManager";
import { logError } from "@/lib/services/logger";

// GET /api/admin/targets - Get all Vertex Targets
export async function GET() {
  try {
    const targets = await VertexTarget.findAll({});

    // Select only necessary fields for the response, don't expose SA key
    const responseTargets = targets.map((targetInstance) => ({
      _id: targetInstance._id,
      name: targetInstance.name,
      projectId: targetInstance.projectId,
      location: targetInstance.location,
      // modelId: targetInstance.modelId, // Removed
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

    // Return the array wrapped in an object with a 'targets' key
    return NextResponse.json({ targets: responseTargets });
  } catch (error: any) {
    logError(error, { context: "GET /api/admin/targets" });
    return NextResponse.json(
      { error: error.message || "Failed to fetch Vertex targets" },
      { status: 500 }
    );
  }
}

// POST /api/admin/targets - Add a new Vertex Target
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = formData.get("name") as string | null;
    const projectId = formData.get("projectId") as string | null;
    const location = formData.get("location") as string | null;
    // const modelId = formData.get("modelId") as string | null; // Removed
    const dailyRateLimit = formData.get("dailyRateLimit") as string | null;
    const saKeyFile = formData.get("serviceAccountKeyJson") as File | null;

    // Removed modelId check
    if (!name || !projectId || !location || !saKeyFile) {
      return NextResponse.json(
        { error: "Missing required fields: name, projectId, location, serviceAccountKeyJson file" },
        { status: 400 }
      );
    }

    // Read the file content
    let serviceAccountKeyJson: string;
    try {
      serviceAccountKeyJson = await saKeyFile.text();
      // Basic validation: check if it's parseable JSON
      JSON.parse(serviceAccountKeyJson);
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid Service Account Key JSON file format." },
        { status: 400 }
      );
    }


    // Validate dailyRateLimit (optional, must be number >= 0 or null/undefined/empty string)
    let validatedRateLimit: number | null = null; // Default to null (no limit)
    if (dailyRateLimit !== undefined && dailyRateLimit !== null && dailyRateLimit.trim() !== '') {
        const numLimit = Number(dailyRateLimit);
        if (!isNaN(numLimit) && numLimit >= 0) {
            validatedRateLimit = numLimit;
        } else {
            // Invalid non-numeric value provided
            return NextResponse.json(
                { error: "Invalid value provided for Daily Rate Limit. Must be a non-negative number or empty." },
                { status: 400 }
            );
        }
    } // If empty string, null, or undefined, it remains null

    // Pass validated data to the targetManager method
    const newTargetData = await targetManager.addTarget({
        name,
        projectId,
        location,
        // modelId, // Removed
        serviceAccountKeyJson,
        dailyRateLimit: validatedRateLimit
    });

    // Don't return the SA key in the response
    const { serviceAccountKeyJson: _, ...responseTarget } = newTargetData;


    return NextResponse.json({
      message: "Vertex target added successfully",
      target: responseTarget,
    });
  } catch (error: any) {
    logError(error, { context: "POST /api/admin/targets" });
    // Check for specific duplicate key error if your DB driver provides it
    if (error.message?.includes('duplicate key error')) { // Example check - Note: Duplicate check might need adjustment if based on removed fields
        return NextResponse.json(
            { error: "A target with this combination of Project ID and Location might already exist." }, // Adjusted error message
            { status: 409 } // Conflict
        );
    }
    return NextResponse.json(
      { error: error.message || "Failed to add Vertex target" },
      { status: 500 }
    );
  }
}
