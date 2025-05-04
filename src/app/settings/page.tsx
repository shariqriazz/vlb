'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useTheme } from 'next-themes';
import { Save, RefreshCw, Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Assuming Select was added previously
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; details?: any } | null>(null);

  const { toast } = useToast();
  const { theme, setTheme } = useTheme(); // Use next-themes hook

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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
      setError(errorMessage);
      console.error('Error fetching settings:', err);
      toast({
        title: 'Error Fetching Settings',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]); // Add toast to dependency array

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]); // fetchSettings is stable due to useCallback

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="flex justify-center items-center h-[80vh]">
            {/* Basic Loading Indicator */}
            <div className="flex items-center space-x-2 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading Settings...</span>
            </div>
            {/* Or use Skeleton */}
            {/* <div className="w-full space-y-4">
                <Skeleton className="w-1/4 h-10" />
                <Skeleton className="w-1/2 h-4" />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-64" />
                </div>
                <Skeleton className="h-48" />
                <Skeleton className="self-end w-32 h-10" />
            </div> */}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <TooltipProvider>
        <div className="p-6 space-y-6"> {/* Added padding and spacing */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Settings</h1>
              <p className="text-muted-foreground">Configure your Load Balancer</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={fetchSettings} disabled={isLoading}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh Settings</p>
              </TooltipContent>
            </Tooltip>
          </div>

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
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
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
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
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
                   <div className={`mt-3 p-3 border rounded-md ${importResult.message.startsWith('Error:') ? 'border-destructive bg-destructive/10 text-destructive' : 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400'}`}>
                    <p className="text-sm font-semibold">
                        {importResult.message.startsWith('Error:') ? 'Import Failed' : 'Import Result'}
                    </p>
                    <p className="mt-1 text-xs break-words">{importResult.message}</p>
                    {importResult.details?.results?.errors?.length > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="ml-1 text-xs underline cursor-help">(details)</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs break-words">
                                <p>Errors:</p>
                                <ul className="pl-4 list-disc">
                                    {importResult.details.results.errors.map((err: string, index: number) => (
                                        <li key={index}>{err}</li>
                                    ))}
                                </ul>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </TooltipProvider>
    </AppLayout>
  );
}