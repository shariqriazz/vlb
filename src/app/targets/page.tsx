'use client';

import { useState, useEffect, useRef } from 'react';
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
  Select,
  InputGroup,
  InputRightElement,
  IconButton,
  useToast,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react';
import { FiPlus, FiTarget, FiEdit } from 'react-icons/fi';
import AppLayout from '@/components/layout/AppLayout';
import TargetStats from '@/components/targets/TargetStats';
import { locationOptions, modelIdOptions } from '@/lib/constants/vertexOptions';

// Updated interface for VertexTarget
interface VertexTarget {
  _id: string;
  name?: string;
  projectId: string;
  location: string;
  // modelId: string; // Removed
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
  const [newLocationCustom, setNewLocationCustom] = useState('');
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  // Removed Model ID state
  // const [newModelId, setNewModelId] = useState('');
  // const [newModelIdCustom, setNewModelIdCustom] = useState('');
  // const [isCustomModelId, setIsCustomModelId] = useState(false);
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
      // Extract the 'targets' array from the response object
      setTargets(data.targets || []); // Update state with targets array, fallback to empty array
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
    // Get the actual location value (either from dropdown or custom input)
    const locationValue = isCustomLocation ? newLocationCustom.trim() : newLocation.trim();
    // Removed modelIdValue

    // Validation for required fields (removed modelIdValue)
    if (!newProjectId.trim() || !locationValue || !newSaKeyFile) {
      toast({
        title: 'Error',
        description: 'Project ID, Location, and Service Account Key file are required.', // Updated description
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
    formData.append('location', locationValue);
    // Removed formData.append('modelId', modelIdValue);
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
      setNewLocationCustom('');
      setIsCustomLocation(false);
      // Removed Model ID reset
      // setNewModelId('');
      // setNewModelIdCustom('');
      // setIsCustomModelId(false);
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

  // Handle location selection
  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
      setIsCustomLocation(true);
      setNewLocation('custom');
    } else {
      setIsCustomLocation(false);
      setNewLocation(value);
    }
  };

  // Removed handleModelIdChange


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
              {!isCustomLocation ? (
                <Select
                  placeholder="Select location"
                  value={newLocation}
                  onChange={handleLocationChange}
                >
                  {locationOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">Custom location...</option>
                </Select>
              ) : (
                <InputGroup>
                  <Input
                    placeholder="Enter custom location (e.g., us-central1)"
                    value={newLocationCustom}
                    onChange={(e) => setNewLocationCustom(e.target.value)}
                  />
                  <InputRightElement width="4.5rem">
                    <Button
                      h="1.75rem"
                      size="sm"
                      onClick={() => {
                        setIsCustomLocation(false);
                        setNewLocation('');
                      }}
                    >
                      Back
                    </Button>
                  </InputRightElement>
                </InputGroup>
              )}
            </FormControl>
            {/* Removed Model ID FormControl */}
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