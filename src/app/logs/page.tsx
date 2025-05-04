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
import { Loader2, AlertCircle } from "lucide-react";

type LogType = "requests" | "errors" | "targets";

const LogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [logType, setLogType] = useState<LogType>("targets");
  const [loading, setLoading] = useState<boolean>(false);
  const [requestLogsTriggered, setRequestLogsTriggered] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(100);
  const [search, setSearch] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>(""); // Debounced search term
  const { toast } = useToast();
  const [appErrorStats, setAppErrorStats] = useState<{ totalErrors: number, targetErrors: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false); // State to track client-side mount

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


  const fetchAppErrorStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
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
      setStatsError(errorMessage);
      toast({
        title: "Error fetching error summary",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

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
      return <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin" /></div>;
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
      <div className="flex flex-col space-y-6">
        <h1 className="text-2xl font-bold">Application Logs</h1>

        {/* Error Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Other Application Errors (Last 24h)</CardTitle>
            <CardDescription>Total errors excluding target failures</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="text-3xl font-bold">
               {!isClient ? 0 : statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : statsError ? 'Error' : otherApplicationErrors}
             </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4">
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
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
              <div className="flex items-center justify-center h-32"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : !requestLogsTriggered ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4 border rounded-md">
                <p className="text-muted-foreground">Request logs can be large.</p>
                <Button
                  onClick={handleLoadRequests}
                  disabled={loading && logType === 'requests'}
                >
                  {loading && logType === 'requests' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
      </div>
    </AppLayout>
  );
};

export default LogsPage;
