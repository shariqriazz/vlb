'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Skeleton,
  Text,
  useColorModeValue,
  Flex,
  Button,
  IconButton,
  Tooltip,
  HStack,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Switch,
  // Add NumberInput components
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  // Add Checkbox
  Checkbox,
} from '@chakra-ui/react';
import { FiRefreshCw, FiTrash2, FiEdit2, FiSettings, FiAlertTriangle, FiTarget } from 'react-icons/fi'; // Added FiTarget
import { useRef, useMemo } from 'react'; // Add useMemo
// Import modal components for editing
import {
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
} from '@chakra-ui/react';

// Updated interface for VertexTarget (matching TargetsPage)
interface VertexTarget {
  _id: string;
  name?: string;
  projectId: string;
  location: string;
  modelId: string;
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


export default function TargetStats({ targets: initialTargets, fetchTargets, isLoading: parentIsLoading }: TargetStatsProps) { // Renamed component and added props
  // Use props for initial state and loading indicator
  const [targets, setTargets] = useState<VertexTarget[]>(initialTargets);
  const [isLoading, setIsLoading] = useState(parentIsLoading); // Use parent loading state initially
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null); // Renamed state
  const [isToggling, setIsToggling] = useState<{[key: string]: boolean}>({});
  // State for Delete confirmation
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRefDelete = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  // State for Rate Limit Override confirmation
  const { isOpen: isWarnOpen, onOpen: onWarnOpen, onClose: onWarnClose } = useDisclosure();
  const cancelRefWarn = useRef<HTMLButtonElement>(null);
  const [targetToToggle, setTargetToToggle] = useState<string | null>(null); // Renamed state

  // State for Edit modal
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editingTarget, setEditingTarget] = useState<VertexTarget | null>(null); // Renamed state
  const [editNameValue, setEditNameValue] = useState('');
  const [editProjectIdValue, setEditProjectIdValue] = useState(''); // Added state
  const [editLocationValue, setEditLocationValue] = useState('');   // Added state
  const [editModelIdValue, setEditModelIdValue] = useState('');     // Added state
  const [editRateLimitValue, setEditRateLimitValue] = useState<string>('');
  const [isSavingChanges, setIsSavingChanges] = useState(false);

  // State for bulk selection
  const [selectedTargetIds, setSelectedTargetIds] = useState<Set<string>>(new Set()); // Renamed state

  // State for Bulk Limit Modal
  const { isOpen: isBulkLimitOpen, onOpen: onBulkLimitOpen, onClose: onBulkLimitClose } = useDisclosure();
  const [bulkLimitValue, setBulkLimitValue] = useState<string>('');
  const [isApplyingBulkLimit, setIsApplyingBulkLimit] = useState(false);

  // State for Bulk Delete Modal
  const { isOpen: isBulkDeleteOpen, onOpen: onBulkDeleteOpen, onClose: onBulkDeleteClose } = useDisclosure();
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const cancelRefBulkDelete = useRef<HTMLButtonElement>(null);
  const tableBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

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

  // Function to get status badge (logic remains similar)
  const getStatusBadge = (target: VertexTarget) => { // Updated parameter type
    if (!target.isActive) {
      return <Badge colorScheme="gray">Disabled</Badge>;
    }
    if (target.isDisabledByRateLimit) {
      return <Badge colorScheme="orange">Daily Limited</Badge>;
    }
    if (target.rateLimitResetAt && new Date(target.rateLimitResetAt) > new Date()) {
      return <Badge colorScheme="yellow">Rate Limited</Badge>;
    }
    return <Badge colorScheme="green">Active</Badge>;
  };

  // Function to format date (no change needed)
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Function to delete a target
  const handleDeleteTarget = async () => { // Renamed function
    if (!selectedTargetId) return;

    try {
      const response = await fetch(`/api/admin/targets/${selectedTargetId}`, { // Updated endpoint
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete target'); // Updated error message
      }

      toast({
        title: 'Success',
        description: 'Vertex Target deleted successfully', // Updated message
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh the list using the prop function
      fetchTargets();
    } catch (error) {
      console.error('Error deleting target:', error); // Updated log message
      toast({
        title: 'Error',
        description: 'Failed to delete Vertex Target', // Updated message
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      onDeleteClose();
      setSelectedTargetId(null); // Clear selected target ID
    }
  };

  // Extracted API call logic for toggling
  const proceedWithToggle = async (targetId: string) => { // Renamed parameter
    setIsToggling(prev => ({ ...prev, [targetId]: true }));
    let success = false;
    try {
      const response = await fetch(`/api/admin/targets/${targetId}`, { // Updated endpoint
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to update target status'); // Updated error message
      }

      const data = await response.json();
      success = true;

      toast({
        title: 'Success',
        description: `Vertex Target status updated successfully.`, // Updated message
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Refresh the list
      fetchTargets();

    } catch (error) {
      console.error('Error toggling target status:', error); // Updated log message
      toast({
        title: 'Error',
        description: 'Failed to update Vertex Target status', // Updated message
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsToggling(prev => ({ ...prev, [targetId]: false }));
      onWarnClose();
      setTargetToToggle(null); // Clear the target ID
    }
  };

  // Function to handle the toggle action, potentially showing a warning
  const handleToggleTarget = (targetId: string, currentStatus: boolean, isDisabledByRateLimit: boolean) => { // Renamed function and parameter
    if (!currentStatus && isDisabledByRateLimit) {
      setTargetToToggle(targetId); // Store the target ID
      onWarnOpen();
    } else {
      proceedWithToggle(targetId);
    }
  };

  // Function to handle opening the edit modal
  const handleOpenEditModal = (target: VertexTarget) => { // Renamed parameter
    setEditingTarget(target); // Renamed state
    setEditNameValue(target.name || '');
    setEditProjectIdValue(target.projectId); // Set new state
    setEditLocationValue(target.location);   // Set new state
    setEditModelIdValue(target.modelId);     // Set new state
    setEditRateLimitValue(target.dailyRateLimit?.toString() ?? '');
    onEditOpen();
  };

  // Function to save the edited changes
  const handleSaveTargetChanges = async () => { // Renamed function
    if (!editingTarget) return;
    setIsSavingChanges(true);

    // --- Input Validation ---
    let rateLimitToSend: number | null = null;
    if (editRateLimitValue.trim() === '') {
      rateLimitToSend = null;
    } else {
      const parsedLimit = parseInt(editRateLimitValue, 10);
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        toast({ title: 'Invalid Input', description: 'Daily Rate Limit must be a non-negative number or empty.', status: 'error', duration: 4000, isClosable: true });
        setIsSavingChanges(false);
        return;
      }
      rateLimitToSend = parsedLimit;
    }
    // Validate new fields
    if (!editProjectIdValue.trim() || !editLocationValue.trim() || !editModelIdValue.trim()) {
         toast({ title: 'Invalid Input', description: 'Project ID, Location, and Model ID cannot be empty.', status: 'error', duration: 4000, isClosable: true });
         setIsSavingChanges(false);
         return;
    }
    // --- End Validation ---

    try {
      const bodyToSend = {
        name: editNameValue.trim() || undefined,
        projectId: editProjectIdValue.trim(), // Add new field
        location: editLocationValue.trim(),   // Add new field
        modelId: editModelIdValue.trim(),     // Add new field
        dailyRateLimit: rateLimitToSend,
        // SA Key JSON is NOT updated via this PUT request
      };

      const response = await fetch(`/api/admin/targets/${editingTarget._id}`, { // Updated endpoint
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update target'); // Updated error message
      }

      toast({
        title: 'Success',
        description: 'Vertex Target updated successfully', // Updated message
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onEditClose();
      fetchTargets(); // Refresh list

    } catch (error: any) {
      console.error('Error updating target:', error); // Updated log message
      toast({
        title: 'Error',
        description: error.message || 'Failed to update Vertex Target', // Updated message
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSavingChanges(false);
    }
  };

// --- Bulk Action Handlers ---

const handleSelectTarget = (targetId: string, isSelected: boolean) => { // Renamed function and parameter
  setSelectedTargetIds(prev => { // Renamed state
    const newSet = new Set(prev);
    if (isSelected) {
      newSet.add(targetId);
    } else {
      newSet.delete(targetId);
    }
    return newSet;
  });
};

const handleSelectAll = (isSelected: boolean) => {
  if (isSelected) {
    setSelectedTargetIds(new Set(targets.map(target => target._id))); // Use targets state
  } else {
    setSelectedTargetIds(new Set()); // Renamed state
  }
};

// Memoize values for "select all" checkbox state
const isAllSelected = useMemo(() => targets.length > 0 && selectedTargetIds.size === targets.length, [selectedTargetIds, targets]); // Use targets state
const isIndeterminate = useMemo(() => selectedTargetIds.size > 0 && selectedTargetIds.size < targets.length, [selectedTargetIds, targets]); // Use targets state

const handleApplyBulkLimit = async () => {
    if (selectedTargetIds.size === 0) return; // Use renamed state
    setIsApplyingBulkLimit(true);

    // --- Input Validation (remains same) ---
    let rateLimitToSend: number | null = null;
    if (bulkLimitValue.trim() === '') {
        rateLimitToSend = null;
    } else {
        const parsedLimit = parseInt(bulkLimitValue, 10);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
            toast({ title: 'Invalid Input', description: 'Daily Rate Limit must be a non-negative number or empty.', status: 'error', duration: 4000, isClosable: true });
            setIsApplyingBulkLimit(false);
            return;
        }
        rateLimitToSend = parsedLimit;
    }
    // --- End Validation ---

    try {
        const response = await fetch('/api/admin/targets/bulk', { // Updated endpoint
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'setLimit',
                targetIds: Array.from(selectedTargetIds), // Use renamed state
                dailyRateLimit: rateLimitToSend, // Use correct field name from backend
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to apply bulk limit');
        }

        toast({
            title: 'Success',
            description: result.message || `Successfully updated limit for ${result.count} targets.`, // Updated message
            status: 'success',
            duration: 3000,
            isClosable: true,
        });

        onBulkLimitClose();
        setSelectedTargetIds(new Set()); // Clear selection (renamed state)
        setBulkLimitValue('');
        fetchTargets(); // Refresh list

    } catch (error: any) {
        console.error('Error applying bulk limit:', error);
        toast({ title: 'Error', description: error.message || 'Failed to apply bulk limit', status: 'error', duration: 5000, isClosable: true });
    } finally {
        setIsApplyingBulkLimit(false);
    }
};

const handleBulkDelete = async () => {
    if (selectedTargetIds.size === 0) return; // Use renamed state
    setIsDeletingBulk(true);

    try {
        const response = await fetch('/api/admin/targets/bulk', { // Updated endpoint
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                targetIds: Array.from(selectedTargetIds), // Use renamed state
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to bulk delete targets'); // Updated message
        }

        toast({
            title: 'Success',
            description: result.message || `Successfully deleted ${result.count} targets.`, // Updated message
            status: 'success',
            duration: 3000,
            isClosable: true,
        });

        onBulkDeleteClose();
        setSelectedTargetIds(new Set()); // Clear selection (renamed state)
        fetchTargets(); // Refresh list

    } catch (error: any) {
        console.error('Error bulk deleting targets:', error); // Updated log message
        toast({ title: 'Error', description: error.message || 'Failed to bulk delete targets', status: 'error', duration: 5000, isClosable: true }); // Updated message
    } finally {
        setIsDeletingBulk(false);
    }
};


// --- End Bulk Action Handlers ---


return (
  <Box>
    <Flex justify="space-between" align="center" mb={4}>
      {/* Left side: Selection count and bulk actions */}
      <HStack spacing={4}>
         {selectedTargetIds.size > 0 && ( // Use renamed state
           <>
             <Text fontSize="sm" fontWeight="medium">
               {selectedTargetIds.size} selected {/* Use renamed state */}
             </Text>
             <Tooltip label="Set Daily Limit for Selected Targets"> {/* Updated label */}
               <Button
                 size="sm"
                 leftIcon={<FiSettings />}
                 colorScheme="teal"
                 variant="outline"
                 onClick={onBulkLimitOpen}
               >
                 Set Limit
               </Button>
             </Tooltip>
             <Tooltip label="Delete Selected Targets"> {/* Updated label */}
               <Button
                 size="sm"
                 leftIcon={<FiTrash2 />}
                 colorScheme="red"
                 variant="outline"
                 onClick={onBulkDeleteOpen}
               >
                 Delete ({selectedTargetIds.size}) {/* Use renamed state */}
               </Button>
             </Tooltip>
           </>
         )}
      </HStack>

      {/* Right side: Total count and refresh */}
      <HStack spacing={4}>
         <Text fontSize="sm" color="gray.500">
           Total: {targets.length} targets {/* Use targets state, updated text */}
         </Text>
         <Button
           size="sm"
           leftIcon={<FiRefreshCw />}
           onClick={refreshData}
           isLoading={isLoading} // Use local loading state (synced with prop)
         >
           Refresh
         </Button>
      </HStack>
    </Flex>

      <Box overflowX="auto">
        <Table variant="simple" size="sm" bg={tableBg} borderWidth="1px" borderColor={borderColor} borderRadius="md">
          <Thead>
             <Tr>
               <Th paddingRight={2}>
                 <Checkbox
                   isChecked={isAllSelected}
                   isIndeterminate={isIndeterminate}
                   onChange={(e) => handleSelectAll(e.target.checked)}
                   isDisabled={targets.length === 0} // Use targets state
                 />
               </Th>
               <Th>Name</Th>
               <Th>Project ID</Th> {/* Updated Header */}
               <Th>Location</Th> {/* Updated Header */}
               <Th>Model ID</Th> {/* Updated Header */}
               <Th>Status</Th>
               <Th>Last Used</Th>
               <Th>Daily Usage / Limit</Th>
               <Th>Requests (Total)</Th>
               <Th>Failures</Th>
               <Th>Enabled</Th>
               <Th>Actions</Th>
             </Tr>
           </Thead>
          <Tbody>
            {/* Conditional Rendering Logic */}
            {isLoading
              ? /* Skeleton Loading State */
                Array.from({ length: 3 }).map((_, index) => (
                  <Tr key={`skeleton-${index}`}>
                    <Td paddingRight={2}><Checkbox isDisabled /></Td>
                    <Td><Skeleton height="20px" width="100px" /></Td>
                    <Td><Skeleton height="20px" width="120px" /></Td> {/* Adjusted width */}
                    <Td><Skeleton height="20px" width="80px" /></Td> {/* Adjusted width */}
                    <Td><Skeleton height="20px" width="150px" /></Td> {/* Adjusted width */}
                    <Td><Skeleton height="20px" width="80px" /></Td>
                    <Td><Skeleton height="20px" width="150px" /></Td>
                    <Td><Skeleton height="20px" width="100px" /></Td>
                    <Td><Skeleton height="20px" width="60px" /></Td>
                    <Td><Skeleton height="20px" width="60px" /></Td>
                    <Td><Skeleton height="20px" width="60px" /></Td>
                    <Td><Skeleton height="20px" width="100px" /></Td>
                  </Tr>
                ))
              : targets.length === 0 // Use targets state
              ? /* No Targets State */
                <Tr>
                  <Td colSpan={12} textAlign="center" py={4}> {/* Updated colSpan */}
                    No Vertex targets found. Add a target to get started. {/* Updated text */}
                  </Td>
                </Tr>
              : /* Targets Available State */
                targets.map((target) => ( // Use targets state, rename variable
                  <Tr key={target._id}>
                    <Td paddingRight={2}>
                      <Checkbox
                        isChecked={selectedTargetIds.has(target._id)} // Use renamed state
                        onChange={(e) => handleSelectTarget(target._id, e.target.checked)} // Use renamed handler
                      />
                    </Td>
                    <Td>{target.name || <Text as="i" color="gray.500">N/A</Text>}</Td>
                    <Td>{target.projectId}</Td> {/* Display Project ID */}
                    <Td>{target.location}</Td> {/* Display Location */}
                    <Td>{target.modelId}</Td> {/* Display Model ID */}
                    <Td>{getStatusBadge(target)}</Td>
                    <Td>{formatDate(target.lastUsed)}</Td>
                    <Td>{target.dailyRequestsUsed} / {(target.dailyRateLimit === null || target.dailyRateLimit === undefined) ? '∞' : target.dailyRateLimit}</Td>
                    <Td>{target.requestCount}</Td>
                    <Td>{target.failureCount}</Td>
                    <Td><Switch isChecked={target.isActive} isDisabled={isToggling[target._id]} onChange={() => handleToggleTarget(target._id, target.isActive, target.isDisabledByRateLimit)} size="sm" /></Td> {/* Use renamed handler */}
                    <Td>
                      <HStack spacing={2}>
                        <Tooltip label="Edit Target Details"> {/* Updated label */}
                          <IconButton aria-label="Edit target details" icon={<FiEdit2 />} size="sm" variant="ghost" colorScheme="blue" onClick={() => handleOpenEditModal(target)} /> {/* Use renamed handler */}
                        </Tooltip>
                        <Tooltip label="Delete Target"> {/* Updated label */}
                          <IconButton aria-label="Delete target" icon={<FiTrash2 />} size="sm" variant="ghost" colorScheme="red" onClick={() => { setSelectedTargetId(target._id); onDeleteOpen(); }} /> {/* Use renamed state */}
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))
            }
            {/* End of Conditional Rendering */}
          </Tbody>
        </Table>
      </Box>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRefDelete}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Vertex Target {/* Updated title */}
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this Vertex Target? This action cannot be undone. {/* Updated text */}
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRefDelete} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDeleteTarget} ml={3}> {/* Use renamed handler */}
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Edit Target Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Vertex Target</ModalHeader> {/* Updated title */}
          <ModalCloseButton />
          <ModalBody pb={6}> {/* Add padding */}
            <FormControl mb={4}> {/* Name */}
              <FormLabel>Target Name</FormLabel>
              <Input
                placeholder="Enter a name for this target"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                Optional name to help identify the target.
              </Text>
            </FormControl>

             <FormControl isRequired mb={4}> {/* Project ID */}
              <FormLabel>Project ID</FormLabel>
              <Input
                placeholder="your-gcp-project-id"
                value={editProjectIdValue}
                onChange={(e) => setEditProjectIdValue(e.target.value)}
              />
            </FormControl>

             <FormControl isRequired mb={4}> {/* Location */}
              <FormLabel>Location</FormLabel>
              <Input
                placeholder="us-central1"
                value={editLocationValue}
                onChange={(e) => setEditLocationValue(e.target.value)}
              />
            </FormControl>

             <FormControl isRequired mb={4}> {/* Model ID */}
              <FormLabel>Model ID</FormLabel>
              <Input
                placeholder="gemini-2.5-pro-exp-03-25"
                value={editModelIdValue}
                onChange={(e) => setEditModelIdValue(e.target.value)}
              />
            </FormControl>

            {/* Daily Rate Limit Input */}
            <FormControl>
              <FormLabel>Daily Rate Limit (Requests)</FormLabel>
              <NumberInput
                value={editRateLimitValue}
                onChange={(valueAsString) => setEditRateLimitValue(valueAsString)}
                min={0}
                allowMouseWheel
              >
                <NumberInputField placeholder="Leave empty for no limit" />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Max requests per target per day (UTC). Leave empty or set to 0 for unlimited. {/* Updated text */}
              </Text>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSaveTargetChanges} // Use renamed handler
              isLoading={isSavingChanges}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Rate Limit Override Warning Dialog */}
      <AlertDialog
        isOpen={isWarnOpen}
        leastDestructiveRef={cancelRefWarn}
        onClose={() => { onWarnClose(); setTargetToToggle(null); }} // Use renamed state
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Enable Rate Limited Target? {/* Updated title */}
            </AlertDialogHeader>

            <AlertDialogBody>
              This Vertex Target was automatically disabled because it hit its daily request limit. {/* Updated text */}
              Manually enabling it now will allow it to be used again today, potentially exceeding the intended limit.
              Are you sure you want to proceed?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRefWarn} onClick={() => { onWarnClose(); setTargetToToggle(null); }}> {/* Use renamed state */}
                Cancel
              </Button>
              <Button colorScheme="orange" onClick={() => targetToToggle && proceedWithToggle(targetToToggle)} ml={3}> {/* Use renamed state */}
                Enable Anyway
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Bulk Limit Setting Modal */}
      <Modal isOpen={isBulkLimitOpen} onClose={onBulkLimitClose}>
          <ModalOverlay />
          <ModalContent>
              <ModalHeader>Set Daily Limit for Selected Targets ({selectedTargetIds.size})</ModalHeader> {/* Updated title */}
              <ModalCloseButton />
              <ModalBody>
                  <FormControl isRequired>
                      <FormLabel>New Daily Rate Limit</FormLabel>
                      <NumberInput
                          value={bulkLimitValue}
                          onChange={(valueAsString) => setBulkLimitValue(valueAsString)}
                          min={0}
                          allowMouseWheel
                      >
                          <NumberInputField placeholder="Leave empty for no limit" />
                          <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                          </NumberInputStepper>
                      </NumberInput>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                          Enter the maximum requests per day for the selected targets. Leave empty or set to 0 for unlimited. {/* Updated text */}
                      </Text>
                  </FormControl>
              </ModalBody>
              <ModalFooter>
                  <Button variant="ghost" mr={3} onClick={onBulkLimitClose} isDisabled={isApplyingBulkLimit}>
                      Cancel
                  </Button>
                  <Button
                      colorScheme="teal"
                      onClick={handleApplyBulkLimit}
                      isLoading={isApplyingBulkLimit}
                      isDisabled={selectedTargetIds.size === 0} // Use renamed state
                  >
                      Apply Limit
                  </Button>
              </ModalFooter>
          </ModalContent>
      </Modal>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isBulkDeleteOpen}
        leastDestructiveRef={cancelRefBulkDelete}
        onClose={onBulkDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              <Flex align="center">
                <Box as={FiAlertTriangle} color="red.500" mr={2} />
                Delete Selected Vertex Targets? {/* Updated title */}
              </Flex>
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to permanently delete the selected <strong>{selectedTargetIds.size}</strong> Vertex Target(s)? {/* Updated text */}
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRefBulkDelete} onClick={onBulkDeleteClose} isDisabled={isDeletingBulk}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleBulkDelete}
                ml={3}
                isLoading={isDeletingBulk}
              >
                Delete Targets {/* Updated button text */}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

    </Box>
  );
}
