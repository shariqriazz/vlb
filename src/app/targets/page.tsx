'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useToast,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FiPlus, FiTarget } from 'react-icons/fi'; // Added FiTarget
import AppLayout from '@/components/layout/AppLayout';
import TargetStats from '@/components/targets/TargetStats'; // Updated path and component name

// Updated interface for VertexTarget
interface VertexTarget {
  _id: string;
  name?: string;
  projectId: string;
  location: string;
  modelId: string;
  // serviceAccountKeyJson is not typically needed in the list view
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

export default function TargetsPage() { // Renamed component
  const [targets, setTargets] = useState<VertexTarget[]>([]); // Renamed state variable and type
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // State for new target form fields
  const [newName, setNewName] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newDailyRateLimit, setNewDailyRateLimit] = useState('');
  const [newSaKeyFile, setNewSaKeyFile] = useState<File | null>(null); // State for file upload

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const fetchTargets = async () => { // Renamed function
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/targets'); // Updated API endpoint
      if (!response.ok) {
        throw new Error(`Error fetching targets: ${response.statusText}`); // Updated error message
      }
      const data = await response.json();
      setTargets(data); // Update state with targets
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Vertex targets'); // Updated error message
      console.error('Error fetching targets:', err); // Updated log message
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTargets(); // Call renamed function
  }, []);

  const handleAddTarget = async () => { // Renamed function
    // Validation for required fields
    if (!newProjectId.trim() || !newLocation.trim() || !newModelId.trim() || !newSaKeyFile) {
      toast({
        title: 'Error',
        description: 'Project ID, Location, Model ID, and Service Account Key file are required.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    // Create FormData object
    const formData = new FormData();
    formData.append('name', newName.trim());
    formData.append('projectId', newProjectId.trim());
    formData.append('location', newLocation.trim());
    formData.append('modelId', newModelId.trim());
    // Append rate limit only if it's a valid number, otherwise backend handles default (null)
    const rateLimitNum = parseInt(newDailyRateLimit.trim(), 10);
    if (!isNaN(rateLimitNum) && rateLimitNum >= 0) {
        formData.append('dailyRateLimit', String(rateLimitNum));
    } else if (newDailyRateLimit.trim() === '') {
        // Explicitly sending an empty string might be interpreted as null by backend if needed
        // formData.append('dailyRateLimit', ''); // Or just don't append if backend defaults to null
    } else {
         toast({
            title: 'Error',
            description: 'Invalid Daily Rate Limit. Must be a non-negative number or empty.',
            status: 'error',
            duration: 5000,
            isClosable: true,
        });
        return; // Stop submission if rate limit is invalid
    }
    formData.append('serviceAccountKeyJson', newSaKeyFile); // Append the file

    try {
      const response = await fetch('/api/admin/targets', { // Updated API endpoint
        method: 'POST',
        body: formData, // Send FormData instead of JSON
        // No 'Content-Type' header needed, browser sets it for FormData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add Vertex target'); // Updated error message
      }

      toast({
        title: 'Success',
        description: 'Vertex target added successfully', // Updated success message
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset form state
      setNewName('');
      setNewProjectId('');
      setNewLocation('');
      setNewModelId('');
      setNewDailyRateLimit('');
      setNewSaKeyFile(null);
      // Reset file input visually (optional, might need ref)
      const fileInput = document.getElementById('sa-key-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';


      onClose();
      fetchTargets(); // Refresh the list
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add Vertex target', // Updated error message
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewSaKeyFile(event.target.files[0]);
    } else {
      setNewSaKeyFile(null);
    }
  };


  return (
    <AppLayout>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">Vertex Targets</Heading> {/* Updated title */}
          <Text color="gray.500">Manage your Vertex AI targets</Text> {/* Updated description */}
        </Box>
        <Button leftIcon={<FiPlus />} colorScheme="blue" onClick={onOpen}>
          Add New Target {/* Updated button text */}
        </Button>
      </Flex>

      {error && (
        <Alert status="error" mb={6} borderRadius="md">
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Flex justify="center" align="center" h="200px">
          <Spinner size="xl" color="blue.500" />
        </Flex>
      ) : (
        // Use TargetStats component - Assuming it's adapted to display target data
        <TargetStats targets={targets} fetchTargets={fetchTargets} isLoading={isLoading} /> // Pass isLoading prop
      )}

      {/* Add Target Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Vertex Target</ModalHeader> {/* Updated modal title */}
          <ModalCloseButton />
          <ModalBody pb={6}> {/* Add padding bottom */}
             <FormControl mb={4}> {/* Name input */}
              <FormLabel>Target Name (Optional)</FormLabel>
              <Input
                placeholder="e.g., Gemini Pro EU"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </FormControl>
             <FormControl isRequired mb={4}>
              <FormLabel>Project ID</FormLabel>
              <Input
                placeholder="your-gcp-project-id"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
              />
            </FormControl>
             <FormControl isRequired mb={4}>
              <FormLabel>Location</FormLabel>
              <Input
                placeholder="us-central1"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
              />
            </FormControl>
             <FormControl isRequired mb={4}>
              <FormLabel>Model ID</FormLabel>
              <Input
                placeholder="gemini-2.5-pro-exp-03-25"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
              />
            </FormControl>
             <FormControl isRequired mb={4}>
              <FormLabel>Service Account Key (JSON)</FormLabel>
              <Input
                id="sa-key-file-input" // Added ID for potential reset
                type="file"
                accept=".json"
                onChange={handleFileChange}
                p={1} // Add some padding for file input
              />
              {newSaKeyFile && <Text fontSize="sm" mt={1} color="gray.600">Selected: {newSaKeyFile.name}</Text>}
            </FormControl>
            <FormControl> {/* Daily Rate Limit input */}
              <FormLabel>Daily Rate Limit (Optional)</FormLabel>
              <Input
                type="number"
                placeholder="e.g., 1000 (leave empty for no limit)"
                value={newDailyRateLimit}
                onChange={(e) => setNewDailyRateLimit(e.target.value)}
                min="0"
              />
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleAddTarget}> {/* Call renamed handler */}
              Add Target {/* Updated button text */}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </AppLayout>
  );
}