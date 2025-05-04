'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation'; // Import useRouter for potential future use if needed
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
import { useToast } from "@/hooks/use-toast"; // Use shadcn's toast
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Plus, Target, Edit, AlertCircle } from 'lucide-react'; // Use lucide-react icons

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for Dialog open/close

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

  useEffect(() => {
    fetchTargets();
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vertex Targets</h1>
          <p className="text-muted-foreground">Manage your Vertex AI targets</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Add New Target
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] md:max-w-[600px]"> {/* Adjusted width */}
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

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="w-4 h-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48"> {/* Increased height */}
          <Loader2 className="w-8 h-8 animate-spin text-primary" /> {/* Larger spinner */}
        </div>
      ) : (
        // Assuming TargetStats is refactored or compatible
        <TargetStats targets={targets} fetchTargets={fetchTargets} isLoading={isLoading} />
      )}
    </AppLayout>
  );
}