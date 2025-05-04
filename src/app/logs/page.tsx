"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Import Tooltip components
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, RefreshCw, BarChart3, CheckCircle, Clock, Server } from "lucide-react"; // Import new icons
import { cn } from "@/lib/utils"; // Import cn utility

type LogType = "requests" | "errors" | "targets";

const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [logType, setLogType] = useState<LogType>("targets");
  const [loading, setLoading] = useState<boolean>(false); // For logs fetching
  const [requestLogsTriggered, setRequestLogsTriggered] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // For logs fetching
  const [limit, setLimit] = useState<number>(100);
  const [search, setSearch] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>(""); // Debounced search term
  const [timeRange, setTimeRange] = useState("7d"); // Add timeRange state
  const [summaryStatsData, setSummaryStatsData] = useState<any>(null); // State for stats API data
  const [summaryStatsLoading, setSummaryStatsLoading] = useState<boolean>(true); // Loading state for summary cards
  const [summaryStatsError, setSummaryStatsError] = useState<string | null>(null); // Error state for summary cards
  const { toast } = useToast();
  // Keep existing states for error card and log fetching
  const [appErrorStats, setAppErrorStats] = useState<{ totalErrors: number, targetErrors: number } | null>(null);
  const [appErrorStatsLoading, setAppErrorStatsLoading] = useState<boolean>(true); // Rename statsLoading
  const [appErrorStatsError, setAppErrorStatsError] = useState<string | null>(null); // Rename statsError
  const [isClient, setIsClient] = useState<boolean>(false); // State to track client-side mount

  // Simplified stats structure for summary cards (like dashboard)
  const [summaryStats, setSummaryStats] = useState({
      totalRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      activeTargets: 0
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: logType,
        limit: limit.toString(),
      });
      if (searchTerm) {
        params.append("search", searchTerm);
      }

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
      const errorMessage = err.message || "Failed to fetch logs.";
      setError(errorMessage);
      setLogs([]);
      toast({
        title: "Error fetching logs",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [logType, limit, searchTerm, toast]);

  // Fetch initial logs for the default tab ('targets')
  useEffect(() => {
    // Only fetch initial logs on the client after mount
    if (isClient && logType === "targets") { // Fetch targets by default
        fetchLogs();
    }
  }, [isClient, logType, fetchLogs]); // Add fetchLogs dependency


  // --- Formatters (copied from stats/dashboard page for consistency) ---
  const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return "N/A";
    }
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
        return "N/A";
    }
    return value.toLocaleString();
  }
  // --- End Formatters ---

  // Fetch data for the summary cards
  const fetchSummaryStats = useCallback(async () => {
    setSummaryStatsLoading(true);
    setSummaryStatsError(null);
    try {
      const response = await fetch(`/api/stats?timeRange=${timeRange}`);
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error fetching summary statistics (${response.status}): ${errorData || response.statusText}`);
      }
      const data = await response.json();
      setSummaryStatsData(data); // Store full data if needed elsewhere
      // Update summary stats for the cards
      setSummaryStats({
        totalRequests: data?.totalRequests ?? 0,
        successRate: data?.successRate ?? 0,
        avgResponseTime: data?.avgResponseTime ?? 0,
        activeTargets: data?.activeTargets ?? 0,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch summary statistics";
      setSummaryStatsError(errorMessage);
      console.error("Error fetching summary stats:", err);
      toast({
        title: "Error Fetching Summary Stats",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSummaryStatsLoading(false);
    }
  }, [timeRange, toast]);


  // Keep the original error stats fetching for the specific error card
  const fetchAppErrorStats = useCallback(async () => {
    setAppErrorStatsLoading(true); // Use renamed state
    setAppErrorStatsError(null); // Use renamed state
    try {
      const response = await fetch(`/api/stats?timeRange=24h`); // Fetch 24h stats
      if (!response.ok) {
        throw new Error(`Error fetching stats: ${response.statusText}`);
      }
      const data = await response.json();
      setAppErrorStats({
        totalErrors: data.totalErrors ?? 0,
        targetErrors: data.targetErrors ?? 0,
      });
    } catch (err: any) {
      console.error("Failed to fetch app error stats:", err);
      const errorMessage = err.message || "Failed to fetch error summary.";
      setAppErrorStatsError(errorMessage); // Use renamed state
      toast({
        title: "Error fetching error summary",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setAppErrorStatsLoading(false); // Use renamed state
    }
  }, [toast]);


  // Fetch summary stats when timeRange changes or on client mount
  useEffect(() => {
    if (isClient) {
      fetchSummaryStats();
    }
  }, [isClient, timeRange, fetchSummaryStats]);

  // Fetch app error stats on client mount (no dependency on timeRange needed for this)
  useEffect(() => {
    if (isClient) {
      fetchAppErrorStats();
    }
  }, [isClient, fetchAppErrorStats]);

  // Basic debounce for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(search);
    }, 500); // Adjust delay as needed

    return () => {
      clearTimeout(handler);
    };
  }, [search]);

  // Set isClient to true after mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

   // Fetch logs when searchTerm changes (debounced search) or limit changes
   useEffect(() => {
    // Only run if client-side and not the initial 'requests' tab load
    if (isClient && (logType !== 'requests' || requestLogsTriggered)) {
      fetchLogs();
    }
  }, [searchTerm, limit, isClient, logType, requestLogsTriggered, fetchLogs]); // Added fetchLogs


  const handleTabChange = (value: string) => {
    const newType = value as LogType;
    setLogType(newType);
    // No immediate fetch here, rely on useEffect dependency changes
  };

  const handleSearch = () => {
    setSearchTerm(search); // Trigger search immediately on button click
    // fetchLogs(); // fetchLogs is triggered by searchTerm change via useEffect
  };

  const handleLoadRequests = () => {
    setRequestLogsTriggered(true);
    // fetchLogs will be triggered by the state change via useEffect
  };

  // Calculate other application errors
  const otherApplicationErrors = useMemo(() => {
    if (!appErrorStats) return 0;
    return Math.max(0, appErrorStats.totalErrors - appErrorStats.targetErrors);
  }, [appErrorStats]);

  const renderLogs = (currentLogType: LogType) => {
    if (loading) {
      return <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      );
    }
    return (
      <div className="bg-muted/50 p-4 rounded-md max-h-[70vh] overflow-y-auto border">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <pre
              key={`${currentLogType}-${index}`} // Use a key based on type and index
              className="block p-2 mb-2 overflow-x-auto text-sm whitespace-pre-wrap border rounded-sm bg-background text-foreground"
            >
              {JSON.stringify(log, null, 2)}
            </pre>
          ))
        ) : (
          <p className="py-4 text-center text-muted-foreground">No {currentLogType} logs found matching criteria.</p>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
     <TooltipProvider> {/* Add TooltipProvider */}
      <div className="flex flex-col space-y-6">

        {/* Header copied from stats page */}
        <div className="flex flex-wrap items-center justify-between gap-4"> {/* Removed mb-6 */}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Application Logs</h1>
            <p className="text-sm text-muted-foreground">View and search system logs</p> {/* Updated description */}
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Refresh button fetches both summary and app error stats */}
                <Button variant="outline" size="icon" onClick={() => { fetchSummaryStats(); fetchAppErrorStats(); }} disabled={summaryStatsLoading || appErrorStatsLoading}>
                  <RefreshCw className={cn("h-4 w-4", (summaryStatsLoading || appErrorStatsLoading) && "animate-spin")} />
                  <span className="sr-only">Refresh logs and stats</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Stats</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Display summary stats error if exists */}
        {summaryStatsError && (
           <Alert variant="destructive">
             <AlertCircle className="w-4 h-4" />
             <AlertTitle>Error Fetching Summary Stats</AlertTitle>
             <AlertDescription>{summaryStatsError}</AlertDescription>
           </Alert>
        )}

        {/* Wrap Summary Cards and rest of content in client-only rendering check */}
        {!isClient ? (
           <div className="space-y-6">
              {/* Placeholder for summary cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
              </div>
              {/* Placeholder for App Error Card */}
              <Card className="h-[100px]"><CardHeader><CardTitle>Other Application Errors</CardTitle></CardHeader><CardContent><Loader2 className="w-6 h-6 animate-spin text-primary" /></CardContent></Card>
              {/* Placeholder for Filters */}
              <div className="h-10"></div>
              {/* Placeholder for Tabs */}
              <div className="flex items-center justify-center h-64 border rounded-md"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
           </div>
         ) : (
          <>
            {/* Stats Summary Cards copied from stats page */}
            {summaryStatsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Optional: Add Skeleton loaders here */}
            <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-1)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                  <BarChart3 className="w-5 h-5 text-[hsl(var(--chart-1))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(summaryStats.totalRequests)}</div>
                  <p className="text-xs text-muted-foreground">Lifetime total</p>
                </CardContent>
              </Card>
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-2)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="w-5 h-5 text-[hsl(var(--chart-2))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPercentage(summaryStats.successRate)}</div>
                  <p className="text-xs text-muted-foreground">In selected period</p>
                </CardContent>
              </Card>
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-3)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
                  <Clock className="w-5 h-5 text-[hsl(var(--chart-3))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryStats.avgResponseTime !== null && summaryStats.avgResponseTime !== undefined ? `${Math.round(summaryStats.avgResponseTime)}ms` : 'N/A'}</div>
                  <p className="text-xs text-muted-foreground">Across successful requests</p>
                </CardContent>
              </Card>
             <Card className="overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--chart-4)/0.2)] to-transparent opacity-50 pointer-events-none" />
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Active Targets</CardTitle>
                  <Server className="w-5 h-5 text-[hsl(var(--chart-4))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(summaryStats.activeTargets)}</div>
                  <p className="text-xs text-muted-foreground">Currently in rotation</p>
                </CardContent>
              </Card>
          </div>
        )}

        {/* Keep original App Error Summary Card for specific log page context */}
        <Card className="border-0 shadow-lg">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5" />
          <CardHeader>
            <CardTitle className="text-lg">Other Application Errors (Last 24h)</CardTitle>
            <CardDescription>Total errors excluding target failures</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold">
               {/* Use renamed loading/error states */}
               {!isClient ? 0 : appErrorStatsLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : appErrorStatsError ? 'Error' : otherApplicationErrors}
             </div>
             {appErrorStatsError && <p className="text-sm text-destructive">{appErrorStatsError}</p>}
          </CardContent>
        </Card>


        {/* Filters */}
        <div className="flex flex-col pt-4 space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4"> {/* Add padding top */}
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="flex-grow"
          />
          <Select value={limit.toString()} onValueChange={(value) => setLimit(Number(value))}>
             <SelectTrigger className="w-full sm:w-[150px]">
               <SelectValue placeholder="Limit" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="50">50</SelectItem>
               <SelectItem value="100">100</SelectItem>
               <SelectItem value="200">200</SelectItem>
               <SelectItem value="500">500</SelectItem>
             </SelectContent>
           </Select>
          <Button onClick={handleSearch} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" />}
            Search
          </Button>
          {/* Add Date Pickers here if needed */}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="targets" onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="targets">Targets</TabsTrigger>
          </TabsList>
          <TabsContent value="requests" className="mt-4">
            {/* Request Logs Tab Content - Only render conditional UI on client */}
            {!isClient ? (
              <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : !requestLogsTriggered ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4 border rounded-md">
                <p className="text-muted-foreground">Request logs can be large.</p>
                <Button
                  onClick={handleLoadRequests}
                  disabled={loading && logType === 'requests'}
                >
                  {loading && logType === 'requests' && <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" />}
                  Load Request Logs
                </Button>
              </div>
            ) : (
              renderLogs("requests")
            )}
          </TabsContent>
          <TabsContent value="errors" className="mt-4">
             {renderLogs("errors")}
          </TabsContent>
          <TabsContent value="targets" className="mt-4">
             {renderLogs("targets")}
          </TabsContent>
            </Tabs>
          </>
         )}
      </div>
     </TooltipProvider> {/* Close TooltipProvider */}
    </AppLayout>
  );
};

export default LogsPage;
