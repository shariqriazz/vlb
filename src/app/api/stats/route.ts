export const dynamic = 'force-dynamic'; // Force dynamic rendering
import { NextRequest, NextResponse } from 'next/server';
import { VertexTarget } from '@/lib/models/VertexTarget'; // Changed ApiKey to VertexTarget
import { RequestLogData } from '@/lib/models/RequestLog'; // Import RequestLogData
import { getDb } from '@/lib/db'; // Import getDb
import { logError } from '@/lib/services/logger';

// Function to get date range based on timeRange parameter
function getDateRange(timeRange: string): { startDate: Date, endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();
  
  switch (timeRange) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7); // Default to 7 days
  }
  
  // For time ranges other than 24h, adjust to full days
  if (timeRange !== '24h') {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  }
  // For 24h, use the exact start/end times calculated above
  
  return { startDate, endDate };
}

// Format date for display in charts (Frontend will handle 24h formatting)
function formatDate(date: Date, timeRange: string): string {
  // Removed 24h formatting logic - handled by frontend now
  // Corrected duplicate '7d' condition
  if (timeRange === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
  } else { // Handles '30d', '90d', and any other defaults
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// Generate time periods for chart based on timeRange, ensuring UTC for 24h
function generateTimePeriods(startDate: Date, endDate: Date, timeRange: string): Date[] {
  const periods: Date[] = [];
  let current: Date;

  if (timeRange === '24h') {
    // Use UTC hours for 24h range
    // Start from the beginning of the hour for the startDate (in UTC)
    current = new Date(startDate.toISOString());
    current.setUTCMinutes(0, 0, 0);
    const finalEndDateUTC = new Date(endDate.toISOString());

    // Ensure the loop doesn't run excessively if dates are weird
    let safetyCounter = 0;
    while (current <= finalEndDateUTC && safetyCounter < 48) { // Added safety break
      periods.push(new Date(current)); // Store Date object representing UTC hour start
      current.setUTCHours(current.getUTCHours() + 1); // Increment UTC hour
      safetyCounter++;
    }
     if (safetyCounter >= 48) {
        console.warn("generateTimePeriods 24h loop exceeded safety limit");
     }
  } else {
    // Use local date for daily ranges
    current = new Date(startDate);
    current.setHours(0, 0, 0, 0); // Align to start of day
    const finalEndDate = new Date(endDate);
    finalEndDate.setHours(23, 59, 59, 999); // Ensure end date is inclusive

    // Ensure the loop doesn't run excessively
    let safetyCounter = 0;
    while (current <= finalEndDate && safetyCounter < 180) { // Added safety break (e.g., 90 days + buffer)
      periods.push(new Date(current));
      current.setDate(current.getDate() + 1);
      safetyCounter++;
    }
     if (safetyCounter >= 180) {
        console.warn("generateTimePeriods daily loop exceeded safety limit");
     }
  }

  return periods;
}

// Function to analyze log files and generate statistics
async function generateStats(timeRange: string) {
  // Dates for the main requestData chart based on selected timeRange
  const { startDate: requestStartDate, endDate: requestEndDate } = getDateRange(timeRange);
  const requestStartDateISO = requestStartDate.toISOString();
  const requestEndDateISO = requestEndDate.toISOString();

  // Always calculate dates for the rolling 24-hour hourly chart, explicitly using UTC
  const hourlyEndDateUTC = new Date(); // Current time is the end point
  const hourlyStartDateUTC = new Date(hourlyEndDateUTC.getTime() - 24 * 60 * 60 * 1000); // Exactly 24 hours prior
  const hourlyStartDateISO = hourlyStartDateUTC.toISOString();
  const hourlyEndDateISO = hourlyEndDateUTC.toISOString();

  try { // Re-add the try block
    const db = await getDb();
    // Get all targets from the database first (needed for lifetime total and target usage pie chart)
    const targets = await VertexTarget.findAll({}); // Changed keys to targets, ApiKey to VertexTarget

    // Initialize statistics
    // Calculate totals directly from DB data
    let totalRequests = targets.reduce((sum, target) => sum + (target.requestCount || 0), 0); // Changed keys to targets
    let totalRequestsToday = targets.reduce((sum, target) => sum + (target.dailyRequestsUsed || 0), 0); // Changed keys to targets

    // Initialize stats derived from DB queries
    let totalRequests24h = 0;
    let totalErrors = 0;
    let targetErrors = 0; // Renamed apiKeyErrors to targetErrors
    let avgResponseTime = 0;
    
    // Generate time periods for charts
    const timePeriods = generateTimePeriods(requestStartDate, requestEndDate, timeRange); // Use request dates for requestData chart periods
    
    // Initialize request data with all time periods
    // --- Database Queries for Stats ---

    // 1. Total Requests (Last 24h)
    const requests24hResult = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM request_logs WHERE isError = 0 AND timestamp >= ? AND timestamp <= ?`,
      hourlyStartDateISO, hourlyEndDateISO
    );
    totalRequests24h = requests24hResult?.count || 0;

    // 2. Total Errors & Target Errors (within selected timeRange) // Updated comment
    const errorsResult = await db.get<{ total: number, target: number }>( // Updated type definition
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN errorType = 'TargetError' THEN 1 ELSE 0 END) as target // Changed ApiKeyError to TargetError, api to target
       FROM request_logs
       WHERE isError = 1 AND timestamp >= ? AND timestamp <= ?`,
      requestStartDateISO, requestEndDateISO
    );
    totalErrors = errorsResult?.total || 0;
    targetErrors = errorsResult?.target || 0; // Renamed apiKeyErrors, use target alias

    // 3. Average Response Time (within selected timeRange)
    const avgTimeResult = await db.get<{ avg: number }>(
      `SELECT AVG(responseTime) as avg
       FROM request_logs
       WHERE isError = 0 AND responseTime IS NOT NULL AND timestamp >= ? AND timestamp <= ?`,
      requestStartDateISO, requestEndDateISO
    );
    avgResponseTime = avgTimeResult?.avg ? Math.round(avgTimeResult.avg) : 0;

    // 4. Request Data (Grouped by period for chart)
    let groupByFormat = '';
    if (timeRange === '24h') {
      // Simplify format for debugging SQLite error
      // Further simplify for debugging: Remove strftime from GROUP BY
      groupByFormat = `strftime('%Y-%m-%d %H', timestamp)`; // Keep SELECT alias
    } else {
      groupByFormat = `strftime('%Y-%m-%d', timestamp)`; // Keep SELECT alias
    }
    const requestDataDbResult = await db.all<any[]>(
      `SELECT
         ${groupByFormat} as period,
         COUNT(*) as total_requests,
         SUM(CASE WHEN isError = 1 THEN 1 ELSE 0 END) as errors,
         SUM(CASE WHEN isError = 1 AND errorType = 'TargetError' THEN 1 ELSE 0 END) as targetErrors // Changed ApiKeyError to TargetError, apiKeyErrors to targetErrors
       FROM request_logs
       WHERE timestamp >= ? AND timestamp <= ?
       GROUP BY timestamp -- DEBUG: Group by raw timestamp to isolate strftime error
       -- ORDER BY period ASC -- Temporarily removed for debugging`,
      requestStartDateISO, requestEndDateISO
    );

    // Map DB results to the expected chart format, filling gaps
    // Use UTC ISO string keys for 24h, local 'YYYY-MM-DD' keys for daily
    const requestDataMap = new Map<string, { timestamp: string, name: string, requests: number, errors: number, targetErrors: number, date: Date }>(); // Renamed apiKeyErrors

    // Initialize map with generated periods.
    timePeriods.forEach(date => {
      let key: string;
      let name: string = '';
      let timestamp: string = '';

      if (isNaN(date.getTime())) {
        console.warn(`Invalid date generated in timePeriods: ${date}`);
        return; // Skip invalid dates
      }

      if (timeRange === '24h') {
        // Key is UTC ISO string for 24h
        key = date.toISOString();
        timestamp = key; // Store the ISO string for the frontend
      } else {
        // Key is local 'YYYY-MM-DD' for daily ranges
        // Format date parts manually to ensure local YYYY-MM-DD
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
        const day = date.getDate().toString().padStart(2, '0');
        key = `${year}-${month}-${day}`;
        name = formatDate(date, timeRange); // Format name for display
      }
      requestDataMap.set(key, { timestamp, name, requests: 0, errors: 0, targetErrors: 0, date }); // Renamed apiKeyErrors
    });

    requestDataDbResult.forEach(row => {
      // `row.period` is the UTC period string from the DB ('YYYY-MM-DD HH:00:00' or 'YYYY-MM-DD')
      let keyToUpdate: string | null = null;

      try {
        if (timeRange === '24h') {
          // For 24h, match using UTC ISO string keys
          const periodDateUTC = new Date(row.period.replace(' ', 'T') + 'Z'); // Parse DB period as UTC
          if (!isNaN(periodDateUTC.getTime())) {
            const isoKey = periodDateUTC.toISOString(); // Convert to ISO string to match map key
            if (requestDataMap.has(isoKey)) {
              keyToUpdate = isoKey;
            }
            // else { console.warn(`24h: Map key ${isoKey} not found for DB period ${row.period}`); }
          } else {
            console.warn(`24h: Could not parse DB period ${row.period} as valid date.`);
          }
        } else {
          // For daily, match using local 'YYYY-MM-DD' keys
          // The DB `row.period` is already in 'YYYY-MM-DD' format (from strftime)
          const dateKey = row.period;
          if (requestDataMap.has(dateKey)) {
            keyToUpdate = dateKey;
          }
          // else { console.warn(`Daily: Map key ${dateKey} not found for DB period ${row.period}`); }
        }
      } catch (e) {
        console.error(`Error processing DB period ${row.period}:`, e);
        return; // Skip this row on error
      }


      if (keyToUpdate) {
        const entry = requestDataMap.get(keyToUpdate);
        // Ensure entry exists before trying to update it
        if (entry) {
            // Ensure row values are numbers
            const totalRequests = Number(row.total_requests) || 0;
            const errors = Number(row.errors) || 0;
            const targetErrors = Number(row.targetErrors) || 0; // Renamed apiKeyErrors

            entry.requests = totalRequests - errors; // Store successful requests
            entry.errors = errors;
            entry.targetErrors = targetErrors; // Renamed apiKeyErrors
        } else {
             // This case should ideally not happen if keyToUpdate is derived from map keys
             console.warn(`Entry not found for key ${keyToUpdate} derived from period ${row.period}`);
        }
      } else {
         // Log if a DB result didn't match any generated period key (can be noisy, uncomment if needed)
         // console.warn(`DB result period "${row.period}" did not match any key in the generated time periods map.`);
      }
    });

    // Prepare final array, sending timestamp for 24h and name for others
    const requestData = Array.from(requestDataMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime()) // Sort by original Date object
      .map(({ timestamp, name, requests, errors, targetErrors }) => // Renamed apiKeyErrors
        timeRange === '24h'
          ? { timestamp, requests, errors, targetErrors } // Send timestamp for 24h, Renamed apiKeyErrors
          : { name, requests, errors, targetErrors } // Send name for other ranges, Renamed apiKeyErrors
      );


    // 5. Hourly Data (Last 24h UTC)
    const hourlyDbResult = await db.all<{ hour: string, requests: number }[]>(
      `SELECT
         strftime('%Y-%m-%d %H', timestamp) as hour, -- Simplified format for debugging
         COUNT(*) as requests
       FROM request_logs
       WHERE isError = 0 AND timestamp >= ? AND timestamp <= ?
       GROUP BY timestamp -- DEBUG: Group by raw timestamp to isolate strftime error
       -- ORDER BY hour ASC -- Temporarily removed for debugging`,
      hourlyStartDateISO, hourlyEndDateISO
    );

    // Map DB results to the expected chart format, filling gaps
    const hourlyMap = new Map<string, { hour: string, requests: number, timestamp: Date }>();
    let currentUTCHourMarker = new Date(hourlyStartDateUTC);
    currentUTCHourMarker.setUTCMinutes(0, 0, 0);
    for (let i = 0; i < 24; i++) {
      if (currentUTCHourMarker > hourlyEndDateUTC) break;
      const hourUTCSlotStart = new Date(currentUTCHourMarker);
      const hourKey = hourUTCSlotStart.toISOString();
      hourlyMap.set(hourKey, { hour: hourKey, requests: 0, timestamp: hourUTCSlotStart });
      currentUTCHourMarker.setUTCHours(currentUTCHourMarker.getUTCHours() + 1);
    }
    hourlyDbResult.forEach(row => {
      if (hourlyMap.has(row.hour)) {
        hourlyMap.get(row.hour)!.requests = row.requests;
      }
    });
    const finalHourlyData = Array.from(hourlyMap.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(({ hour, requests }) => ({ hour, requests }));


    // 6. Model Usage (within selected timeRange)
    const modelUsageDbResult = await db.all<{ modelUsed: string, count: number }[]>(
      `SELECT modelUsed, COUNT(*) as count
       FROM request_logs
       WHERE modelUsed IS NOT NULL AND timestamp >= ? AND timestamp <= ?
       GROUP BY modelUsed
       ORDER BY count DESC`,
      requestStartDateISO, requestEndDateISO
    );
    const modelUsageData = modelUsageDbResult.map(row => ({ name: row.modelUsed, value: row.count }));

    // --- End Database Queries ---

    // Note: totalRequests and totalRequestsToday are now calculated from DB data above

    // Note: requestData and finalHourlyData are now populated directly from DB queries above

    // Prepare target usage data for chart directly from DB target request counts
    const targetUsageData = targets // Changed keys to targets, keyUsageData to targetUsageData
        .filter(target => (target.requestCount || 0) > 0) // Only include targets with usage
        .map(target => {
            // Use target name directly, no masking needed like API keys
            return {
                name: target.name || `Target ${target._id.substring(0, 4)}...`, // Use target name or fallback
                value: target.requestCount || 0 // Use total request count from DB
            };
        })
        .sort((a, b) => b.value - a.value); // Sort by usage descending
    
    // Fallback logic removed - primary loop should now work correctly
    // if (keyUsageData.length === 0) {
    //   keyUsageData = keys.map(key => ({
    //     name: `Key ${key._id.substring(0, 4)}...`,
    //     value: key.requestCount || 0
    //   })).filter(item => item.value > 0);
    // }
    
    // Note: modelUsageData is now populated directly from DB query above
    
    // Calculate success rate based on DB query results for the timeRange
    // Use total requests within the timeRange for calculation. Let's query that.
    const totalRequestsTimeRangeResult = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM request_logs WHERE timestamp >= ? AND timestamp <= ?`,
        requestStartDateISO, requestEndDateISO
    );
    const totalRequestsTimeRange = totalRequestsTimeRangeResult?.count || 0;
    const successRate = totalRequestsTimeRange > 0
      ? ((totalRequestsTimeRange - totalErrors) / totalRequestsTimeRange) * 100
      : 100;
    // Note: avgResponseTime is already calculated from DB query above
    
    // Note: finalHourlyData is now populated directly from DB query above

    return {
      totalRequests, // Lifetime total from VertexTarget table
      totalRequestsToday, // Since midnight from VertexTarget table
      totalRequests24h, // Last 24h total from request_logs table
      totalErrors, // Total errors in timeRange from request_logs
      targetErrors, // Target errors in timeRange from request_logs (Renamed)
      successRate, // Calculated from request_logs data for timeRange
      avgResponseTime, // Calculated from request_logs data for timeRange
      requestData, // Calculated from request_logs data for timeRange
      hourlyData: finalHourlyData, // Calculated from request_logs data for last 24h UTC
      targetUsageData, // From VertexTarget table (Renamed)
      modelUsageData // Calculated from request_logs data for timeRange
    };
  // } catch (error: any) { // Remove the duplicate catch block start
  //   console.error('Error generating stats:', error);
  //   // DB errors are caught below
  } catch (error: any) {
    logError(error, { context: 'generateStats DB Query' });
    console.error('Error generating stats from DB:', error);
    // Return empty stats on DB error
    return createEmptyStats(requestStartDate, requestEndDate, timeRange);
  }
}

// Create empty stats object with proper time periods
function createEmptyStats(startDate: Date, endDate: Date, timeRange: string) {
  // Generate empty requestData structure based on time periods
  const timePeriods = generateTimePeriods(startDate, endDate, timeRange);
  const requestData = timePeriods.map(date => ({
    name: formatDate(date, timeRange),
    requests: 0,
    errors: 0,
    targetErrors: 0 // Renamed apiKeyErrors
  }));

  // Always generate empty hourly data for the rolling 24h window
  const emptyHourlyData: { hour: string, requests: number }[] = [];
  const hourlyEndDate = new Date(); // Use current time as end
  const hourlyStartDate = new Date();
  hourlyStartDate.setHours(hourlyStartDate.getHours() - 24);
  let currentHour = new Date(hourlyStartDate);
  currentHour.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const hourTimestamp = new Date(currentHour);
    const hourKey = hourTimestamp.toISOString();
    emptyHourlyData.push({ hour: hourKey, requests: 0 });
    currentHour.setHours(currentHour.getHours() + 1);
  }
  
  return {
    totalRequests: 0,       // Lifetime (would ideally come from ApiKey query even on error, but default 0)
    totalRequestsToday: 0,  // Since midnight (same as above)
    totalRequests24h: 0,    // Last 24h
    totalErrors: 0,
    targetErrors: 0, // Renamed apiKeyErrors
    successRate: 100,
    avgResponseTime: 0,
    requestData,            // Empty structure based on time range
    hourlyData: emptyHourlyData, // Empty structure for 24h
    targetUsageData: [],       // Empty array (Renamed)
    modelUsageData: []      // Empty array
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d';
    
    const stats = await generateStats(timeRange);
    
    return NextResponse.json(stats);
  } catch (error: any) {
    logError(error, { context: 'Stats API' });
    
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Failed to generate statistics',
          type: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}