"use client";

import { useState, useEffect, useMemo } from "react"; // Added useMemo
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz'; // Corrected function name based on TS error
import {
  Box,
  Heading,
  Text,
  Flex,
  Select,
  FormControl,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  useToast,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { FiRefreshCw } from "react-icons/fi";
import AppLayout from "@/components/layout/AppLayout";

// --- Timezone Formatting Helper ---
const formatInTimeZone = (dateInput: string | Date, tz: string, fmt: string): string => {
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    const zonedDate = toZonedTime(date, tz); // Corrected function name based on TS error
    return format(zonedDate, fmt);
  } catch (e) {
    console.error("Error formatting date:", e);
    // Fallback to ISO string part if formatting fails
    return typeof dateInput === 'string' ? dateInput.substring(0, 10) : 'Invalid Date';
  }
};
// --- End Timezone Formatting Helper ---


export default function StatsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [userTimeZone, setUserTimeZone] = useState<string>('UTC'); // State for user timezone, default UTC

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const lineColor = useColorModeValue("#3182CE", "#63B3ED");
  const errorColor = useColorModeValue("#E53E3E", "#FC8181");
  const toast = useToast();
  const axisTickColor = useColorModeValue("gray.700", "#FFFFFF");

  // Colors for pie charts
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
  ];

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/stats?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error(`Error fetching statistics: ${response.statusText}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch statistics");
      console.error("Error fetching stats:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to fetch statistics",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Get user's timezone on component mount
    setUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    fetchStats();
  }, [timeRange]); // fetchStats dependency removed as it causes infinite loop if not memoized

  // Custom tooltip formatter for charts
  const formatTooltipValue = (value: number) => {
    return value.toLocaleString();
  };

  // Format percentage for display
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // --- Memoized Formatted Data ---
  const formattedRequestData = useMemo(() => {
    if (!stats?.requestData) return [];
    const formatString = timeRange === '24h' ? 'HH:mm' : 'yyyy-MM-dd';
    return stats.requestData.map((item: any) => ({
      ...item,
      localTimeLabel: formatInTimeZone(item.name, userTimeZone, formatString), // Use original 'name' (date string)
      originalUtcTime: item.name // Keep original UTC time if needed for tooltip
    }));
  }, [stats?.requestData, userTimeZone, timeRange]);

  const formattedHourlyData = useMemo(() => {
    if (!stats?.hourlyData) return [];
    return stats.hourlyData.map((item: any) => ({
      ...item,
      localTimeLabel: formatInTimeZone(item.hour, userTimeZone, 'HH:mm'), // Use 'hour' (ISO string)
      originalUtcTime: item.hour // Keep original UTC time if needed for tooltip
    }));
  }, [stats?.hourlyData, userTimeZone]);
  // --- End Memoized Formatted Data ---


  return (
    <AppLayout>
      <Flex justify="space-between" align="center" mb={6}>
        <Box>
          <Heading size="lg">Usage Statistics</Heading>
          <Text color="gray.500">Monitor your API usage</Text>
        </Box>

        <Flex gap={2} align="center">
          <FormControl w="200px">
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </Select>
          </FormControl>
          <Tooltip label="Refresh Statistics">
            <IconButton
              aria-label="Refresh statistics"
              icon={<FiRefreshCw />}
              onClick={fetchStats}
              isLoading={isLoading}
            />
          </Tooltip>
        </Flex>
      </Flex>

      {error && (
        <Alert status="error" mb={6} borderRadius="md">
          <AlertIcon />
          <AlertTitle>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Flex justify="center" align="center" h="400px">
          <Spinner size="xl" color="blue.500" />
        </Flex>
      ) : stats ? (
        <>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={6}>
            <Card
              bg={cardBg}
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="lg"
              shadow="sm"
            >
              <CardBody>
                <Stat>
                  <StatLabel>Total Requests</StatLabel>
                  <StatNumber>
                    {stats.totalRequests.toLocaleString()}
                  </StatNumber>
                  <StatHelpText>Lifetime total</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card
              bg={cardBg}
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="lg"
              shadow="sm"
            >
              <CardBody>
                <Stat>
                  <StatLabel>Success Rate</StatLabel>
                  <StatNumber>
                    {formatPercentage(stats.successRate)}
                  </StatNumber>
                  <StatHelpText>In selected period</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card
              bg={cardBg}
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="lg"
              shadow="sm"
            >
              <CardBody>
                <Stat>
                  <StatLabel>Avg Response Time</StatLabel>
                  <StatNumber>{Math.round(stats.avgResponseTime)}ms</StatNumber>
                  <StatHelpText>Across successful requests</StatHelpText>
                </Stat>
              </CardBody>
            </Card>

            <Card
              bg={cardBg}
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="lg"
              shadow="sm"
            >
              <CardBody>
                <Stat>
                  <StatLabel>Active Targets</StatLabel>
                  <StatNumber>{stats.activeTargets}</StatNumber>
                  <StatHelpText>Currently in rotation</StatHelpText>
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>

          <Tabs variant="enclosed" colorScheme="blue" mb={6}>
            <TabList>
              <Tab>Request Volume</Tab>
              <Tab>Target Usage</Tab>
              <Tab>Model Usage</Tab>
              <Tab>Hourly Breakdown</Tab>
            </TabList>

            <TabPanels>
              <TabPanel p={0} pt={4}>
                <Card
                  bg={cardBg}
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="lg"
                  shadow="sm"
                >
                  <CardHeader>
                    <Heading size="md">Request Volume Over Time</Heading>
                  </CardHeader>
                  <Divider />
                  <CardBody>
                    <Box h="400px">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={formattedRequestData} // Use formatted data
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 25, // Reverted bottom margin
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="localTimeLabel" // Use formatted label
                            tick={{ fill: axisTickColor }}
                            angle={-45}
                            textAnchor="end"
                            height={100} // Increased XAxis height
                          />
                          <YAxis tick={{ fill: axisTickColor }} />
                          <RechartsTooltip
                            formatter={(value: number, name: string, props: any) => {
                                // Display local time in tooltip label if available
                                const label = props.payload?.localTimeLabel || props.label;
                                return [formatTooltipValue(value), name, label];
                            }}
                            labelFormatter={(label: string, payload: any[]) => {
                                // Attempt to show local time as the main label in tooltip
                                const entry = payload?.[0]?.payload;
                                return entry?.localTimeLabel || label;
                            }}
                            contentStyle={{
                              backgroundColor: cardBg,
                              borderColor: borderColor,
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="requests"
                            name="Requests"
                            stroke={lineColor}
                            activeDot={{ r: 8 }}
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="errors"
                            name="Errors"
                            stroke={errorColor}
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="targetErrors"
                            name="Target Errors"
                            stroke="#FF8C00"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardBody>
                </Card>
              </TabPanel>

              <TabPanel p={0} pt={4}>
                <Card
                  bg={cardBg}
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="lg"
                  shadow="sm"
                >
                  <CardHeader>
                    <Heading size="md">Target Usage Distribution</Heading>
                  </CardHeader>
                  <Divider />
                  <CardBody>
                    <Box h="400px">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.targetUsageData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            outerRadius={150}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }) =>
                              `${name}: ${(percent * 100).toFixed(1)}%`
                            }
                          >
                            {stats.targetUsageData.map(
                              (entry: any, index: number) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                  opacity={entry.isActive ? 1 : 0.5}
                                />
                              )
                            )}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: number, name: string) => [
                              value.toLocaleString(),
                              name,
                            ]}
                            contentStyle={{
                              backgroundColor: cardBg,
                              borderColor: borderColor,
                            }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardBody>
                </Card>
              </TabPanel>

              <TabPanel p={0} pt={4}>
                <Card
                  bg={cardBg}
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="lg"
                  shadow="sm"
                >
                  <CardHeader>
                    <Heading size="md">Model Usage Distribution</Heading>
                  </CardHeader>
                  <Divider />
                  <CardBody>
                    {stats.modelUsageData.length > 0 ? (
                      <Box h="400px">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                             <Pie
                               data={stats.modelUsageData}
                               cx="50%"
                               cy="50%"
                               labelLine={true}
                               outerRadius={150}
                               fill="#8884d8"
                               dataKey="value"
                               nameKey="name"
                               label={({ name, percent }) =>
                                 `${name}: ${(percent * 100).toFixed(1)}%`
                               }
                             >
                               {stats.modelUsageData.map(
                                 (entry: any, index: number) => (
                                   <Cell
                                     key={`cell-${index}`}
                                     fill={COLORS[index % COLORS.length]}
                                   />
                                 )
                               )}
                             </Pie>
                             <RechartsTooltip
                               formatter={(value: number, name: string) => [
                                 value.toLocaleString(),
                                 name,
                               ]}
                               contentStyle={{
                                 backgroundColor: cardBg,
                                 borderColor: borderColor,
                               }}
                             />
                             <Legend />
                           </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    ) : (
                      <Text>No model usage data available for this period.</Text>
                    )}
                  </CardBody>
                </Card>
              </TabPanel>

              <TabPanel p={0} pt={4}>
                <Card
                  bg={cardBg}
                  borderWidth="1px"
                  borderColor={borderColor}
                  borderRadius="lg"
                  shadow="sm"
                >
                  <CardHeader>
                    <Heading size="md">Hourly Request Volume (Last 24h)</Heading>
                  </CardHeader>
                  <Divider />
                  <CardBody>
                    <Box h="400px">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={formattedHourlyData} // Use formatted data
                          margin={{
                            top: 5,
                            right: 30,
                            left: 20,
                            bottom: 25, // Reverted bottom margin
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="localTimeLabel" // Use formatted label
                            tick={{ fill: axisTickColor }}
                            angle={-45}
                            textAnchor="end"
                            height={100} // Increased XAxis height
                          />
                          <YAxis tick={{ fill: axisTickColor }} />
                          <RechartsTooltip
                            formatter={(value: number, name: string, props: any) => {
                                // Display local time in tooltip label if available
                                const label = props.payload?.localTimeLabel || props.label;
                                return [formatTooltipValue(value), name, label];
                            }}
                             labelFormatter={(label: string, payload: any[]) => {
                                // Attempt to show local time as the main label in tooltip
                                const entry = payload?.[0]?.payload;
                                return entry?.localTimeLabel || label;
                            }}
                            contentStyle={{
                              backgroundColor: cardBg,
                              borderColor: borderColor,
                            }}
                          />
                          <Legend />
                          <Bar
                            dataKey="requests"
                            name="Requests"
                            fill="#3182CE"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardBody>
                </Card>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </>
      ) : (
        <Alert status="info" mb={6} borderRadius="md">
          <AlertIcon />
          <AlertTitle>No Data</AlertTitle>
          <AlertDescription>
            No statistics available. Try changing the time range or refreshing.
          </AlertDescription>
        </Alert>
      )}
    </AppLayout>
  );
}
