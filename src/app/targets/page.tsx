'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter for potential future use if needed
import { useCallback } from 'react'; // Import useCallback
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, // Import DialogClose if needed for explicit close button
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
   Card,
   CardContent,
   CardHeader,
   CardTitle,
   CardDescription
} from "@/components/ui/card"; // Import Card components
import { useToast } from "@/hooks/use-toast"; // Use shadcn's toast
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Plus, Target, Edit, AlertCircle, RefreshCw, BarChart3, CheckCircle, Clock, Server } from 'lucide-react'; // Added stats icons
import { cn } from "@/lib/utils"; // Import cn utility

import AppLayout from '@/components/layout/AppLayout';
import TargetStats from '@/components/targets/TargetStats'; // Assuming this component is/will be refactored
import { locationOptions } from '@/lib/constants/vertexOptions'; // Model options removed

// Updated interface for VertexTarget
interface VertexTarget {
  _id: string;
  name?: string;
  projectId: string;
  location: string;
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

export default function TargetsPage() {
  const [targets, setTargets] = useState<VertexTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For targets list
  const [error, setError] = useState<string | null>(null); // For targets list/actions
  const [isModalOpen, setIsModalOpen] = useState(false); // State for Dialog open/close
  const [timeRange, setTimeRange] = useState("7d"); // Add timeRange state
  const [summaryStatsData, setSummaryStatsData] = useState<any>(null); // State for stats API data
  const [summaryStatsLoading, setSummaryStatsLoading] = useState<boolean>(true); // Loading state for summary cards
  const [summaryStatsError, setSummaryStatsError] = useState<string | null>(null); // Error state for summary cards
  const [isClient, setIsClient] = useState<boolean>(false); // State to track client-side mount

  // Simplified stats structure for summary cards
  const [summaryStats, setSummaryStats] = useState({
      totalRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      activeTargets: 0
  });

  // State for new target form fields
  const [newName, setNewName] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newLocationCustom, setNewLocationCustom] = useState('');
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [newDailyRateLimit, setNewDailyRateLimit] = useState('');
  const [newSaKeyFile, setNewSaKeyFile] = useState<File | null>(null);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for resetting file input

  const fetchTargets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/targets');
      if (!response.ok) {
        throw new Error(`Error fetching targets: ${response.statusText}`);
      }
      const data = await response.json();
      setTargets(data.targets || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Vertex targets');
      console.error('Error fetching targets:', err);
       toast({
         variant: "destructive",
         title: "Error Fetching Targets",
         description: err.message || 'Failed to fetch Vertex targets.',
       });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Formatters ---
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
      setSummaryStatsData(data);
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
      // Don't toast here, show alert below header
    } finally {
      setSummaryStatsLoading(false);
    }
  }, [timeRange]);


  useEffect(() => {
    fetchTargets();
    fetchSummaryStats(); // Fetch summary stats initially
  }, []); // Empty dependency array for initial fetch

  // Re-fetch summary stats when timeRange changes
  useEffect(() => {
     fetchSummaryStats();
  }, [timeRange, fetchSummaryStats]);

  // Set isClient to true after mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleAddTarget = async () => {
    const locationValue = isCustomLocation ? newLocationCustom.trim() : newLocation.trim();

    if (!newProjectId.trim() || !locationValue || !newSaKeyFile) {
      toast({
        variant: "destructive",
        title: 'Validation Error',
        description: 'Project ID, Location, and Service Account Key file are required.',
      });
      return;
    }

    const formData = new FormData();
    formData.append('name', newName.trim());
    formData.append('projectId', newProjectId.trim());
    formData.append('location', locationValue);

    const rateLimitNum = parseInt(newDailyRateLimit.trim(), 10);
    if (newDailyRateLimit.trim() === '') {
      // Append nothing or handle as null in backend
    } else if (!isNaN(rateLimitNum) && rateLimitNum >= 0) {
      formData.append('dailyRateLimit', String(rateLimitNum));
    } else {
      toast({
        variant: "destructive",
        title: 'Validation Error',
        description: 'Invalid Daily Rate Limit. Must be a non-negative number or empty.',
      });
      return;
    }

    formData.append('serviceAccountKeyJson', newSaKeyFile);

    try {
      const response = await fetch('/api/admin/targets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add Vertex target');
      }

      toast({
        title: 'Success',
        description: 'Vertex target added successfully.',
      });

      // Reset form state
      setNewName('');
      setNewProjectId('');
      setNewLocation('');
      setNewLocationCustom('');
      setIsCustomLocation(false);
      setNewDailyRateLimit('');
      setNewSaKeyFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input
      }

      setIsModalOpen(false); // Close modal
      fetchTargets(); // Refresh the list
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: 'Error Adding Target',
        description: err.message || 'Failed to add Vertex target.',
      });
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewSaKeyFile(event.target.files[0]);
    } else {
      setNewSaKeyFile(null);
    }
  };

  // Handle location selection (using shadcn's onValueChange)
  const handleLocationChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomLocation(true);
      setNewLocation('custom'); // Keep track that custom was selected
    } else {
      setIsCustomLocation(false);
      setNewLocation(value);
      setNewLocationCustom(''); // Clear custom input if a preset is chosen
    }
  };

  return (
    <AppLayout>
     <TooltipProvider> {/* Add TooltipProvider */}
        <div className="p-6 space-y-6"> {/* Add padding and spacing */}

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Title and Description */}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Vertex Targets</h1>
              <p className="text-sm text-muted-foreground">Manage your Vertex AI targets</p>
            </div>

            {/* Right side controls: Time range, Refresh, Add New */}
            <div className="flex items-center gap-2">
              {/* Time Range Selector */}
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px] hidden sm:flex"> {/* Hide on very small screens */}
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => { fetchSummaryStats(); fetchTargets(); }} disabled={summaryStatsLoading || isLoading}>
                    <RefreshCw className={cn("h-4 w-4 text-primary", (summaryStatsLoading || isLoading) && "animate-spin")} /> {/* Added text-primary */}
                    <span className="sr-only">Refresh stats and targets</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Stats & Targets</p>
                </TooltipContent>
              </Tooltip>

              {/* Add New Target Dialog Trigger */}
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Add Target
                  </Button>
                </DialogTrigger>
                {/* Dialog Content remains the same */}
                 <DialogContent className={cn("sm:max-w-[425px] md:max-w-[600px]", "bg-background")}> {/* Added bg-background */}
                   <DialogHeader>
                     <DialogTitle>Add New Vertex Target</DialogTitle>
                     <DialogDescription>
                       Configure a new Vertex AI target endpoint. Ensure the Service Account has the 'Vertex AI User' role.
                     </DialogDescription>
                   </DialogHeader>
                   <div className="grid gap-4 py-4">
                     <div className="grid items-center grid-cols-4 gap-4">
                       <Label htmlFor="name" className="text-right">
                         Name (Optional)
                       </Label>
                       <Input
                         id="name"
                         placeholder="e.g., Gemini Pro EU"
                         value={newName}
                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                         className="col-span-3"
                       />
                     </div>
                     <div className="grid items-center grid-cols-4 gap-4">
                       <Label htmlFor="projectId" className="text-right">
                         Project ID <span className="text-destructive">*</span>
                       </Label>
                       <Input
                         id="projectId"
                         placeholder="your-gcp-project-id"
                         value={newProjectId}
                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProjectId(e.target.value)}
                         className="col-span-3"
                       />
                     </div>
                     <div className="grid items-center grid-cols-4 gap-4">
                       <Label htmlFor="location" className="text-right">
                         Location <span className="text-destructive">*</span>
                       </Label>
                       {!isCustomLocation ? (
                          <Select
                            value={newLocation}
                            onValueChange={handleLocationChange} // Use onValueChange
                          >
                           <SelectTrigger className="col-span-3">
                             <SelectValue placeholder="Select location" />
                           </SelectTrigger>
                           <SelectContent>
                             {locationOptions.map(option => (
                               <SelectItem key={option.value} value={option.value}>
                                 {option.label}
                               </SelectItem>
                             ))}
                             <SelectItem value="custom">Custom location...</SelectItem>
                           </SelectContent>
                         </Select>
                       ) : (
                          <div className="flex items-center col-span-3 gap-2">
                            <Input
                              id="locationCustom"
                              placeholder="Enter custom location (e.g., us-central1)"
                              value={newLocationCustom}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLocationCustom(e.target.value)}
                              className="flex-grow"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsCustomLocation(false);
                                setNewLocation(''); // Reset select value
                              }}
                            >
                              Back
                            </Button>
                          </div>
                       )}
                     </div>
                      <div className="grid items-center grid-cols-4 gap-4">
                        <Label htmlFor="sa-key-file-input" className="text-right">
                          SA Key (JSON) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="sa-key-file-input"
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleFileChange}
                          className="col-span-3"
                        />
                     </div>
                      {newSaKeyFile && (
                        <div className="grid items-center grid-cols-4 gap-4">
                          <div className="col-span-3 col-start-2">
                             <p className="text-sm text-muted-foreground">Selected: {newSaKeyFile.name}</p>
                          </div>
                        </div>
                       )}
                     <div className="grid items-center grid-cols-4 gap-4">
                       <Label htmlFor="dailyRateLimit" className="text-right">
                         Daily Rate Limit
                       </Label>
                       <Input
                         id="dailyRateLimit"
                         type="number"
                         placeholder="e.g., 1000 (empty for none)"
                         value={newDailyRateLimit}
                         onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDailyRateLimit(e.target.value)}
                         min="0"
                         className="col-span-3"
                       />
                     </div>
                   </div>
                   <DialogFooter>
                     <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                     </DialogClose>
                     <Button onClick={handleAddTarget}>Add Target</Button>
                   </DialogFooter>
                 </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Wrap content in client-side check */}
          {!isClient ? (
             <div className="space-y-6">
               {/* Placeholder for summary cards */}
               <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
                  <Card><CardContent className="pt-6 h-[108px] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></CardContent></Card>
               </div>
                {/* Placeholder for TargetStats */}
               <div className="flex items-center justify-center h-64 border rounded-md"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
             </div>
           ) : (
            <>
              {/* Summary Stats Error */}
              {summaryStatsError && (
                <Alert variant="destructive" className="mb-6">
               <AlertCircle className="w-4 h-4" />
               <AlertTitle>Error Fetching Summary Stats</AlertTitle>
               <AlertDescription>{summaryStatsError}</AlertDescription>
             </Alert>
          )}

          {/* Stats Summary Cards */}
          {summaryStatsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

          {/* Targets List Error */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Error Loading Targets</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Targets List Loading or Content */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48"> {/* Increased height */}
              <Loader2 className="w-8 h-8 animate-spin text-primary" /> {/* Larger spinner */}
            </div>
          ) : (
            // TargetStats component displays the list of targets
            <TargetStats targets={targets} fetchTargets={fetchTargets} isLoading={isLoading} />
          )} {/* End isLoading conditional */}
        </>
      )} {/* End !isClient conditional */}
    </div> {/* End of p-6 space-y-6 div */}
  </TooltipProvider>
</AppLayout>
  );
}