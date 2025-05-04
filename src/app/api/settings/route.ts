import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/services/logger';
import { Settings, readSettings, writeSettings, clearSettingsCache } from '@/lib/settings';

// GET /api/settings - Get application settings
export async function GET() {
  try {
    const settings = await readSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    logError(error, { context: 'GET /api/settings' });
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings - Update application settings
// Removed unused validateString helper function

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const currentSettings = await readSettings();

    console.log('Received settings update:', body); // Add logging to debug

    // Validate and update settings
    const newSettings: Settings = {
      targetRotationRequestCount: validateNumber(
        // Handle both old and new field names for backward compatibility
        body.targetRotationRequestCount ?? body.keyRotationRequestCount,
        currentSettings.targetRotationRequestCount,
        1,
        100
      ),
      maxFailureCount: validateNumber(body.maxFailureCount, currentSettings.maxFailureCount, 1, 1000), // Increased max limit from 20 to 1000
      rateLimitCooldown: validateNumber(body.rateLimitCooldown, currentSettings.rateLimitCooldown, 10, 3600),
      logRetentionDays: validateNumber(body.logRetentionDays, currentSettings.logRetentionDays, 1, 90),
      maxRetries: validateNumber(body.maxRetries ?? currentSettings.maxRetries, currentSettings.maxRetries, 0, 10),
      failoverDelaySeconds: validateNumber(body.failoverDelaySeconds ?? currentSettings.failoverDelaySeconds, currentSettings.failoverDelaySeconds, 0, 60),
    };

    console.log('Saving settings:', newSettings); // Add logging to debug

    await writeSettings(newSettings);

    // Explicitly clear the cache to ensure fresh settings are used
    clearSettingsCache();

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: newSettings
    });
  } catch (error: any) {
    logError(error, { context: 'POST /api/settings' });
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// Helper function to validate number settings
function validateNumber(value: any, defaultValue: number, min: number, max: number): number {
  const num = Number(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}