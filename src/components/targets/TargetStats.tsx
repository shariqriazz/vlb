'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // Will trigger manually
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, // Will trigger manually
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RefreshCw, Trash2, Edit2, Settings, AlertTriangle, Target as TargetIcon } from 'lucide-react'; // Use lucide-react
import { locationOptions, modelIdOptions } from '@/lib/constants/vertexOptions';

// Updated interface for VertexTarget (matching TargetsPage)
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

// Define Props for the component
interface TargetStatsProps {
  targets: VertexTarget[];
  fetchTargets: () => Promise<void>;
  isLoading: boolean; // Receive loading state from parent
}

export default function TargetStats({ targets: initialTargets, fetchTargets, isLoading: parentIsLoading }: TargetStatsProps) {
  const [targets, setTargets] = useState<VertexTarget[]>(initialTargets);
  const [isLoading, setIsLoading] = useState(parentIsLoading);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isToggling, setIsToggling] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  // State for Delete confirmation
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // State for Rate Limit Override confirmation
  const [isWarnOpen, setIsWarnOpen] = useState(false);
  const [targetToToggle, setTargetToToggle] = useState<string | null>(null);

  // State for Edit modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<VertexTarget | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editProjectIdValue, setEditProjectIdValue] = useState('');
  const [editLocationValue, setEditLocationValue] = useState('');
  const [editLocationCustomValue, setEditLocationCustomValue] = useState('');
  const [isEditCustomLocation, setIsEditCustomLocation] = useState(false);
  const [editRateLimitValue, setEditRateLimitValue] = useState<string>('');
  const [isSavingChanges, setIsSavingChanges] = useState(false);

  // State for bulk selection
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set());

  // State for Bulk Limit Modal
  const [isBulkLimitOpen, setIsBulkLimitOpen] = useState(false);
  const [bulkLimitValue, setBulkLimitValue] = useState<string>('');
  const [isApplyingBulkLimit, setIsApplyingBulkLimit] = useState(false);

  // State for Bulk Delete Modal
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Update local state when props change
  useEffect(() => {
    setTargets(initialTargets);
  }, [initialTargets]);

  useEffect(() => {
    setIsLoading(parentIsLoading);
  }, [parentIsLoading]);

  // Refresh data using the passed function
  const refreshData = () => {
    fetchTargets(); // Use the prop function
  };

  // Function to get status badge
  const getStatusBadge = (target: VertexTarget) => {
    if (!target.isActive) {
      return <Badge variant="secondary">Disabled</Badge>; // Use 'secondary' for gray-ish
    }
    if (target.isDisabledByRateLimit) {
      return <Badge variant="destructive">Daily Limited</Badge>; // Use 'destructive' for orange/red
    }
    if (target.rateLimitResetAt && new Date(target.rateLimitResetAt) > new Date()) {
      return <Badge variant="outline">Rate Limited</Badge>; // Use 'outline' for yellow-ish
    }
    return <Badge variant="default">Active</Badge>; // Use 'default' for green (or primary color)
  };

  // Function to format date (no change needed)
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

   // --- Delete Logic ---
   const openDeleteDialog = (targetId: string) => {
    setSelectedTargetId(targetId);
    setIsDeleteOpen(true);
  };

  const handleDeleteTarget = async () => {
    if (!selectedTargetId) return;

    try {
      const response = await fetch(`/api/admin/targets/${selectedTargetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete target');
      }

      toast({
        title: 'Success',
        description: 'Vertex Target deleted successfully',
        variant: "default",
      });

      fetchTargets(); // Refresh the list
    } catch (error) {
      console.error('Error deleting target:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete Vertex Target',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteOpen(false);
      setSelectedTargetId(null); // Clear selected target ID
    }
  };

  // --- Toggle Logic ---
  const proceedWithToggle = async (targetId: string) => {
    setIsToggling(prev => ({ ...prev, [targetId]: true }));
    let success = false;
    try {
      const response = await fetch(`/api/admin/targets/${targetId}`, {
        method: 'PATCH', // Assuming PATCH toggles the isActive status
      });

      if (!response.ok) {
        throw new Error('Failed to update target status');
      }

      success = true;
      toast({
        title: 'Success',
        description: `Vertex Target status updated successfully.`,
        variant: "default",
      });
      fetchTargets(); // Refresh the list

    } catch (error) {
      console.error('Error toggling target status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update Vertex Target status',
        variant: 'destructive',
      });
    } finally {
      setIsToggling(prev => ({ ...prev, [targetId]: false }));
      setIsWarnOpen(false); // Close warn dialog if open
      setTargetToToggle(null);
    }
  };

  const handleToggleTarget = (targetId: string, currentStatus: boolean, isDisabledByRateLimit: boolean) => {
    if (!currentStatus && isDisabledByRateLimit) {
      setTargetToToggle(targetId); // Store the target ID
      setIsWarnOpen(true); // Open the warning dialog
    } else {
      proceedWithToggle(targetId);
    }
  };

  // --- Edit Logic ---
  const handleOpenEditModal = (target: VertexTarget) => {
    setEditingTarget(target);
    setEditNameValue(target.name || '');
    setEditProjectIdValue(target.projectId);

    const locationExists = locationOptions.some(option => option.value === target.location);
    if (locationExists) {
      setEditLocationValue(target.location);
      setIsEditCustomLocation(false);
    } else {
      setEditLocationValue('custom');
      setEditLocationCustomValue(target.location);
      setIsEditCustomLocation(true);
    }

    setEditRateLimitValue(target.dailyRateLimit?.toString() ?? '');
    setIsEditOpen(true); // Open the edit dialog
  };

  const handleEditLocationChange = (value: string) => {
    if (value === 'custom') {
      setIsEditCustomLocation(true);
      setEditLocationValue('custom');
    } else {
      setIsEditCustomLocation(false);
      setEditLocationValue(value);
    }
  };

  const handleSaveTargetChanges = async () => {
    if (!editingTarget) return;
    setIsSavingChanges(true);

    const locationValue = isEditCustomLocation ? editLocationCustomValue.trim() : editLocationValue.trim();

    let rateLimitToSend: number | null = null;
    if (editRateLimitValue.trim() === '') {
      rateLimitToSend = null;
    } else {
      const parsedLimit = parseInt(editRateLimitValue, 10);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        toast({ title: 'Invalid Input', description: 'Daily Rate Limit must be a non-negative number or empty.', variant: 'destructive' });
        setIsSavingChanges(false);
        return;
      }
      rateLimitToSend = parsedLimit;
    }
    if (!editProjectIdValue.trim() || !locationValue) {
         toast({ title: 'Invalid Input', description: 'Project ID and Location cannot be empty.', variant: 'destructive' });
         setIsSavingChanges(false);
         return;
    }

    try {
      const bodyToSend = {
        name: editNameValue.trim() || undefined,
        projectId: editProjectIdValue.trim(),
        location: locationValue,
        dailyRateLimit: rateLimitToSend,
      };

      const response = await fetch(`/api/admin/targets/${editingTarget._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update target');
      }

      toast({
        title: 'Success',
        description: 'Vertex Target updated successfully',
        variant: "default",
      });

      setIsEditOpen(false); // Close the dialog
      fetchTargets(); // Refresh list

    } catch (error: any) {
      console.error('Error updating target:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update Vertex Target',
        variant: 'destructive',
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

  // --- Bulk Action Handlers ---
  const handleSelectTarget = (targetId: string) => {
    setSelectedTargetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(targetId)) {
        newSet.delete(targetId);
      } else {
        newSet.add(targetId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      setSelectedTargetIds(new Set(targets.map(target => target._id)));
    } else {
      setSelectedTargetIds(new Set());
    }
  };

  const isAllSelected = useMemo(() => targets.length > 0 && selectedTargetIds.size === targets.length, [selectedTargetIds, targets]);
  const selectAllCheckedState = useMemo(() => {
    if (isAllSelected) return true;
    if (selectedTargetIds.size > 0) return 'indeterminate';
    return false;
  }, [isAllSelected, selectedTargetIds.size]);


  const handleApplyBulkLimit = async () => {
    if (selectedTargetIds.size === 0) return;
    setIsApplyingBulkLimit(true);

    let rateLimitToSend: number | null = null;
    if (bulkLimitValue.trim() === '') {
        rateLimitToSend = null;
    } else {
        const parsedLimit = parseInt(bulkLimitValue, 10);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
            toast({ title: 'Invalid Input', description: 'Daily Rate Limit must be a non-negative number or empty.', variant: 'destructive' });
            setIsApplyingBulkLimit(false);
            return;
        }
        rateLimitToSend = parsedLimit;
    }

    try {
        const response = await fetch('/api/admin/targets/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'setLimit',
                targetIds: Array.from(selectedTargetIds),
                dailyRateLimit: rateLimitToSend,
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to apply bulk limit');
        }

        toast({
            title: 'Success',
            description: result.message || `Successfully updated limit for ${result.count} targets.`,
            variant: "default",
        });

        setIsBulkLimitOpen(false);
        setSelectedTargetIds(new Set());
        setBulkLimitValue('');
        fetchTargets();

    } catch (error: any) {
        console.error('Error applying bulk limit:', error);
        toast({ title: 'Error', description: error.message || 'Failed to apply bulk limit', variant: 'destructive' });
    } finally {
        setIsApplyingBulkLimit(false);
    }
  };

  const openBulkDeleteDialog = () => {
    if (selectedTargetIds.size > 0) {
        setIsBulkDeleteOpen(true);
    }
   };


  const handleBulkDelete = async () => {
    if (selectedTargetIds.size === 0) return;
    setIsDeletingBulk(true);

    try {
        const response = await fetch('/api/admin/targets/bulk', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                targetIds: Array.from(selectedTargetIds),
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to bulk delete targets');
        }

        toast({
            title: 'Success',
            description: result.message || `Successfully deleted ${result.count} targets.`,
            variant: "default",
        });

        setIsBulkDeleteOpen(false);
        setSelectedTargetIds(new Set());
        fetchTargets();

    } catch (error: any) {
        console.error('Error bulk deleting targets:', error);
        toast({ title: 'Error', description: error.message || 'Failed to bulk delete targets', variant: 'destructive' });
    } finally {
        setIsDeletingBulk(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          {/* Left side: Selection count and bulk actions */}
          <div className="flex items-center space-x-4">
            {selectedTargetIds.size > 0 && (
              <>
                <span className="text-sm font-medium">
                  {selectedTargetIds.size} selected
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsBulkLimitOpen(true)}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Set Limit
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Set Daily Limit for Selected Targets</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={openBulkDeleteDialog}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete ({selectedTargetIds.size})
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Selected Targets</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Right side: Total count and refresh */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              Total: {targets.length} targets
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] px-2">
                  <Checkbox
                    checked={selectAllCheckedState}
                    onCheckedChange={handleSelectAll}
                    disabled={targets.length === 0 || isLoading}
                    aria-label="Select all targets"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Project ID</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Daily Usage / Limit</TableHead>
                <TableHead>Requests (Total)</TableHead>
                <TableHead>Failures</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="px-2"><Checkbox disabled /></TableCell>
                      <TableCell><Skeleton className="w-24 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-32 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-5" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="w-24 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-5" /></TableCell>
                    </TableRow>
                  ))
               : !Array.isArray(targets) || targets.length === 0
               ? <TableRow><TableCell colSpan={11} className="py-4 text-center">No Vertex targets found.</TableCell></TableRow>
               : targets.map((target) => (
                    <TableRow key={target._id}>
                      <TableCell className="px-2">
                        <Checkbox
                          checked={selectedTargetIds.has(target._id)}
                          onCheckedChange={() => handleSelectTarget(target._id)}
                          aria-label={`Select target ${target.name || target._id}`}
                        />
                      </TableCell>
                      <TableCell>{target.name || <span className="italic text-muted-foreground">N/A</span>}</TableCell>
                      <TableCell>{target.projectId}</TableCell>
                      <TableCell>{target.location}</TableCell>
                      <TableCell>{getStatusBadge(target)}</TableCell>
                      <TableCell>{formatDate(target.lastUsed)}</TableCell>
                      <TableCell>{target.dailyRequestsUsed} / {(target.dailyRateLimit === null || target.dailyRateLimit === undefined) ? '∞' : target.dailyRateLimit}</TableCell>
                      <TableCell>{target.requestCount}</TableCell>
                      <TableCell>{target.failureCount}</TableCell>
                      <TableCell>
                        <Switch
                            checked={target.isActive}
                            disabled={isToggling[target._id]}
                            onCheckedChange={() => handleToggleTarget(target._id, target.isActive, target.isDisabledByRateLimit)}
                            aria-label={target.isActive ? "Disable target" : "Enable target"}
                         />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                           <Tooltip>
                            <TooltipTrigger asChild>
                              <Button aria-label="Edit target details" variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleOpenEditModal(target)}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Target Details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <Button aria-label="Delete target" variant="ghost" size="icon" className="w-8 h-8 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => openDeleteDialog(target._id)}>
                                <Trash2 className="w-4 h-4" />
                               </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Target</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              }
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>Delete Vertex Target</AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to delete this Vertex Target? This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTarget} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Target Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-[600px] bg-background"> {/* Increased width & added background */}
          <DialogHeader>
            <DialogTitle>Edit Vertex Target</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4"> {/* Changed to flex flex-col */}
            {/* Name Field */}
            <div className="grid gap-1"> {/* Stack Label and Input */}
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="(Optional)"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
              />
            </div>
            {/* Project ID Field */}
             <div className="grid gap-1"> {/* Stack Label and Input */}
              <Label htmlFor="edit-project-id">Project ID *</Label>
              <Input
                id="edit-project-id"
                placeholder="your-gcp-project-id"
                value={editProjectIdValue}
                onChange={(e) => setEditProjectIdValue(e.target.value)}
                required
              />
            </div>
            {/* Location Field */}
            <div className="grid gap-1"> {/* Stack Label and Input */}
              <Label htmlFor="edit-location">Location *</Label>
              <div> {/* Keep this div for custom location logic structure */}
                  {!isEditCustomLocation ? (
                    <Select value={editLocationValue} onValueChange={handleEditLocationChange}>
                      <SelectTrigger>
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
                    <div className="flex items-center space-x-2">
                        <Input
                            placeholder="Enter custom location (e.g., us-central1)"
                            value={editLocationCustomValue}
                            onChange={(e) => setEditLocationCustomValue(e.target.value)}
                            required
                            className="flex-grow" // Allow input to grow
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setIsEditCustomLocation(false); setEditLocationValue(''); }}
                        >
                            Back
                        </Button>
                    </div>
                  )}
                </div>
            </div>
            {/* Daily Limit Field */}
            <div className="grid gap-1"> {/* Stack Label and Input */}
              <Label htmlFor="edit-rate-limit">Daily Limit</Label>
               <Input
                id="edit-rate-limit"
                type="number"
                placeholder="Empty = no limit"
                value={editRateLimitValue}
                onChange={(e) => setEditRateLimitValue(e.target.value)}
                min="0"
              />
              <p className="text-xs text-muted-foreground">Max requests per target per day (UTC). Leave empty or set to 0 for unlimited.</p> {/* Moved helper text here */}
            </div>
          </div>
          <DialogFooter>
             <DialogClose asChild>
                <Button variant="outline" disabled={isSavingChanges}>Cancel</Button>
             </DialogClose>
            <Button onClick={handleSaveTargetChanges} disabled={isSavingChanges}>
              {isSavingChanges ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rate Limit Override Warning Dialog */}
      <AlertDialog open={isWarnOpen} onOpenChange={setIsWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>Enable Rate Limited Target?</AlertDialogHeader>
          <AlertDialogDescription>
            This Vertex Target was automatically disabled because it hit its daily request limit.
            Manually enabling it now will allow it to be used again today, potentially exceeding the intended limit.
            Are you sure you want to proceed?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetToToggle(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => targetToToggle && proceedWithToggle(targetToToggle)} className="bg-orange-600 hover:bg-orange-700">
              Enable Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Limit Setting Dialog */}
      <Dialog open={isBulkLimitOpen} onOpenChange={setIsBulkLimitOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle>Set Daily Limit for Selected ({selectedTargetIds.size}) Targets</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                   <div className="grid items-center grid-cols-4 gap-4">
                      <Label htmlFor="bulk-limit" className="text-right">New Daily Limit</Label>
                      <Input
                          id="bulk-limit"
                          type="number"
                          placeholder="Empty = no limit"
                          value={bulkLimitValue}
                          onChange={(e) => setBulkLimitValue(e.target.value)}
                          min="0"
                          className="col-span-3"
                      />
                  </div>
                   <p className="col-span-3 col-start-2 text-xs text-muted-foreground">Enter the max requests per day for the selected targets. Leave empty or set to 0 for unlimited.</p>
              </div>
              <DialogFooter>
                   <DialogClose asChild>
                        <Button variant="outline" disabled={isApplyingBulkLimit}>Cancel</Button>
                   </DialogClose>
                  <Button
                      onClick={handleApplyBulkLimit}
                      disabled={selectedTargetIds.size === 0 || isApplyingBulkLimit}
                  >
                      {isApplyingBulkLimit ? 'Applying...' : 'Apply Limit'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
              Delete Selected Vertex Targets?
            </div>
          </AlertDialogHeader>
          <AlertDialogDescription>
            Are you sure you want to permanently delete the selected <strong>{selectedTargetIds.size}</strong> Vertex Target(s)?
            This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBulk}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isDeletingBulk} className="bg-red-600 hover:bg-red-700">
              {isDeletingBulk ? 'Deleting...' : 'Delete Targets'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </TooltipProvider>
  );
}
