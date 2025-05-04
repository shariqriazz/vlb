'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useTheme } from 'next-themes';
import { Save, RefreshCw, Download, Upload, AlertCircle, CheckCircle, Loader2, BarChart3, Clock, Server } from 'lucide-react'; // Added summary card icons
import { cn } from "@/lib/utils"; // Import cn utility

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton'; // Use Skeleton for loading
import AppLayout from '@/components/layout/AppLayout';
import { useToast } from '@/hooks/use-toast'; // Use project's toast hook

interface Settings {
  targetRotationRequestCount: number;
  maxFailureCount: number;
  rateLimitCooldown: number;
  logRetentionDays: number;
  maxRetries: number;
  failoverDelaySeconds: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    targetRotationRequestCount: 5,
    maxFailureCount: 5,
    rateLimitCooldown: 60,
    logRetentionDays: 14,
    maxRetries: 3,
    failoverDelaySeconds: 2,
  });

  const [isLoading, setIsLoading] = useState(true); // For main settings data
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null); // For main settings actions
  const [isSaved, setIsSaved] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; details?: any } | null>(null);
  const [timeRange, setTimeRange] = useState("7d"); // Add timeRange state
  const [summaryStatsData, setSummaryStatsData] = useState<any>(null); // State for stats API data
  const [summaryStatsLoading, setSummaryStatsLoading] = useState<boolean>(true); // Loading state for summary cards
  const [summaryStatsError, setSummaryStatsError] = useState<string | null>(null); // Error state for summary cards
  const [isClient, setIsClient] = useState<boolean>(false); // State to track client-side mount

  const { toast } = useToast();
  const { theme, setTheme } = useTheme(); // Use next-themes hook

  // Simplified stats structure for summary cards
  const [summaryStats, setSummaryStats] = useState({
      totalRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      activeTargets: 0
  });


  const fetchSettings = useCallback(async () => {
    setIsLoading(true); // Keep this for the main settings form
    setError(null); // Reset main settings error
    setIsSaved(false); // Reset saved state on fetch

    try {
      const response = await fetch('/api/settings');
      if (!response.ok) {
        throw new Error(`Error fetching settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch settings';
      setError(errorMessage); // Set main settings error
      console.error('Error fetching settings:', err);
      toast({
        title: 'Error Fetching Settings',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false); // Keep this for the main settings form
    }
  }, [toast]); // Add toast to dependency array

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
  }, [timeRange]); // Removed toast dependency


  useEffect(() => {
    fetchSettings();
    fetchSummaryStats(); // Fetch summary stats initially
  }, [fetchSettings]); // fetchSettings is stable

  // Re-fetch summary stats when timeRange changes
  useEffect(() => {
     fetchSummaryStats();
  }, [timeRange, fetchSummaryStats]);

  // Set isClient to true after mounting
  useEffect(() => {
    setIsClient(true);
  }, []);


  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null); // Reset main settings error
    setIsSaved(false);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      setIsSaved(true);

      toast({
        title: 'Settings Saved',
        description: 'Your settings have been updated successfully.',
      });
      // Auto-dismiss success alert after a delay
      setTimeout(() => setIsSaved(false), 3000);

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save settings';
      setError(errorMessage);
      toast({
        title: 'Error Saving Settings',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof Settings, value: string | number) => {
    // Ensure numeric fields are stored as numbers
    const numericFields: (keyof Settings)[] = [
      'targetRotationRequestCount',
      'maxFailureCount',
      'rateLimitCooldown',
      'logRetentionDays',
      'maxRetries',
      'failoverDelaySeconds',
    ];
    const processedValue = numericFields.includes(field) ? Number(value) : value;
    setSettings((prev) => ({ ...prev, [field]: processedValue }));
  };

  const handleCleanupLogs = useCallback(async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/cleanup-logs', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Log cleanup failed');
      }

      const successMessage = data.message || 'Log cleanup completed successfully.';
      setCleanupResult(successMessage);
      toast({
        title: 'Log Cleanup Successful',
        description: successMessage,
      });

    } catch (err: any) {
      const errorMessage = `Error: ${err.message}`;
      setCleanupResult(errorMessage);
      setError(`Cleanup Error: ${err.message}`);
      toast({
        title: 'Log Cleanup Failed',
        description: err.message || 'Could not delete old log files.',
        variant: 'destructive',
      });
    } finally {
      setIsCleaning(false);
    }
  }, [toast]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setImportResult(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleExportData = () => {
    window.location.href = '/api/admin/data/export';
  };

  const handleImportData = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a JSON file to import.',
        variant: 'destructive', // Use destructive variant for warnings/errors
      });
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/admin/data/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Data import failed');
      }

      const importSuccessMessage = data.message || `Import finished. Keys: ${data.results?.keys}, Settings: ${data.results?.settings}, Logs: ${data.results?.logs}. Errors: ${data.results?.errors?.length || 0}`;
      const hasImportErrors = (data.results?.errors?.length ?? 0) > 0;

      setImportResult({ message: importSuccessMessage, details: data });
      toast({
        title: hasImportErrors ? 'Data Import Complete (with errors)' : 'Data Import Complete',
        description: importSuccessMessage,
        variant: hasImportErrors ? 'default' : 'default', // Use default, color indicates status
        duration: 7000,
      });
      fetchSettings(); // Refresh settings after import

    } catch (err: any) {
      const importErrorMessage = `Error: ${err.message}`;
      setImportResult({ message: importErrorMessage });
      setError(`Import Error: ${err.message}`);
      toast({
        title: 'Data Import Failed',
        description: err.message || 'Could not import data from file.',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setSelectedFile(null);
      const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }, [selectedFile, toast, fetchSettings]); // Added fetchSettings dependency

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // Removed the full page loading state based on `isLoading` for settings

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6"> {/* Added padding and spacing */}

          {/* Header copied from stats page */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure your Load Balancer</p>
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
                  {/* Refresh button fetches both summary and main settings */}
                  <Button variant="outline" size="icon" onClick={() => { fetchSummaryStats(); fetchSettings(); }} disabled={summaryStatsLoading || isLoading}>
                    <RefreshCw className={cn("h-4 w-4", (summaryStatsLoading || isLoading) && "animate-spin")} /> {/* Removed text-primary */}
                    <span className="sr-only">Refresh stats and settings</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh Stats & Settings</p>
                </TooltipContent>
              </Tooltip>
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
               {/* Placeholder for settings cards */}
               <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                 <Skeleton className="h-[400px]" />
                 <Skeleton className="h-[480px]" />
               </div>
               {/* Placeholder for Backup/Restore */}
               <Skeleton className="h-[250px]" />
               {/* Placeholder for Save Button */}
               <div className="flex justify-end">
                  <Skeleton className="w-32 h-10" />
               </div>
            </div>
          ) : (
           <>
             {/* Display summary stats error if exists */}
             {summaryStatsError && (
                <Alert variant="destructive">
               <AlertCircle className="w-4 h-4" />
               <AlertTitle>Error Fetching Summary Stats</AlertTitle>
               <AlertDescription>{summaryStatsError}</AlertDescription>
             </Alert>
          )}

          {/* Stats Summary Cards copied from stats page */}
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

           {/* Display main settings error */}
           {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Error!</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isSaved && (
            <Alert>
                <CheckCircle className="w-4 h-4" />
                <AlertTitle>Success!</AlertTitle>
                <AlertDescription>Settings saved successfully.</AlertDescription>
            </Alert>
           )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Target Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Target Settings</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targetRotationRequestCount">Target Rotation Request Count</Label>
                  <Input
                    id="targetRotationRequestCount"
                    type="number"
                    value={settings.targetRotationRequestCount}
                    onChange={(e) => handleInputChange('targetRotationRequestCount', e.target.value)}
                    min={1}
                    max={100}
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of requests before rotating to the next target.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxFailureCount">Maximum Failure Count</Label>
                  <Input
                    id="maxFailureCount"
                    type="number"
                    value={settings.maxFailureCount}
                    onChange={(e) => handleInputChange('maxFailureCount', e.target.value)}
                    min={1}
                    max={1000}
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of failures before disabling a target.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitCooldown">Rate Limit Cooldown (seconds)</Label>
                  <Input
                    id="rateLimitCooldown"
                    type="number"
                    value={settings.rateLimitCooldown}
                    onChange={(e) => handleInputChange('rateLimitCooldown', e.target.value)}
                    min={1}
                    max={3600}
                  />
                  <p className="text-sm text-muted-foreground">
                    Default cooldown period when rate limit is hit (if not specified by API).
                  </p>
                </div>

                 <div className="space-y-2">
                   <Label htmlFor="failoverDelaySeconds">Failover Delay (seconds)</Label>
                   <Input
                     id="failoverDelaySeconds"
                     type="number"
                     value={settings.failoverDelaySeconds}
                     onChange={(e) => handleInputChange('failoverDelaySeconds', e.target.value)}
                     min={0}
                     max={60}
                   />
                   <p className="text-sm text-muted-foreground">
                    Delay before switching targets on rate limit (0 for immediate).
                   </p>
                 </div>
              </CardContent>
            </Card>

            {/* System Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logRetentionDays">Log Retention (days)</Label>
                  <Input
                    id="logRetentionDays"
                    type="number"
                    value={settings.logRetentionDays}
                    onChange={(e) => handleInputChange('logRetentionDays', e.target.value)}
                    min={1}
                    max={90}
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of days to keep logs before manual cleanup.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRetries">Max Retries on Failure</Label>
                  <Input
                    id="maxRetries"
                    type="number"
                    value={settings.maxRetries ?? 3}
                    onChange={(e) => handleInputChange('maxRetries', e.target.value)}
                    min={0}
                    max={10}
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum retries for a request before failing over (0 to disable).
                  </p>
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                    <span>Dark Mode</span>
                  </Label>
                  <Switch
                    id="dark-mode"
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>

                <Separator />

                {/* Cleanup Button */}
                <div className="flex flex-col space-y-2">
                    <Label>Manual Log Cleanup</Label>
                    <Button
                        variant="outline"
                        onClick={handleCleanupLogs}
                        disabled={isCleaning}
                        size="sm"
                    >
                        {isCleaning ? (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {/* Removed text-primary */}
                                Cleaning...
                            </>
                        ) : (
                            'Cleanup Logs Now'
                        )}
                    </Button>
                    {cleanupResult && (
                        <p className={`text-sm ${cleanupResult.startsWith('Error:') ? 'text-destructive' : 'text-green-600'}`}>
                            {cleanupResult}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Deletes log files older than the configured retention period.
                    </p>
                 </div>

              </CardContent>
            </Card>
          </div>

          {/* Import/Export Card */}
          <Card>
            <CardHeader>
              <CardTitle>Backup & Restore Data</CardTitle>
              <CardDescription>Manage your application data backups.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
              {/* Export Section */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Backup All Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download a JSON file containing all API Keys, Settings, and Request Log history. Useful for backups or migration.
                </p>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="w-4 h-4 mr-2" />
                  Backup All Data
                </Button>
              </div>

              {/* Import Section */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Restore Data from Backup</h3>
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertTitle>Warning!</AlertTitle>
                  <AlertDescription>
                    Restoring will **overwrite** all current API Keys, Settings, and Request Logs.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Upload a previously exported JSON backup file.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="import-file-input" className="sr-only">Select JSON file</Label>
                  <Input
                    id="import-file-input"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  <Button
                    variant="outline"
                    onClick={handleImportData}
                    disabled={!selectedFile || isImporting}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {/* Removed text-primary */}
                        Restoring...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Restore from File
                      </>
                    )}
                  </Button>
                </div>
                {importResult && (
                  <Alert variant={importResult.message.startsWith('Error:') ? 'destructive' : 'default'} className="mt-3">
                    {importResult.message.startsWith('Error:') ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" /> }
                    <AlertTitle>
                      {importResult.message.startsWith('Error:') ? 'Import Failed' : 'Import Result'}
                    </AlertTitle>
                    <AlertDescription className="break-words">
                      {importResult.message}
                      {importResult.details?.results?.errors?.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="ml-1 text-xs underline cursor-help">(details)</span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs break-words">
                            <p className="font-semibold">Errors:</p>
                            <ul className="pl-4 list-disc">
                              {importResult.details.results.errors.map((err: string, index: number) => (
                                <li key={index}>{err}</li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> {/* Removed text-primary */}
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div> {/* End of Save Button div */}
          </>
        )} {/* End of isClient conditional rendering */}
      </div> {/* End of p-6 space-y-6 div */}
    </TooltipProvider>
  </AppLayout>
  );
}