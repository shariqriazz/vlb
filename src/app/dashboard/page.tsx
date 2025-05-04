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
import { Key, Activity, Cpu, AlertCircle, RefreshCw, Target as TargetIcon, AlertTriangle } from 'lucide-react'; // Use lucide-react icons
import AppLayout from '@/components/layout/AppLayout';
import TargetStats from '@/components/targets/TargetStats'; // Keep this import
import { useToast } from "@/hooks/use-toast"; // Keep custom hook

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<VertexTarget[]>([]); // State for targets
  const [stats, setStats] = useState({
    totalTargets: 0,
    activeTargets: 0,
    totalRequests: 0, // Lifetime total from DB (sum of target request counts)
    totalRequestsToday: 0, // Since midnight from DB (sum of target daily counts)
    totalRequests24h: 0, // Last 24h from logs
    targetErrorRate: 0, // Use target errors
    avgResponseTime: 0 // Added avg response time
  });

  const { toast } = useToast(); // Use the custom hook

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch targets and stats concurrently
      const [targetsResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/targets'),
        fetch('/api/stats?timeRange=24h')
      ]);

      // Check responses
      if (!targetsResponse.ok) {
        throw new Error(`Error fetching targets: ${targetsResponse.statusText}`);
      }
      if (!statsResponse.ok) {
        throw new Error(`Error fetching stats: ${statsResponse.statusText}`);
      }

      // Parse JSON data
      const targetsResult = await targetsResponse.json();
      const statsData = await statsResponse.json();
      const fetchedTargets: VertexTarget[] = targetsResult.targets || [];

      // Update targets state
      setTargets(fetchedTargets);

      // Calculate stats based on fetched targets and stats data
      const totalTargets = fetchedTargets.length;
      const activeTargets = fetchedTargets.filter((target: VertexTarget) => target.isActive).length;

      // Use data from stats API
      const totalRequests = statsData.totalRequests || 0;
      const totalRequestsToday = statsData.totalRequestsToday || 0;
      const totalRequests24h = statsData.requestData?.reduce((sum: number, item: any) => sum + item.requests, 0) || 0;
      const targetErrors = statsData.targetErrors || 0;
      const avgResponseTime = statsData.avgResponseTime || 0;

      // Calculate target error rate
      const targetErrorRate = totalRequests24h > 0
        ? ((targetErrors / totalRequests24h) * 100)
        : 0;

      setStats({
        totalTargets,
        activeTargets,
        totalRequests, // Lifetime
        totalRequestsToday, // Since midnight
        totalRequests24h, // From stats API
        targetErrorRate,
        avgResponseTime
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
  }, []); // Keep dependency array empty for initial fetch

  // Helper component for Stat Cards
  const StatCard = ({ icon: IconComponent, title, value, helpText, iconColor = "text-primary" }: { icon: React.ElementType, title: string, value: string | number, helpText: string, iconColor?: string }) => (
    <Card>
      <CardContent className="pt-6"> {/* Add padding */}
        <div className="flex items-center space-x-3">
          <IconComponent className={`h-6 w-6 ${iconColor}`} />
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{isLoading ? '-' : value}</p>
            <p className="text-xs text-muted-foreground">{helpText}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your Load Balancer</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Refresh dashboard"
                variant="ghost"
                size="icon"
                onClick={fetchStats}
                disabled={isLoading}
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Dashboard</TooltipContent>
          </Tooltip>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="w-4 h-4" /> {/* Use lucide icon */}
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Grid for Stats */}
        <div className="grid gap-6 mb-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            icon={TargetIcon}
            title="Total Targets"
            value={stats.totalTargets}
            helpText="Vertex AI Targets Configured"
            iconColor="text-blue-500"
          />
          <StatCard
            icon={Activity}
            title="Active Targets"
            value={stats.activeTargets}
            helpText="Ready for Use"
            iconColor="text-green-500"
          />
          <StatCard
            icon={Cpu}
            title="Requests (24h)"
            value={stats.totalRequests24h}
            helpText="Last 24 Hours"
            iconColor="text-cyan-500"
          />
          <StatCard
            icon={Cpu}
            title="Requests (Today)"
            value={stats.totalRequestsToday}
            helpText="Since Midnight"
            iconColor="text-teal-500"
          />
          <StatCard
            icon={Cpu}
            title="Requests (Lifetime)"
            value={stats.totalRequests}
            helpText="All Time"
            iconColor="text-purple-500"
          />
          <StatCard
            icon={AlertCircle}
            title="Target Error Rate"
            value={`${stats.targetErrorRate.toFixed(1)}%`}
            helpText="Last 24 Hours"
            iconColor="text-orange-500"
          />
        </div>

        {/* Target Performance Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Target Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <TargetStats targets={targets} fetchTargets={fetchStats} isLoading={isLoading} />
          </CardContent>
        </Card>
      </TooltipProvider>
    </AppLayout>
  );
}