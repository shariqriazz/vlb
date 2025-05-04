'use client';

import { useState, useEffect } from 'react';
import { 
  Box, 
  Heading, 
  Text, 
  Stat, 
  StatLabel, 
  StatNumber, 
  StatHelpText, 
  Card, 
  CardHeader, 
  CardBody,
  SimpleGrid,
  Icon,
  Flex,
  useColorModeValue,
  Tooltip,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast
} from '@chakra-ui/react';
// Added FiTarget to imports
import { FiKey, FiActivity, FiCpu, FiAlertCircle, FiRefreshCw, FiTarget } from 'react-icons/fi';
import AppLayout from '@/components/layout/AppLayout';
import TargetStats from '@/components/targets/TargetStats';

// Define the interface for VertexTarget (can be moved to a shared types file later)
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

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<VertexTarget[]>([]); // State for targets
  // Update state structure to reflect target-based stats
  const [stats, setStats] = useState({
    totalTargets: 0,
    activeTargets: 0,
    totalRequests: 0, // Lifetime total from DB (sum of target request counts)
    totalRequestsToday: 0, // Since midnight from DB (sum of target daily counts)
    totalRequests24h: 0, // Last 24h from logs
    targetErrorRate: 0, // Use target errors
    avgResponseTime: 0 // Added avg response time
  });

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const toast = useToast();

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch targets and stats concurrently
      const [targetsResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/targets'), // Fetch targets
        fetch('/api/stats?timeRange=24h') // Fetch 24h stats
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
      // Use lifetime totals from stats API (which sums target counts)
      const totalRequests = statsData.totalRequests || 0;
      const totalRequestsToday = statsData.totalRequestsToday || 0;
      const totalRequests24h = statsData.totalRequests24h || 0; // Last 24h from logs
      const targetErrors24h = statsData.targetErrors || 0; // Target errors from logs (last 24h)
      const avgResponseTime = statsData.avgResponseTime || 0;

      // Calculate target error rate based on 24h requests
      const targetErrorRate = totalRequests24h > 0
        ? ((targetErrors24h / totalRequests24h) * 100).toFixed(1)
        : '0.0';

      setStats({
        totalTargets,
        activeTargets,
        totalRequests, // Lifetime
        totalRequestsToday, // Since midnight
        totalRequests24h, // Last 24h
        targetErrorRate: parseFloat(targetErrorRate),
        avgResponseTime
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      setError(err.message || 'Failed to fetch dashboard data');
      toast({
        title: 'Error',
        description: err.message || 'Failed to fetch dashboard data',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <AppLayout>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">Dashboard</Heading>
          <Text color="gray.500">Overview of your Load Balancer</Text>
        </Box>
        <Tooltip label="Refresh Dashboard">
          <IconButton
            aria-label="Refresh dashboard"
            icon={<FiRefreshCw />}
            onClick={fetchStats}
            isLoading={isLoading}
          />
        </Tooltip>
      </Flex>

      {error && (
        <Alert status="error" mb={6} borderRadius="md">
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 6 }} spacing={6} mb={8}> {/* Adjusted grid columns */}
        <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
          <CardBody>
            <Flex align="center" mb={2}>
              {/* Update Icon and Label */}
              <Icon as={FiTarget} boxSize={6} color="blue.500" mr={2} />
              <Stat>
                <StatLabel>Total Targets</StatLabel>
                {/* Use totalTargets */}
                <StatNumber>{isLoading ? '-' : stats.totalTargets}</StatNumber>
                {/* Update help text */}
                <StatHelpText>Vertex AI Targets Configured</StatHelpText>
              </Stat>
            </Flex>
          </CardBody>
        </Card>

        <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
          <CardBody>
            <Flex align="center" mb={2}>
              <Icon as={FiActivity} boxSize={6} color="green.500" mr={2} />
              <Stat>
                {/* Update Label */}
                <StatLabel>Active Targets</StatLabel>
                {/* Use activeTargets */}
                <StatNumber>{isLoading ? '-' : stats.activeTargets}</StatNumber>
                <StatHelpText>Ready for Use</StatHelpText>
              </Stat>
            </Flex>
          </CardBody>
        </Card>
{/* New Card for Total Requests (Last 24 Hours) */}
<Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
  <CardBody>
    <Flex align="center" mb={2}>
      <Icon as={FiCpu} boxSize={6} color="cyan.500" mr={2} /> {/* Different color */}
      <Stat>
        <StatLabel>Total Requests (24h)</StatLabel>
        <StatNumber>{isLoading ? '-' : stats.totalRequests24h}</StatNumber>
        <StatHelpText>Last 24 Hours (Logs)</StatHelpText>
      </Stat>
    </Flex>
  </CardBody>
</Card>

        {/* New Card for Total Requests Today */}
        <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
          <CardBody>
            <Flex align="center" mb={2}>
              <Icon as={FiCpu} boxSize={6} color="teal.500" mr={2} /> {/* Different color/icon? */}
              <Stat>
                <StatLabel>Total Requests (Today)</StatLabel>
                <StatNumber>{isLoading ? '-' : stats.totalRequestsToday}</StatNumber>
                <StatHelpText>Since Midnight (DB)</StatHelpText>
              </Stat>
            </Flex>
          </CardBody>
        </Card>
{/* Card for Total Requests (Lifetime) - Updated Label */}
<Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
  <CardBody>
    <Flex align="center" mb={2}>
      <Icon as={FiCpu} boxSize={6} color="purple.500" mr={2} />
      <Stat>
        <StatLabel>Total Requests (Lifetime)</StatLabel>
        <StatNumber>{isLoading ? '-' : stats.totalRequests}</StatNumber>
        <StatHelpText>All Time (DB)</StatHelpText>
      </Stat>
    </Flex>
  </CardBody>
</Card>

<Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm">
  <CardBody>
    <Flex align="center" mb={2}>
      <Icon as={FiAlertCircle} boxSize={6} color="orange.500" mr={2} />
      <Stat>
        {/* Update Label */}
        <StatLabel>Target Error Rate</StatLabel>
        {/* Use targetErrorRate */}
        <StatNumber>{isLoading ? '-' : `${stats.targetErrorRate}%`}</StatNumber>
        <StatHelpText>Last 24 Hours (Logs)</StatHelpText>
      </Stat>
    </Flex>
  </CardBody>
</Card>
</SimpleGrid>

      <Card bg={bgColor} borderWidth="1px" borderColor={borderColor} borderRadius="lg" shadow="sm" mb={8}>
        <CardHeader>
          {/* Update Heading */}
          <Heading size="md">Target Performance</Heading>
        </CardHeader>
        <CardBody>
          <TargetStats targets={targets} fetchTargets={fetchStats} isLoading={isLoading} />
        </CardBody>
      </Card>
    </AppLayout>
  );
}