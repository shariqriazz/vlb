import { VertexTarget } from '../models/VertexTarget';
import { logTargetEvent, logError } from './logger'; // Renamed import
import { readSettings } from '@/lib/settings';
import { Mutex } from 'async-mutex'; // Import Mutex

// Helper function to check if two date objects represent the same day in the server's local timezone
function isSameLocalDay(date1: Date | null, date2: Date | null): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
class TargetManager {
  private currentTarget: VertexTarget | null = null;
  private requestCounter: number = 0;
  private mutex = new Mutex(); // Create a mutex instance

  constructor() {
    // Constructor no longer needs to set rotationRequestCount
  }

  async initialize() {
    // Call getTarget() which will handle initial rotation if needed
    if (!this.currentTarget) {
      await this.getTarget();
    }
  }

  // Internal rotateTarget logic, now wrapped by getTarget's mutex
  private async _internalRotateTarget(): Promise<VertexTarget> {
    // Note: This method assumes it's already being called within a mutex lock
    try {
      // Get a working key that's not in cooldown
      const now = new Date();
      const todayLocalString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format for local date

      // --- FIRST: Check ALL active targets for daily resets, even rate-limited ones ---
      const allActiveTargets = await VertexTarget.findAll({
        isActive: true // Only filter for generally active targets
      });

      // --- Daily Reset Logic ---
      let targetsWereReset = false; // Flag to track if any target was updated
      const updatedTargetsMap = new Map<string, VertexTarget>(); // Store updated targets by ID

      for (const target of allActiveTargets) {
        const lastReset = target.lastResetDate ? new Date(target.lastResetDate) : null;
        let needsUpdate = false;

        // Check if last reset was before today (local time)
        if (!lastReset || !isSameLocalDay(lastReset, now)) {
           if (target.dailyRequestsUsed > 0 || target.isDisabledByRateLimit) { // Only reset if needed
              target.dailyRequestsUsed = 0;
              target.isDisabledByRateLimit = false; // Re-enable if it was disabled by rate limit
              target.lastResetDate = now.toISOString();
              needsUpdate = true;
              logTargetEvent('Target Daily Limit Reset', { targetId: target._id, date: todayLocalString }); // Use logTargetEvent
           } else if (!target.lastResetDate) {
             // Set initial reset date if it's null
             target.lastResetDate = now.toISOString();
             needsUpdate = true;
           }
        }

        if (needsUpdate) {
            targetsWereReset = true;
            updatedTargetsMap.set(target._id, target); // Store the updated target instance
        }
      }

      // If any targets were reset, perform a single bulk write
      if (targetsWereReset) {
          await VertexTarget.bulkUpdate(updatedTargetsMap);
      }
      // --- End Daily Reset Logic ---

      // --- NOW: Get available targets for use (after potential resets) ---
      let availableTargets = await VertexTarget.findAll({
        isActive: true, // Must be generally active
        isDisabledByRateLimit: false, // Must not be disabled by daily limit
        $or: [ // Must not be in global rate limit cooldown
          { rateLimitResetAt: null },
          { rateLimitResetAt: { $lte: now.toISOString() } }
        ]
      } as any); // <-- Type assertion added here

      if (availableTargets.length === 0) {
        const error = new Error('No available Vertex Targets (all active targets might be rate-limited or disabled)');
        logError(error, { context: 'Target rotation - post daily reset' });
        throw error;
      }

      // --- Hybrid LRU + New Target Priority Logic ---
      // 1. Prioritize unused targets
      let target = availableTargets.find(t => t.lastUsed === null);

      // 2. If no unused targets, fall back to LRU
      if (!target) {
        const sortedTargets = availableTargets.sort((a, b) => {
          // Should not happen based on find above, but defensive check
          if (!a.lastUsed) return -1;
          if (!b.lastUsed) return 1;
          return new Date(a.lastUsed).getTime() - new Date(b.lastUsed).getTime();
        });
        target = sortedTargets[0]; // Select the least recently used
      }
      // --- End of Hybrid Logic ---

      if (!target) {
        // This should theoretically not be reached if availableTargets.length > 0 check passed
        const error = new Error('Failed to select a target after filtering and sorting');
        logError(error, { context: 'Target rotation - selection phase' });
        throw error;
      }

      this.currentTarget = target;
      this.requestCounter = 0; // Reset counter on target rotation

      // Log target rotation
      logTargetEvent('Target Rotation', { // Use logTargetEvent
        targetId: target._id,
        projectId: target.projectId, // Log relevant target info
        location: target.location,
        modelId: target.modelId,
        lastUsed: target.lastUsed,
        failureCount: target.failureCount,
        rotationType: 'scheduled'
      });

      return target; // Return the full target object
    } catch (error: any) {
      logError(error, { action: 'rotateTarget' });
      throw error;
    }
  }

  async markTargetSuccess() {
    if (this.currentTarget) {
      try {
        const now = new Date().toISOString();
        this.currentTarget.lastUsed = now;
        this.currentTarget.requestCount += 1; // Increment total request count
        this.currentTarget.dailyRequestsUsed += 1; // Increment daily request count
        await this.currentTarget.save();

        logTargetEvent('Target Success', { // Use logTargetEvent
          targetId: this.currentTarget._id,
          projectId: this.currentTarget.projectId, // Log relevant target info
          location: this.currentTarget.location,
          modelId: this.currentTarget.modelId,
          lastUsed: this.currentTarget.lastUsed,
          requestCount: this.currentTarget.requestCount,
          dailyRequestsUsed: this.currentTarget.dailyRequestsUsed,
          dailyRateLimit: this.currentTarget.dailyRateLimit
        });
      } catch (error: any) {
        logError(error, { action: 'markTargetSuccess' });
      }
    }
  }

  async markTargetError(error: any): Promise<boolean> {
    // Acquire lock before potentially modifying currentTarget
    return await this.mutex.runExclusive(async () => {
      if (!this.currentTarget) return false;

      const targetToUpdate = this.currentTarget; // Work with a stable reference inside the lock

      try {
      // Check if it's a rate limit error
      if (error.response?.status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        // Fetch settings to get the configured cooldown
        const settings = await readSettings();
        const fallbackCooldownMs = settings.rateLimitCooldown * 1000; // Convert seconds to ms

        targetToUpdate.rateLimitResetAt = resetTime
          ? new Date(resetTime * 1000).toISOString() // Use API provided reset time if available
          : new Date(Date.now() + fallbackCooldownMs).toISOString(); // Use configured fallback

        logTargetEvent('Target Rate Limit Hit', { // Use logTargetEvent
          targetId: targetToUpdate._id,
          projectId: targetToUpdate.projectId, // Log relevant target info
          location: targetToUpdate.location,
          modelId: targetToUpdate.modelId,
          resetTime: targetToUpdate.rateLimitResetAt
        });

        await targetToUpdate.save();
        // Clear current target ONLY if it's still the one we were working on
        if (this.currentTarget?._id === targetToUpdate._id) {
            this.currentTarget = null;
        }
        return true; // Indicate it was a rate limit error
      }

      targetToUpdate.failureCount += 1;

      // Fetch current settings to get the threshold
      const settings = await readSettings();
      const maxFailures = settings.maxFailureCount;

      // If too many failures, disable the target
      if (targetToUpdate.failureCount >= maxFailures) {
        targetToUpdate.isActive = false;

        logTargetEvent('Target Disabled', { // Use logTargetEvent
          targetId: targetToUpdate._id, // Corrected variable name
          projectId: targetToUpdate.projectId, // Log relevant target info
          location: targetToUpdate.location,
          modelId: targetToUpdate.modelId,
          reason: `Failure count reached threshold (${maxFailures})`,
          failureCount: targetToUpdate.failureCount
        });

        await targetToUpdate.save();
        // Clear current target ONLY if it's still the one we were working on
        if (this.currentTarget?._id === targetToUpdate._id) {
            this.currentTarget = null;
        }
      } else {
        // If not disabled, save the incremented failure count
        await targetToUpdate.save();
      }

      return false; // Indicate it was not a rate limit error
      } catch (error: any) {
        logError(error, {
          action: 'markTargetError',
          targetId: targetToUpdate._id // Use the stable reference
        });
        // Ensure we still return false within the catch block
        return false;
      }
      // Return false if it wasn't a rate limit error and didn't throw
      return false;
    }); // End mutex runExclusive
  }

  async getTarget(): Promise<VertexTarget> {
    // Wrap the entire target getting/rotation logic in a mutex
    return await this.mutex.runExclusive(async () => {
      try {
      const now = new Date();
      const todayLocalString = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format for local date

      // --- Check 1: Is there a current target? ---
      if (this.currentTarget) {
        // --- Check 2: Does the current target need daily reset? ---
        const lastReset = this.currentTarget.lastResetDate ? new Date(this.currentTarget.lastResetDate) : null;
        if (!lastReset || !isSameLocalDay(lastReset, now)) {
          logTargetEvent('Target Daily Limit Reset (getTarget)', { targetId: this.currentTarget._id, date: todayLocalString }); // Use logTargetEvent
          this.currentTarget.dailyRequestsUsed = 0;
          this.currentTarget.isDisabledByRateLimit = false; // Ensure re-enabled
          this.currentTarget.lastResetDate = now.toISOString();
          await this.currentTarget.save(); // Save the reset state
        }

        // --- Check 3: Is the current target globally rate-limited? ---
        const globalResetTime = this.currentTarget.rateLimitResetAt ? new Date(this.currentTarget.rateLimitResetAt) : null;
        if (globalResetTime && globalResetTime > now) {
          // Globally rate-limited, force rotation
          logTargetEvent('Target Global Rate Limit Active (getTarget)', { targetId: this.currentTarget._id, resetTime: this.currentTarget.rateLimitResetAt }); // Use logTargetEvent
          this.currentTarget = null; // Clear the invalid target
          // Fall through to rotateTarget below
        } else {
           // --- Check 4: Is the current target daily rate-limited? ---
           const limit = this.currentTarget.dailyRateLimit;
           // Ensure limit is a positive number before checking usage
           if (typeof limit === 'number' && limit > 0 && this.currentTarget.dailyRequestsUsed >= limit) {
             // Daily limit reached, disable and force rotation
             logTargetEvent('Target Daily Rate Limit Hit (getTarget)', { // Use logTargetEvent
               targetId: this.currentTarget._id,
               dailyRequestsUsed: this.currentTarget.dailyRequestsUsed,
               dailyRateLimit: limit
             });
             this.currentTarget.isDisabledByRateLimit = true;
             await this.currentTarget.save();
             this.currentTarget = null; // Clear the invalid target
             // Fall through to rotateTarget below
           } else {
              // --- Check 5: Is rotation by request count needed? ---
              // Fetch current settings dynamically
              const settings = await readSettings();
              const rotationThreshold = settings.targetRotationRequestCount; // Use the correct setting name

              if (rotationThreshold > 0 && this.requestCounter >= rotationThreshold) {
                logTargetEvent('Target Request Count Rotation Triggered (getTarget)', { // Use logTargetEvent
                  targetId: this.currentTarget._id,
                  requestCounter: this.requestCounter,
                  rotationThreshold: rotationThreshold
                });
                // Fall through to rotateTarget below
              } else {
                 // --- Target is valid! ---
                 this.requestCounter++; // Increment request counter for rotation logic
                 return this.currentTarget; // Return the full target object
              }
           }
        }
      }

      // --- Rotation Needed ---
      // Either no current key, or one of the checks above failed/triggered rotation
      // Otherwise rotate to a new key
      // Call the internal rotation logic which assumes lock is held
      return await this._internalRotateTarget();
      } catch (error: any) {
        logError(error, { action: 'getTarget' });
        throw error;
      }
    }); // End mutex runExclusive
  }

  async addTarget(data: {
    projectId: string;
    location: string;
    modelId: string;
    serviceAccountKeyJson: string;
    name?: string;
    dailyRateLimit?: number | null;
  }): Promise<VertexTarget> {
    // Although less critical, lock addTarget to prevent potential race conditions
    // if a rotation happens while adding/reactivating a target.
    return await this.mutex.runExclusive(async () => {
      const { projectId, location, modelId, serviceAccountKeyJson, name, dailyRateLimit } = data;
      try {
      // Find existing target by unique combination (adjust as needed)
      const existingTarget = await VertexTarget.findOne({ projectId, location, modelId });

      if (existingTarget) {
        // Update existing target (e.g., reactivate, update name/limit/key)
        existingTarget.isActive = true;
        existingTarget.failureCount = 0; // Reset failure count
        existingTarget.rateLimitResetAt = null; // Clear global rate limit
        existingTarget.dailyRequestsUsed = 0; // Reset daily usage
        existingTarget.lastResetDate = null; // Clear last reset date
        existingTarget.isDisabledByRateLimit = false; // Ensure not disabled by daily limit
        existingTarget.serviceAccountKeyJson = serviceAccountKeyJson; // Update key JSON
        if (name !== undefined) existingTarget.name = name; // Update name if provided
        if (dailyRateLimit !== undefined) existingTarget.dailyRateLimit = dailyRateLimit; // Update limit if provided
        await existingTarget.save();

        logTargetEvent('Target Reactivated/Updated', { // Use logTargetEvent
          targetId: existingTarget._id,
          projectId: existingTarget.projectId,
          location: existingTarget.location,
          modelId: existingTarget.modelId,
        });

        return existingTarget;
      }

      // Create new target
      const newTarget = await VertexTarget.create({
        projectId,
        location,
        modelId,
        serviceAccountKeyJson,
        name,
        dailyRateLimit
      });

      logTargetEvent('New Target Added', { // Use logTargetEvent
        targetId: newTarget._id,
        projectId: newTarget.projectId,
        location: newTarget.location,
        modelId: newTarget.modelId,
      });

      return newTarget;
      } catch (error: any) {
        logError(error, { action: 'addTarget' });
        throw error;
      }
    }); // End mutex runExclusive
  }
}

// Export a singleton instance
const targetManager = new TargetManager();
export default targetManager;