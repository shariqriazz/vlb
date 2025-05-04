'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription // Added for stat help text
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Activity, Cpu, AlertCircle, RefreshCw, Target as TargetIcon, AlertTriangle, Loader2, BarChart3, CheckCircle, Clock, Server } from 'lucide-react'; // Added Loader2 and stats card icons, removed Key
import AppLayout from '@/components/layout/AppLayout';
import TargetStats from '@/components/targets/TargetStats'; // Keep this import
import { useToast } from "@/hooks/use-toast"; // Keep custom hook
import { cn } from "@/lib/utils"; // Import cn utility
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components

// Define the interface for VertexTarget (can be moved to a shared types file later)
interface VertexTarget {
  _id: string;
  name?: string;
  projectId: string;
  location: string;
  // modelId: string; // Removed
  isActive: boolean;
  lastUsed: string | null;
  rateLimitResetAt: string | null;
  failureCount: number;
  requestCount: number;
  dailyRateLimit?: number | null;
  dailyRequestsUsed: number;
  lastResetDate: string | null;
  isDisabledByRateLimit: boolean;
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("7d"); // Add timeRange state like stats page
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<VertexTarget[]>([]); // State for targets
  const [statsData, setStatsData] = useState<any>(null); // Use a more generic stats state like stats page
  const [isClient, setIsClient] = useState<boolean>(false); // State to track client-side mount

  // Simplified stats structure, similar to stats page for summary cards
  const [summaryStats, setSummaryStats] = useState({
      totalRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      activeTargets: 0
  });

  const { toast } = useToast(); // Use the custom hook

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch targets and stats concurrently
      const [targetsResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/targets'), // Keep fetching targets for the TargetStats component
        fetch(`/api/stats?timeRange=${timeRange}`) // Fetch full stats based on timeRange
      ]);

      // Check responses
      if (!targetsResponse.ok) {
        throw new Error(`Error fetching targets: ${targetsResponse.statusText}`);
      }
      if (!statsResponse.ok) {
        const errorData = await statsResponse.text();
        throw new Error(`Error fetching statistics (${statsResponse.status}): ${errorData || statsResponse.statusText}`);
      }

      // Parse JSON data
      const targetsResult = await targetsResponse.json();
      const fetchedStatsData = await statsResponse.json();
      const fetchedTargets: VertexTarget[] = targetsResult.targets || [];

      // Update targets state
      setTargets(fetchedTargets);
      // Update full stats state
      setStatsData(fetchedStatsData);

      // Update summary stats for the cards
      setSummaryStats({
        totalRequests: fetchedStatsData?.totalRequests ?? 0,
        successRate: fetchedStatsData?.successRate ?? 0,
        avgResponseTime: fetchedStatsData?.avgResponseTime ?? 0,
        activeTargets: fetchedStatsData?.activeTargets ?? 0,
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Failed to fetch dashboard data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch dashboard data',
        variant: 'destructive', // Use shadcn variant
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]); // Fetch when timeRange changes, like stats page

  // Set isClient to true after mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- Formatters (copied from stats page for consistency) ---
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

  const renderLoading = () => (
      <div className="flex items-center justify-center h-64"> {/* Adjusted height */}
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">Loading dashboard...</p>
      </div>
  );

  const renderError = () => (
       <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Error Fetching Dashboard Data</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
       </Alert>
  );

  return (
    <AppLayout>
      <TooltipProvider>
        {/* Header copied from stats page */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your Load Balancer</p> {/* Keep specific description */}
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
                <Button variant="outline" size="icon" onClick={fetchStats} disabled={isLoading}>
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="sr-only">Refresh dashboard</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Dashboard</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {error && renderError()}

        {/* Only render main content once client is mounted and data/error state is known */}
        {!isClient ? (
          // Render placeholders or minimal loading state for SSR/initial client render
           <div className="space-y-6">
              {/* Placeholder for summary cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                 <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
              </div>
              {/* Placeholder for Target Performance */}
              <Card className="h-[200px]">
                  <CardHeader><CardTitle>Target Performance</CardTitle></CardHeader>
                  <CardContent><Loader2 className="w-8 h-8 animate-spin text-primary" /></CardContent>
              </Card>
           </div>
        ) : isLoading ? (
           renderLoading() // Show full loading state after mount if still loading
         ) : error ? (
           renderError() // Show error after mount if fetch failed
         ) : !statsData ? (
           <Alert className="mb-6">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>No Data Available</AlertTitle>
              <AlertDescription>
                Could not load dashboard data. Try refreshing.
              </AlertDescription>
           </Alert>
         ) : (
          <>
            {/* Stats Summary Cards copied from stats page */}
            <div className="grid gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
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

        {/* Target Performance Card */}
            {/* Target Performance Card - Keep this specific to dashboard */}
            <Card className="mb-8 border-0 shadow-lg"> {/* Add similar styling */}
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.05)] via-transparent to-[hsl(var(--secondary)/0.05)] pointer-events-none" /> {/* Subtle gradient */}
              <CardHeader>
                <CardTitle>Target Performance</CardTitle>
                <CardDescription>Current status and usage of individual targets.</CardDescription> {/* Add description */}
              </CardHeader>
              <CardContent>
                <TargetStats targets={targets} fetchTargets={fetchStats} isLoading={isLoading} />
              </CardContent>
            </Card>
          </>
        )}
      </TooltipProvider>
    </AppLayout>
  );
}