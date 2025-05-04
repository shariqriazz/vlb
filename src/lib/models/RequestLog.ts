import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

// Define the RequestLog interface (matches the table schema)
export interface RequestLogData {
  _id: string;
  targetId: string; // Foreign key to VertexTarget._id (renamed from apiKeyId)
  timestamp: string; // ISO 8601 format string
  modelUsed?: string | null;
  responseTime?: number | null; // Milliseconds
  statusCode: number; // HTTP status code returned to client
  isError: boolean;
  errorType?: string | null; // e.g., 'TargetError', 'UpstreamError', 'InternalError', 'VertexError'
  errorMessage?: string | null;
  ipAddress?: string | null;
  // Add new fields
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  isStreaming?: boolean | null;
  requestId?: string | null; // To correlate logs for a single incoming request
  requestedModel?: string | null; // Model requested by the client
}

// Helper to convert DB result (0/1) to boolean
function dbToBoolean(value: any): boolean {
  return value === 1;
}

// Helper to convert boolean to DB value (0/1)
function booleanToDb(value: boolean): number {
  return value ? 1 : 0;
}

export class RequestLog implements RequestLogData {
  _id: string;
  targetId: string; // Renamed from apiKeyId
  timestamp: string;
  modelUsed?: string | null;
  responseTime?: number | null;
  statusCode: number;
  isError: boolean;
  errorType?: string | null;
  errorMessage?: string | null;
  ipAddress?: string | null;
  // Add corresponding class properties
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  isStreaming?: boolean | null;
  requestId?: string | null;
  requestedModel?: string | null;

  constructor(data: RequestLogData) {
    this._id = data._id;
    this.targetId = data.targetId; // Corrected: Use targetId
    this.timestamp = data.timestamp;
    this.modelUsed = data.modelUsed;
    this.responseTime = data.responseTime;
    this.statusCode = data.statusCode;
    this.isError = data.isError;
    this.errorType = data.errorType;
    this.errorMessage = data.errorMessage;
    this.ipAddress = data.ipAddress;
    // Assign new properties
    this.promptTokens = data.promptTokens;
    this.completionTokens = data.completionTokens;
    this.totalTokens = data.totalTokens;
    this.isStreaming = data.isStreaming;
    this.requestId = data.requestId;
    this.requestedModel = data.requestedModel;
  }

  // Static method to create a new log entry
  static async create(data: Omit<RequestLogData, '_id' | 'timestamp'>): Promise<RequestLog> {
    const db = await getDb();
    const newId = uuidv4();
    const timestamp = new Date().toISOString();

    const logData: RequestLogData = {
      _id: newId,
      targetId: data.targetId, // Renamed from apiKeyId
      timestamp: timestamp,
      modelUsed: data.modelUsed === undefined ? null : data.modelUsed,
      responseTime: data.responseTime === undefined ? null : data.responseTime,
      statusCode: data.statusCode,
      isError: data.isError ?? false,
      errorType: data.errorType === undefined ? null : data.errorType,
      errorMessage: data.errorMessage === undefined ? null : data.errorMessage,
      ipAddress: data.ipAddress === undefined ? null : data.ipAddress,
      // Add new fields to logData initialization
      promptTokens: data.promptTokens === undefined ? null : data.promptTokens,
      completionTokens: data.completionTokens === undefined ? null : data.completionTokens,
      totalTokens: data.totalTokens === undefined ? null : data.totalTokens,
      isStreaming: data.isStreaming === undefined ? null : data.isStreaming,
      requestId: data.requestId === undefined ? null : data.requestId,
      requestedModel: data.requestedModel === undefined ? null : data.requestedModel,
    };

    // Update SQL query to include new columns and use targetId
    await db.run(
      `INSERT INTO request_logs (_id, targetId, timestamp, modelUsed, responseTime, statusCode, isError, errorType, errorMessage, ipAddress, promptTokens, completionTokens, totalTokens, isStreaming, requestId, requestedModel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      logData._id,
      logData.targetId, // Corrected: Use targetId
      logData.timestamp,
      logData.modelUsed,
      logData.responseTime,
      logData.statusCode,
      booleanToDb(logData.isError),
      logData.errorType,
      logData.errorMessage,
      logData.ipAddress,
      // Add new field values to db.run parameters
      logData.promptTokens,
      logData.completionTokens,
      logData.totalTokens,
      booleanToDb(logData.isStreaming ?? false), // Handle potential null for boolean
      logData.requestId,
      logData.requestedModel
    );

    // We need to fetch the created record to get default values if any were applied by DB
    // For simplicity here, we return an instance with the data we inserted.
    // A more robust implementation might fetch the record by _id.
    return new RequestLog(logData);
  }

  // Add static methods for querying (e.g., findByTimeRange) later as needed
}