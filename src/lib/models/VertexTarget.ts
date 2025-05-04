import { getDb } from '../db'; // Import the database connection function
import { v4 as uuidv4 } from 'uuid'; // For generating IDs if needed

// Define the VertexTarget interface (matches the table schema)
export interface VertexTargetData {
  _id: string;
  projectId: string;
  location: string;
  // modelId: string; // Removed
  serviceAccountKeyJson: string; // Store as JSON string
  name?: string | null; // Allow null from DB
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null; // Allow null from DB
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
}

// Helper to convert DB result (0/1) to boolean
function dbToBoolean(value: any): boolean {
  return value === 1;
}

// Helper to convert boolean to DB value (0/1)
function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}


export class VertexTarget implements VertexTargetData {
  _id: string;
  projectId: string;
  location: string;
  // modelId: string; // Removed
  serviceAccountKeyJson: string;
  name?: string | null;
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;

  constructor(data: VertexTargetData) {
    this._id = data._id;
    this.projectId = data.projectId;
    this.location = data.location;
    // this.modelId = data.modelId; // Removed
    this.serviceAccountKeyJson = data.serviceAccountKeyJson;
    this.name = data.name;
    this.isActive = data.isActive; // Booleans are handled directly in the class
    this.lastUsed = data.lastUsed;
    this.rateLimitResetAt = data.rateLimitResetAt;
    this.failureCount = data.failureCount;
    this.requestCount = data.requestCount;
    this.dailyRateLimit = data.dailyRateLimit;
    this.dailyRequestsUsed = data.dailyRequestsUsed;
    this.lastResetDate = data.lastResetDate;
    this.isDisabledByRateLimit = data.isDisabledByRateLimit;
  }

  // Static method to find one target by query object
  static async findOne(query: Partial<VertexTargetData>): Promise<VertexTarget | null> {
    const db = await getDb();
    // Build WHERE clause dynamically
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    if (query._id !== undefined) {
      whereClause += ' AND _id = ?';
      params.push(query._id);
    }
    // Add checks for new fields if needed for querying (e.g., find by projectId)
    if (query.projectId !== undefined) {
        whereClause += ' AND projectId = ?';
        params.push(query.projectId);
    }
    if (query.location !== undefined) {
        whereClause += ' AND location = ?';
        params.push(query.location);
    }
    // Removed modelId query
    if (query.isActive !== undefined) {
      whereClause += ' AND isActive = ?';
      params.push(booleanToDb(query.isActive));
    }
    // Add other query fields as needed...

    // Query the correct table
    const row = await db.get<VertexTargetData>(`SELECT * FROM vertex_targets ${whereClause}`, params); // Changed table name

    if (!row) return null;

    // Convert boolean fields from DB format
    return new VertexTarget({
        ...row,
        isActive: dbToBoolean(row.isActive),
        isDisabledByRateLimit: dbToBoolean(row.isDisabledByRateLimit),
    });
  }

  // Static method to find all targets matching a query object
  static async findAll(query: Partial<VertexTargetData> = {}): Promise<VertexTarget[]> {
    const db = await getDb();
    // Build WHERE clause dynamically
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (query.isActive !== undefined) {
      whereClause += ' AND isActive = ?';
      params.push(booleanToDb(query.isActive));
    }
    if (query.isDisabledByRateLimit !== undefined) {
        whereClause += ' AND isDisabledByRateLimit = ?';
        params.push(booleanToDb(query.isDisabledByRateLimit));
    }
    // Handle the $or condition for rateLimitResetAt (if still needed, review logic)
    if ((query as any).$or && Array.isArray((query as any).$or)) {
        const orConditions = (query as any).$or as any[];
        const rateLimitConditions = orConditions
            .map((cond: any) => {
                if (cond.rateLimitResetAt === null) {
                    return 'rateLimitResetAt IS NULL';
                }
                if (cond.rateLimitResetAt?.$lte) {
                    params.push(cond.rateLimitResetAt.$lte);
                    return 'rateLimitResetAt <= ?';
                }
                return null; // Ignore invalid conditions
            })
            .filter(c => c !== null);

        if (rateLimitConditions.length > 0) {
            whereClause += ` AND (${rateLimitConditions.join(' OR ')})`;
        }
    }
    // Add other query fields as needed...

    // Query the correct table
    const rows = await db.all<VertexTargetData[]>(`SELECT * FROM vertex_targets ${whereClause}`, params); // Changed table name

    return rows.map((row: VertexTargetData) => new VertexTarget({
        ...row,
        isActive: dbToBoolean(row.isActive),
        isDisabledByRateLimit: dbToBoolean(row.isDisabledByRateLimit),
    }));
  }

  // Static method to create a new target
  static async create(data: Partial<VertexTargetData>): Promise<VertexTarget> {
    const db = await getDb();
    const newId = data._id || uuidv4(); // Generate ID if not provided

    // Validate required fields for VertexTarget
    if (!data.projectId) throw new Error("projectId cannot be empty");
    if (!data.location) throw new Error("location cannot be empty");
    // Removed modelId validation
    if (!data.serviceAccountKeyJson) throw new Error("serviceAccountKeyJson cannot be empty");

    const targetData: VertexTargetData = {
      _id: newId,
      projectId: data.projectId,
      location: data.location,
      // modelId: data.modelId, // Removed
      serviceAccountKeyJson: data.serviceAccountKeyJson,
      name: data.name,
      isActive: data.isActive ?? true,
      lastUsed: data.lastUsed || null,
      rateLimitResetAt: data.rateLimitResetAt || null,
      failureCount: data.failureCount ?? 0,
      requestCount: data.requestCount ?? 0,
      dailyRateLimit: data.dailyRateLimit === undefined ? null : data.dailyRateLimit,
      dailyRequestsUsed: data.dailyRequestsUsed ?? 0,
      lastResetDate: data.lastResetDate || null,
      isDisabledByRateLimit: data.isDisabledByRateLimit ?? false,
    };

    // Insert into the correct table
    await db.run(
      `INSERT INTO vertex_targets (_id, projectId, location, serviceAccountKeyJson, name, isActive, lastUsed, rateLimitResetAt, failureCount, requestCount, dailyRateLimit, dailyRequestsUsed, lastResetDate, isDisabledByRateLimit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, // Removed modelId
      targetData._id,
      targetData.projectId,
      targetData.location,
      // targetData.modelId, // Removed
      targetData.serviceAccountKeyJson,
      targetData.name,
      booleanToDb(targetData.isActive),
      targetData.lastUsed,
      targetData.rateLimitResetAt,
      targetData.failureCount,
      targetData.requestCount,
      targetData.dailyRateLimit,
      targetData.dailyRequestsUsed,
      targetData.lastResetDate,
      booleanToDb(targetData.isDisabledByRateLimit)
    );

    return new VertexTarget(targetData);
  }

  // Instance method to save (update) the current target
  async save(): Promise<VertexTarget> {
    const db = await getDb();
    // Update the correct table
    await db.run(
      `UPDATE vertex_targets
       SET projectId = ?, location = ?, serviceAccountKeyJson = ?, name = ?, isActive = ?, lastUsed = ?, rateLimitResetAt = ?, failureCount = ?, requestCount = ?, dailyRateLimit = ?, dailyRequestsUsed = ?, lastResetDate = ?, isDisabledByRateLimit = ?
       WHERE _id = ?`, // Removed modelId
      this.projectId,
      this.location,
      // this.modelId, // Removed
      this.serviceAccountKeyJson,
      this.name,
      booleanToDb(this.isActive),
      this.lastUsed,
      this.rateLimitResetAt,
      this.failureCount,
      this.requestCount,
      this.dailyRateLimit,
      this.dailyRequestsUsed,
      this.lastResetDate,
      booleanToDb(this.isDisabledByRateLimit),
      this._id
    );
    return this; // Return the instance
  }

  // Instance method to delete the current target
  async delete(): Promise<void> {
    const db = await getDb();
    // Delete from the correct table
    await db.run('DELETE FROM vertex_targets WHERE _id = ?', this._id); // Changed table name
  }

  // Static method to delete a target by ID
  static async deleteById(id: string): Promise<boolean> {
    const db = await getDb();
    // Delete from the correct table
    const result = await db.run('DELETE FROM vertex_targets WHERE _id = ?', id); // Changed table name
    return result.changes !== undefined && result.changes > 0; // Return true if a row was deleted
  }

  // Static method for bulk updates (more efficient with DB)
  // This implementation updates targets one by one, but within a transaction for atomicity.
  // For very large updates, more optimized bulk SQL might be needed depending on the DB.
  static async bulkUpdate(updatedTargetsMap: Map<string, VertexTarget>): Promise<void> {
    if (updatedTargetsMap.size === 0) return;

    const db = await getDb();
    try {
      await db.run('BEGIN TRANSACTION');
      for (const targetInstance of updatedTargetsMap.values()) {
        // Update the correct table
        await db.run(
          `UPDATE vertex_targets
           SET projectId = ?, location = ?, serviceAccountKeyJson = ?, name = ?, isActive = ?, lastUsed = ?, rateLimitResetAt = ?, failureCount = ?, requestCount = ?, dailyRateLimit = ?, dailyRequestsUsed = ?, lastResetDate = ?, isDisabledByRateLimit = ?
           WHERE _id = ?`, // Removed modelId
          targetInstance.projectId,
          targetInstance.location,
          // targetInstance.modelId, // Removed
          targetInstance.serviceAccountKeyJson,
          targetInstance.name,
          booleanToDb(targetInstance.isActive),
          targetInstance.lastUsed,
          targetInstance.rateLimitResetAt,
          targetInstance.failureCount,
          targetInstance.requestCount,
          targetInstance.dailyRateLimit,
          targetInstance.dailyRequestsUsed,
          targetInstance.lastResetDate,
          booleanToDb(targetInstance.isDisabledByRateLimit),
          targetInstance._id
        );
      }
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK'); // Rollback on error
      console.error("Bulk update failed:", error);
      throw error; // Re-throw the error
    }
  }
}
