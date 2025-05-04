export const dynamic = 'force-dynamic'; // Force dynamic rendering
import { NextRequest, NextResponse } from 'next/server';
import { VertexTarget } from '@/lib/models/VertexTarget';
import { getDb } from '@/lib/db';
import { logError } from '@/lib/services/logger';

// Helper function to format date for SQL queries
function formatDateForSql(date: Date): string {
  return date.toISOString();
}

// Generate time periods for the chart
function generateTimePeriods(startDate: Date, endDate: Date, timeRange: string): Date[] {
  const periods: Date[] = [];
  // Start at the beginning of the UTC day/hour
  let current = new Date(startDate);
  if (timeRange !== '24h') {
      current.setUTCHours(0, 0, 0, 0);
  } else {
      current.setUTCMinutes(0, 0, 0); // Start at the beginning of the hour
  }

  // Ensure endDate is considered correctly
  const finalEndDate = new Date(endDate);

  // Determine the increment based on time range
  let increment: 'hour' | 'day';
  if (timeRange === '24h') {
    increment = 'hour';
  } else {
    increment = 'day';
  }

  while (current <= finalEndDate) {
    periods.push(new Date(current)); // Add the start of the period

    if (increment === 'hour') {
      current.setUTCHours(current.getUTCHours() + 1); // Increment UTC hour
    } else {
      current.setUTCDate(current.getUTCDate() + 1); // Increment UTC date
      // Ensure time stays at 00:00:00Z after incrementing day
      current.setUTCHours(0, 0, 0, 0);
    }
  }
  
  return periods;
}

// Format date for display
function formatDate(date: Date, timeRange: string): string {
  if (timeRange === '24h') {
    return date.toISOString().substring(11, 13) + ':00'; // HH:00 format
  } else {
    return date.toISOString().substring(0, 10); // YYYY-MM-DD format
  }
}

// Generate stats based on time range
async function generateStats(timeRange: string) {
  // Calculate date range based on timeRange
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
  
  // Format dates for SQL queries
  const requestStartDateISO = formatDateForSql(startDate);
  const requestEndDateISO = formatDateForSql(endDate);
  
  try {
    const db = await getDb();
    
    // Get all targets from the database
    const targets = await VertexTarget.findAll({});
    
    // Calculate totals from targets
    const totalRequests = targets.reduce((sum, target) => sum + (target.requestCount || 0), 0);
    const totalRequestsToday = targets.reduce((sum, target) => sum + (target.dailyRequestsUsed || 0), 0);
    const activeTargets = targets.filter(target => target.isActive).length;
    
    // Get request logs for the time period
    const requestLogs = await db.all(
      `SELECT * FROM request_logs 
       WHERE timestamp >= ? AND timestamp <= ?`,
      requestStartDateISO, requestEndDateISO
    );
    
    // Calculate success rate and error counts
    const totalLogsInPeriod = requestLogs.length;
    const errorLogs = requestLogs.filter(log => log.isError === 1);
    const totalErrors = errorLogs.length;
    const targetErrors = errorLogs.filter(log => log.errorType === 'TargetError').length;
    const successRate = totalLogsInPeriod > 0 
      ? ((totalLogsInPeriod - totalErrors) / totalLogsInPeriod) * 100 
      : 100;
    
    // Calculate average response time for successful requests
    const successfulLogs = requestLogs.filter(log => log.isError === 0 && log.responseTime !== null);
    const avgResponseTime = successfulLogs.length > 0
      ? successfulLogs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / successfulLogs.length
      : 0;
    
    // Prepare target usage data for pie chart
    const targetUsageData = targets.map(target => ({
      name: target.name || target.projectId,
      value: target.requestCount || 0,
      isActive: target.isActive
    }));
    
    // Prepare model usage data
    const modelCounts = new Map();
    requestLogs.forEach(log => {
      if (log.modelUsed) {
        const count = modelCounts.get(log.modelUsed) || 0;
        modelCounts.set(log.modelUsed, count + 1);
      }
    });
    
    const modelUsageData = Array.from(modelCounts.entries()).map(([model, count]) => ({
      name: model,
      value: count
    }));
    
    // Prepare time-based request data
    const timePeriods = generateTimePeriods(startDate, endDate, timeRange);
    const requestData = timePeriods.map(date => {
      const periodStart = formatDateForSql(date);
      let periodEnd;
      
      if (timeRange === '24h') {
        const nextHour = new Date(date);
        nextHour.setHours(nextHour.getHours() + 1);
        periodEnd = formatDateForSql(nextHour);
      } else {
        // Calculate end of the UTC day precisely
        const nextUtcDay = new Date(date);
        nextUtcDay.setUTCDate(nextUtcDay.getUTCDate() + 1);
        // nextUtcDay already has time 00:00:00Z from generateTimePeriods logic
        periodEnd = formatDateForSql(nextUtcDay);
      }

      const periodLogs = requestLogs.filter(log =>
        log.timestamp >= periodStart && log.timestamp < periodEnd
      );
      
      const periodErrors = periodLogs.filter(log => log.isError === 1);
      const periodTargetErrors = periodLogs.filter(log => 
        log.isError === 1 && log.errorType === 'TargetError'
      );
      
      return {
        name: date.toISOString(), // Return full ISO string instead of formatted date/hour
        requests: periodLogs.length,
        errors: periodErrors.length,
        targetErrors: periodTargetErrors.length
      };
    });
    
    // Prepare hourly data for last 24 hours
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    const hourlyTimePeriods = generateTimePeriods(last24Hours, endDate, '24h');
    
    const hourlyData = hourlyTimePeriods.map(hour => {
      const hourStart = formatDateForSql(hour);
      const nextHour = new Date(hour);
      nextHour.setHours(nextHour.getHours() + 1);
      const hourEnd = formatDateForSql(nextHour);
      
      const hourLogs = requestLogs.filter(log => 
        log.timestamp >= hourStart && log.timestamp < hourEnd
      );
      
      return {
        hour: hour.toISOString(), // Return full ISO string instead of just HH:00
        requests: hourLogs.length
      };
    });
    
    return {
      totalRequests,
      totalRequestsToday,
      totalErrors,
      targetErrors,
      successRate,
      avgResponseTime,
      activeTargets,
      requestData,
      hourlyData,
      targetUsageData,
      modelUsageData
    };
    
  } catch (error: any) {
    logError(error, { context: 'Stats API' });
    throw error;
  }
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
