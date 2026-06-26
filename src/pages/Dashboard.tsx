import { useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsPanel,
  TabsTrigger,
  Textarea,
} from '@cognite/aura/components';
import { IconActivityHeartbeat, IconChartLine, IconDatabase, IconTool } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  FailureEvent,
  MaintenanceEvent,
  Pump,
  PumpFeature,
  PumpPrediction,
  SensorReading,
  ViewSchema,
} from '../data/pumpModelV2';
import { createChartPrompt } from '../lib/chartPrompt';
import type { HostAppAPI } from '@cognite/app-sdk';

type AppInternalState = {
  selectedPumpId: string;
  schemaQuery: string;
  schemaFilter: string;
  chatDraft: string;
};

type PumpHealthData = {
  modelMetadata: {
    space: string;
    externalId: string;
    version: string;
    name: string;
  };
  viewSchemas: ViewSchema[];
  pumps: Pump[];
  pumpFeatures: PumpFeature[];
  pumpPredictions: PumpPrediction[];
  maintenanceEvents: MaintenanceEvent[];
  failureEvents: FailureEvent[];
  sensorReadings: SensorReading[];
};

type PumpChartRow = {
  pumpId: string;
  name: string;
  riskPct: number;
  vibration: number;
  temperature: number;
  pressure: number;
  healthScore: number;
  status: 'good' | 'normal' | 'critical';
};

type PumpStatusSlice = {
  name: string;
  value: number;
  fill: string;
};

type ChatMessage = {
  role: 'user' | 'agent';
  content: string;
};

type DashboardProps = {
  api: HostAppAPI | null;
  initialState?: string;
  data: PumpHealthData;
  isLoadingData: boolean;
  dataError?: Error | null;
  navigationMethod: 'react-router' | 'fusion-api';
  onNavigationMethodChange: (method: 'react-router' | 'fusion-api') => void;
};

const STATUS_COLORS: Record<PumpChartRow['status'], string> = {
  good: '#10b981',
  normal: '#f59e0b',
  critical: '#ef4444',
};

const AGENT_EXTERNAL_ID = 'c649e622-2350-4b86-911e-404a4974f5ae';

export function Dashboard({ api, initialState, data, isLoadingData, dataError, navigationMethod, onNavigationMethodChange }: DashboardProps) {
  const navigate = useNavigate();

  const parsedInitialState = useMemo((): AppInternalState | null => {
    if (!initialState) return null;
    try {
      const candidate = JSON.parse(initialState) as Partial<AppInternalState>;
      if (typeof candidate.selectedPumpId === 'string') {
        return {
          selectedPumpId: candidate.selectedPumpId,
          schemaQuery: typeof candidate.schemaQuery === 'string' ? candidate.schemaQuery : '',
          schemaFilter: typeof candidate.schemaFilter === 'string' ? candidate.schemaFilter : 'all',
          chatDraft: typeof candidate.chatDraft === 'string' ? candidate.chatDraft : '',
        };
      }
    } catch {
      return null;
    }
    return null;
  }, [initialState]);

  const [selectedPumpId, setSelectedPumpId] = useState<string>(parsedInitialState?.selectedPumpId ?? '101');
  const [schemaQuery, setSchemaQuery] = useState<string>(parsedInitialState?.schemaQuery ?? '');
  const [schemaFilter, setSchemaFilter] = useState<string>(parsedInitialState?.schemaFilter ?? 'all');
  const [chatDraft, setChatDraft] = useState<string>(parsedInitialState?.chatDraft ?? '');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastChartClickRef = useRef<{ pumpId: string; time: number } | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const selectedPump = data.pumps.find((pump) => pump.pumpId === selectedPumpId) ?? data.pumps[0] ?? null;

  const selectedFeatures = selectedPump
    ? data.pumpFeatures.filter((feature) => feature.pumpId === selectedPump.pumpId)
    : [];
  const selectedPredictions = selectedPump
    ? data.pumpPredictions.filter((prediction) => prediction.pumpId === selectedPump.pumpId)
    : [];
  const selectedMaintenance = selectedPump
    ? data.maintenanceEvents.filter((event) => event.pumpId === selectedPump.pumpId)
    : [];

  const chartRows = useMemo((): PumpChartRow[] => {
    return data.pumps.map((pump) => {
      const riskPct = getPumpRiskPct(data.pumpPredictions, pump.pumpId);
      const vibration = findPumpFeatureMetric(data.pumpFeatures, pump.pumpId, ['vibration']);
      const temperature = findPumpFeatureMetric(data.pumpFeatures, pump.pumpId, ['temperature']);
      const pressure = findPumpFeatureMetric(data.pumpFeatures, pump.pumpId, ['pressure']);
      const healthScore = Math.max(0, 100 - riskPct);

      return {
        pumpId: pump.pumpId,
        name: pump.name,
        riskPct,
        vibration,
        temperature,
        pressure,
        healthScore,
        status: classifyStatus(riskPct),
      };
    });
  }, [data.pumpFeatures, data.pumpPredictions, data.pumps]);

  const statusChartData = useMemo((): PumpStatusSlice[] => {
    const statusCounts = chartRows.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      { good: 0, normal: 0, critical: 0 }
    );

    return [
      { name: 'Good', value: statusCounts.good, fill: STATUS_COLORS.good },
      { name: 'Normal', value: statusCounts.normal, fill: STATUS_COLORS.normal },
      { name: 'Critical', value: statusCounts.critical, fill: STATUS_COLORS.critical },
    ];
  }, [chartRows]);

  const filteredSchemas = data.viewSchemas.filter((schema) => {
    const matchesUsage = schemaFilter === 'all' || schema.usedFor === schemaFilter;
    const query = schemaQuery.trim().toLowerCase();
    if (!query) return matchesUsage;
    const matchesText =
      schema.externalId.toLowerCase().includes(query) ||
      schema.title.toLowerCase().includes(query) ||
      schema.fields.some((field) => field.name.toLowerCase().includes(query));
    return matchesUsage && matchesText;
  });

  const criticalCount = chartRows.filter((row) => row.status === 'critical').length;
  const warningCount = chartRows.filter((row) => row.status === 'normal').length;
  const healthyCount = chartRows.filter((row) => row.status === 'good').length;
  const averageRisk =
    chartRows.length === 0
      ? 0
      : chartRows.reduce((sum, row) => sum + row.riskPct, 0) / chartRows.length;

  function persistState(next: AppInternalState) {
    void api?.syncInternalState(JSON.stringify(next));
  }

  function handlePumpChange(nextPumpId: string) {
    setSelectedPumpId(nextPumpId);
    persistState({ selectedPumpId: nextPumpId, schemaQuery, schemaFilter, chatDraft });
  }

  function handleSchemaQueryChange(nextQuery: string) {
    setSchemaQuery(nextQuery);
    persistState({ selectedPumpId, schemaQuery: nextQuery, schemaFilter, chatDraft });
  }

  function handleSchemaFilterChange(nextFilter: string) {
    setSchemaFilter(nextFilter);
    persistState({ selectedPumpId, schemaQuery, schemaFilter: nextFilter, chatDraft });
  }

  function handleChatDraftChange(nextValue: string) {
    setChatDraft(nextValue);
    persistState({ selectedPumpId, schemaQuery, schemaFilter, chatDraft: nextValue });
  }

  function handleChartPumpSelection(metricLabel: string, metricValue: number, pumpId: string) {
    // Deduplicate: Bar onClick and BarChart onClick both fire on a bar click.
    // Ignore the second call if it arrives within 300 ms for the same pump.
    const now = Date.now();
    if (
      lastChartClickRef.current?.pumpId === pumpId &&
      now - lastChartClickRef.current.time < 300
    ) return;
    lastChartClickRef.current = { pumpId, time: now };

    const pump = data.pumps.find((item) => item.pumpId === pumpId);
    if (!pump) return;

    const nextChatDraft = createChartPrompt({
      pumpId,
      pumpName: pump.name,
      metricLabel,
      metricValue,
    });

    setSelectedPumpId(pumpId);
    setChatDraft(nextChatDraft);
    persistState({ selectedPumpId: pumpId, schemaQuery, schemaFilter, chatDraft: nextChatDraft });
    void sendChatMessage(nextChatDraft);
  }

  function handleChartClick(metricLabel: string, metricKey: keyof PumpChartRow, event: unknown) {
    const row = getChartRowFromEvent(event);
    if (!row) return;
    const metricValue = typeof row[metricKey] === 'number' ? row[metricKey] : 0;
    handleChartPumpSelection(metricLabel, metricValue, row.pumpId);
  }

  function handleViewPumpDetail(pumpId: string) {
    navigate(`/pump/${pumpId}`);
  }

  async function sendChatMessage(messageOverride?: string): Promise<void> {
    const message = (messageOverride ?? chatDraft).trim();
    if (!message || !api) return;

    const userMessage: ChatMessage = { role: 'user', content: message };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatDraft('');
    persistState({ selectedPumpId, schemaQuery, schemaFilter, chatDraft: '' });
    setIsChatLoading(true);

    try {
      const baseUrl = await api.getBaseUrl();
      const project = await api.getProject();
      const token = await api.getAccessToken();
      const chatBody = {
        agentExternalId: AGENT_EXTERNAL_ID,
        agentId: AGENT_EXTERNAL_ID,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: message,
            },
          },
        ],
      };

      const modernUrl = `${baseUrl}/api/v1/projects/${project}/ai/agents/chat`;
      const modernProxyUrl = `/cdf-api/api/v1/projects/${project}/ai/agents/chat`;
      const legacyUrl = `${baseUrl}/api/v1/projects/${project}/agents/${AGENT_EXTERNAL_ID}/chat`;
      const legacyProxyUrl = `/cdf-api/api/v1/projects/${project}/agents/${AGENT_EXTERNAL_ID}/chat`;

      const modernRequestInit: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'cdf-version': '20230101-beta',
        },
        body: JSON.stringify(chatBody),
      };

      const legacyRequestInit: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'cdf-version': 'alpha',
        },
        body: JSON.stringify({ messages: chatBody.messages }),
      };

      const attempts: Array<{ url: string; request: RequestInit }> = [
        { url: modernUrl, request: modernRequestInit },
        // Local dev fallback: same request through Vite proxy to avoid browser CORS/network issues.
        { url: modernProxyUrl, request: modernRequestInit },
        { url: legacyUrl, request: legacyRequestInit },
        { url: legacyProxyUrl, request: legacyRequestInit },
      ];

      const attemptErrors: string[] = [];
      let response: Response | null = null;

      for (const attempt of attempts) {
        try {
          const candidate = await fetch(attempt.url, attempt.request);

          if (!candidate.ok) {
            const details = await candidate.text();
            const detailText = `(${candidate.status}) ${details}`;

            // These often indicate endpoint/payload mismatch; try next known variant.
            if (candidate.status === 400 || candidate.status === 404) {
              attemptErrors.push(`${attempt.url} ${detailText}`);
              continue;
            }

            throw new Error(`Agent chat failed ${detailText}`);
          }

          response = candidate;
          break;
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            const networkMessage = error instanceof Error ? error.message : String(error);
            attemptErrors.push(`${attempt.url} network error: ${networkMessage}`);
            continue;
          }
          throw error;
        }
      }

      if (!response) {
        throw new Error(
          `All Agent API routes failed. ${attemptErrors.length > 0 ? attemptErrors.join(' | ') : 'No response.'}`
        );
      }

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Agent chat failed (${response.status}): ${details}`);
      }

      const payload = (await response.json()) as {
        response?: { messages?: Array<Record<string, unknown>> };
        messages?: Array<Record<string, unknown>>;
      };
      const agentMessages = payload.response?.messages ?? payload.messages;
      const agentText = extractAgentText(agentMessages);
      setChatMessages((prev) => [...prev, { role: 'agent', content: agentText }]);
    } catch (error) {
      const detailedFailure =
        error instanceof Error && error.message.startsWith('All Agent API routes failed.');

      const messageText = detailedFailure
        ? `${error.message} If this persists, verify Fusion session auth and Atlas agent permissions for this project.`
        : isLikelyNetworkError(error)
          ? 'Network error contacting Agent API. If you are developing locally, ensure Fusion uses port 3003 and try refreshing the page.'
          : error instanceof Error
            ? error.message
            : String(error);
      setChatMessages((prev) => [...prev, { role: 'agent', content: `Error: ${messageText}` }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  return (
    <main className="phm-app min-h-screen text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="phm-hero-shell">
          <Card>
            <div className="phm-hero px-6 py-6 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="phm-hero-copy flex-1 pr-4">
                  <CardTitle as="h1">PHM Modeling for Pumps</CardTitle>
                  <CardDescription>
                    Predictive Health Monitoring Dashboard • Live Data from {data.modelMetadata.externalId} v
                    {data.modelMetadata.version} ({data.modelMetadata.space})
                  </CardDescription>
                </div>
                <div className="ml-auto hidden shrink-0 items-start justify-end pl-6 pt-1 lg:flex">
                  <img
                    src="https://tridiagonal.ai/hubfs/Images%20AI/Untitled%20Design%20-%201%20-%20Edited.png"
                    alt="Tridiagonal.AI"
                    className="block h-9 w-auto max-w-[220px] object-contain"
                    draggable="false"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SummaryCard
                  title="Total Pumps"
                  value={String(data.pumps.length)}
                  detail={isLoadingData ? 'Loading...' : 'Live CDF model'}
                  tone="neutral"
                  icon={<IconDatabase aria-hidden className="size-4" />}
                />
                <SummaryCard
                  title="Critical"
                  value={String(criticalCount)}
                  detail="High-risk pumps"
                  tone="danger"
                  icon={<IconActivityHeartbeat aria-hidden className="size-4" />}
                />
                <SummaryCard
                  title="Warning"
                  value={String(warningCount)}
                  detail="Needs attention"
                  tone="warning"
                  icon={<IconTool aria-hidden className="size-4" />}
                />
                <SummaryCard
                  title="Healthy"
                  value={String(healthyCount)}
                  detail="Within normal range"
                  tone="success"
                  icon={<IconChartLine aria-hidden className="size-4" />}
                />
                <SummaryCard
                  title="Avg Risk"
                  value={`${averageRisk.toFixed(0)}%`}
                  detail="Fleet-wide prediction"
                  tone="accent"
                  icon={<IconChartLine aria-hidden className="size-4" />}
                />
              </div>
            </div>
          </Card>
        </div>

        {dataError ? (
          <Alert variant="secondary">
            <AlertDescription>
              Failed to load live CDF data: {String(dataError)}. Showing sample data so the app remains usable.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Monitoring Charts</CardTitle>
                <CardDescription>
                  Click a datapoint to select a pump and prefill a contextual prompt for AI triage.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="phm-chart-card phm-chart-risk w-full min-w-0 rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold">Failure Risk (%)</h4>
                  <div className="mt-3 h-[260px] overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartRows}
                        margin={{ top: 12, right: 16, bottom: 8, left: 4 }}
                        barCategoryGap="18%"
                        onClick={(event) => handleChartClick('failure risk', 'riskPct', event)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="pumpId" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} width={34} />
                        <Tooltip />
                        <Bar
                          dataKey="riskPct"
                          barSize={26}
                          cursor="pointer"
                          onClick={(barData: Partial<PumpChartRow>) => {
                            if (typeof barData.pumpId === 'string') {
                              handleChartPumpSelection('failure risk', barData.riskPct ?? 0, barData.pumpId);
                            }
                          }}
                        >
                          {chartRows.map((entry) => (
                            <Cell key={`risk-${entry.pumpId}`} fill={STATUS_COLORS[entry.status]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="phm-chart-card phm-chart-health w-full min-w-0 rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold">Health Score</h4>
                  <div className="mt-3 h-[260px] overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartRows}
                        margin={{ top: 12, right: 16, bottom: 8, left: 4 }}
                        barCategoryGap="18%"
                        onClick={(event) => handleChartClick('health score', 'healthScore', event)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="pumpId" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} width={34} />
                        <Tooltip />
                        <Bar
                          dataKey="healthScore"
                          barSize={26}
                          cursor="pointer"
                          onClick={(barData: Partial<PumpChartRow>) => {
                            if (typeof barData.pumpId === 'string') {
                              handleChartPumpSelection('health score', barData.healthScore ?? 0, barData.pumpId);
                            }
                          }}
                        >
                          {chartRows.map((entry) => (
                            <Cell key={`health-${entry.pumpId}`} fill={STATUS_COLORS[entry.status]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="phm-chart-card phm-chart-vibration w-full min-w-0 rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold">Vibration</h4>
                  <div className="mt-3 h-[260px] overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartRows}
                        margin={{ top: 12, right: 16, bottom: 8, left: 4 }}
                        onClick={(event) => handleChartClick('vibration', 'vibration', event)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="pumpId" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} width={34} />
                        <Tooltip />
                        <Line
                          dataKey="vibration"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 7, cursor: 'pointer' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="phm-chart-card phm-chart-temperature w-full min-w-0 rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold">Temperature</h4>
                  <div className="mt-3 h-[260px] overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartRows}
                        margin={{ top: 12, right: 16, bottom: 8, left: 4 }}
                        onClick={(event) => handleChartClick('temperature', 'temperature', event)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="pumpId" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} width={34} />
                        <Tooltip />
                        <Line
                          dataKey="temperature"
                          stroke="#eab308"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 7, cursor: 'pointer' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="phm-chart-card phm-chart-pressure w-full min-w-0 rounded-lg border bg-card p-4">
                  <h4 className="text-sm font-semibold">Pressure</h4>
                  <div className="mt-3 h-[260px] overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartRows}
                        margin={{ top: 12, right: 16, bottom: 8, left: 4 }}
                        onClick={(event) => handleChartClick('pressure', 'pressure', event)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="pumpId" tick={{ fontSize: 11 }} interval={0} />
                        <YAxis tick={{ fontSize: 11 }} width={34} />
                        <Tooltip />
                        <Line
                          dataKey="pressure"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 7, cursor: 'pointer' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="phm-chart-card phm-chart-fleet w-full min-w-0 rounded-lg border bg-card p-4 lg:col-span-2">
                  <h4 className="text-sm font-semibold">Fleet Status Distribution</h4>
                  <div className="mt-3 h-[220px] overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          nameKey="name"
                          label={false}
                          labelLine={false}
                        >
                          {statusChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    {statusChartData.map((slice) => (
                      <span key={slice.name} className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: slice.fill }}
                        />
                        {slice.name}: {slice.value}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="w-full">
              <CardHeader>
                <CardTitle as="h2">Navigation Method Demo</CardTitle>
                <CardDescription>
                  Choose between React Router (Option 1: Client-Side SPA) and Fusion Navigation API (Option 2: Host Integration)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button
                      variant={navigationMethod === 'react-router' ? 'default' : 'secondary'}
                      onClick={() => onNavigationMethodChange('react-router')}
                    >
                      Option 1: React Router (SPA)
                    </Button>
                    <Button
                      variant={navigationMethod === 'fusion-api' ? 'default' : 'secondary'}
                      onClick={() => onNavigationMethodChange('fusion-api')}
                    >
                      Option 2: React Router + Fusion Sync
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {navigationMethod === 'react-router'
                      ? '✓ Using React Router navigation. URL updates via browser history.'
                      : '✓ Using React Router with Fusion state sync. Enables shared links and Fusion integration.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Pump Overview</TabsTrigger>
                <TabsTrigger value="predictions">Predictions</TabsTrigger>
                <TabsTrigger value="schema">Schema Explorer</TabsTrigger>
              </TabsList>

              <TabsPanel value="overview" className="space-y-4">
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle as="h2">Pump Drilldown</CardTitle>
                    <CardDescription>Select a pump to inspect linked operational data.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Select value={selectedPump?.pumpId ?? ''} onValueChange={handlePumpChange}>
                        <SelectTrigger className="w-full max-w-sm" aria-label="Select pump">
                          <SelectValue placeholder="Select pump" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.pumps.map((pump) => (
                            <SelectItem key={pump.externalId} value={pump.pumpId}>
                              {pump.pumpId} - {pump.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedPump && (
                        <Button
                          onClick={() => handleViewPumpDetail(selectedPump.pumpId)}
                          variant="outline"
                          size="sm"
                        >
                          View Full Details
                        </Button>
                      )}
                    </div>

                    {selectedPump ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle as="h3">Pump Profile</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <dl className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                              <dt className="text-muted-foreground">Pump ID</dt>
                              <dd>{selectedPump.pumpId}</dd>
                              <dt className="text-muted-foreground">Name</dt>
                              <dd>{selectedPump.name}</dd>
                              <dt className="text-muted-foreground">Description</dt>
                              <dd>{selectedPump.description}</dd>
                              <dt className="text-muted-foreground">Install date</dt>
                              <dd>{formatTimestamp(selectedPump.installDate)}</dd>
                            </dl>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle as="h3">Maintenance Events</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <SimpleTable
                              columns={['Event', 'Type', 'Timestamp']}
                              rows={selectedMaintenance.map((event) => [
                                event.eventId,
                                event.maintenanceType,
                                formatTimestamp(event.timestamp),
                              ])}
                              emptyMessage="No maintenance records for selected pump."
                            />
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}

                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle as="h3">Pump Features</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SimpleTable
                          columns={['Feature', 'Value', 'Timestamp']}
                          rows={selectedFeatures.map((feature) => [
                            feature.name,
                            feature.value,
                            formatTimestamp(feature.timestamp),
                          ])}
                          emptyMessage="No feature rows for selected pump."
                        />
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </TabsPanel>

              <TabsPanel value="predictions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">Prediction and Event Stream</CardTitle>
                    <CardDescription>
                      View inference outputs alongside failure events to support triage decisions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Card className="w-full">
                      <CardHeader>
                        <CardTitle as="h3">
                          Predictions for Pump {selectedPump ? selectedPump.pumpId : 'N/A'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left font-medium">Type</th>
                              <th className="text-left font-medium">Score</th>
                              <th className="text-left font-medium">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPredictions.map((prediction) => (
                              <tr key={prediction.externalId}>
                                <td className="py-2">{prediction.predictionType}</td>
                                <td className="py-2">
                                  <Badge
                                    variant={prediction.predictionValue >= 0.75 ? 'error' : 'nordic'}
                                    background
                                  >
                                    {(prediction.predictionValue * 100).toFixed(1)}%
                                  </Badge>
                                </td>
                                <td className="py-2">{formatTimestamp(prediction.timestamp)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle as="h3">Recent Failure Events</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left font-medium">Failure Type</th>
                              <th className="text-left font-medium">Severity</th>
                              <th className="text-left font-medium">Description</th>
                              <th className="text-left font-medium">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.failureEvents.map((event) => (
                              <tr key={event.externalId}>
                                <td className="py-2">{event.failureType}</td>
                                <td className="py-2">
                                  <Badge variant="error" background>
                                    {event.severity}
                                  </Badge>
                                </td>
                                <td className="py-2">{event.description}</td>
                                <td className="py-2">{formatTimestamp(event.timestamp)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </TabsPanel>

              <TabsPanel value="schema" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle as="h2">Schema Explorer</CardTitle>
                    <CardDescription>
                      Inspect PumpModelV2 views and property constraints directly from CDF.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                      <Input
                        value={schemaQuery}
                        onChange={(event) => handleSchemaQueryChange(event.target.value)}
                        placeholder="Search view or field name"
                        aria-label="Search schema"
                      />
                      <Select value={schemaFilter} onValueChange={handleSchemaFilterChange}>
                        <SelectTrigger aria-label="Filter schema by usage">
                          <SelectValue placeholder="Filter by usage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All views</SelectItem>
                          <SelectItem value="node">Node views</SelectItem>
                          <SelectItem value="edge">Edge views</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      {filteredSchemas.map((schema) => (
                        <SchemaCard key={schema.externalId} schema={schema} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsPanel>
            </Tabs>
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <Card className="overflow-hidden">
              <div className="phm-chat-header px-4 py-3">
                <div className="phm-chat-headings">
                  <CardTitle as="h2">AI Assistant</CardTitle>
                  <CardDescription>Ask about pump health and maintenance.</CardDescription>
                </div>
              </div>
              <CardContent className="space-y-4">
                <div className="phm-chat-body space-y-4">
                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {chatMessages.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
                        Start a conversation. Try "Which pumps need attention?" or click any chart datapoint.
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <Card key={`${msg.role}-${idx}`}>
                          <CardHeader>
                            <CardTitle as="h3">{msg.role === 'user' ? 'You' : 'Agent'}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                          </CardContent>
                        </Card>
                      ))
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <Textarea
                    value={chatDraft}
                    onChange={(event) => handleChatDraftChange(event.target.value)}
                    placeholder="Ask about pump health..."
                    aria-label="Agent chat message"
                  />
                  <Button
                    onClick={() => void sendChatMessage()}
                    disabled={isChatLoading || !chatDraft.trim()}
                    className="w-full"
                  >
                    {isChatLoading ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>
    </main>
  );
}

type SummaryCardProps = {
  title: string;
  value: string;
  detail: string;
  tone: 'neutral' | 'danger' | 'warning' | 'success' | 'accent';
  icon: ReactNode;
};

function SummaryCard({ title, value, detail, tone, icon }: SummaryCardProps) {
  return (
    <div className={`phm-summary-card phm-summary-${tone}`}>
      <Card>
        <CardHeader>
          <div className="phm-summary-head">
            <CardDescription>{title}</CardDescription>
            {icon}
          </div>
        </CardHeader>
        <CardContent>
          <div className="phm-summary-body">
            <p>{value}</p>
            <p>{detail}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type SimpleTableProps = {
  columns: string[];
  rows: string[][];
  emptyMessage: string;
};

function SimpleTable({ columns, rows, emptyMessage }: SimpleTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} className="text-left font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${row.join('-')}-${rowIndex}`}>
            {row.map((cell, cellIndex) => (
              <td key={`${rowIndex}-${cellIndex}`} className="py-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type SchemaCardProps = {
  schema: ViewSchema;
};

function SchemaCard({ schema }: SchemaCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle as="h3">{schema.title}</CardTitle>
          <Badge variant={schema.usedFor === 'edge' ? 'mountain' : 'nordic'}>{schema.usedFor}</Badge>
          <Badge variant={schema.writable ? 'mountain' : 'secondary'}>{schema.writable ? 'writable' : 'read-only'}</Badge>
        </div>
        <CardDescription>{schema.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium">Property</th>
              <th className="text-left font-medium">Type</th>
              <th className="text-left font-medium">Nullable</th>
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((field) => (
              <tr key={field.name}>
                <td className="py-2">{field.name}</td>
                <td className="py-2">{field.type}</td>
                <td className="py-2">{field.nullable ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function extractAgentText(messages: Array<Record<string, unknown>> | undefined): string {
  if (!messages || messages.length === 0) return 'No response from agent.';
  const agent = messages.find((msg) => msg.role === 'agent');
  if (!agent) return 'No agent message in response.';
  const content = agent.content;

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    const textParts = content
      .map((part) => {
        if (typeof part === 'object' && part !== null && 'text' in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .filter((part) => part.length > 0);

    if (textParts.length > 0) return textParts.join('\n');
  }

  if (typeof content === 'object' && content !== null && 'text' in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === 'string') return text;
  }

  return JSON.stringify(content);
}

function classifyStatus(riskPct: number): PumpChartRow['status'] {
  if (riskPct > 70) return 'critical';
  if (riskPct > 40) return 'normal';
  return 'good';
}

function getPumpRiskPct(predictions: PumpPrediction[], pumpId: string): number {
  const pumpPredictions = predictions.filter((prediction) => prediction.pumpId === pumpId);
  if (pumpPredictions.length === 0) return 0;

  const explicitRisk = pumpPredictions
    .filter((prediction) => !isHealthyPredictionType(prediction.predictionType))
    .reduce((max, prediction) => {
      return prediction.predictionValue > max ? prediction.predictionValue : max;
    }, 0);

  if (explicitRisk > 0) {
    return Number((explicitRisk * 100).toFixed(1));
  }

  const healthyScore = pumpPredictions
    .filter((prediction) => isHealthyPredictionType(prediction.predictionType))
    .reduce((max, prediction) => {
      return prediction.predictionValue > max ? prediction.predictionValue : max;
    }, 0);

  const inferredRisk = healthyScore > 0 ? 1 - healthyScore : 0;
  return Number((inferredRisk * 100).toFixed(1));
}

function isHealthyPredictionType(predictionType: string): boolean {
  const normalized = predictionType.trim().toLowerCase();
  return normalized.includes('healthy') || normalized.includes('normal') || normalized.includes('good');
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network error') ||
    normalized.includes('load failed')
  );
}

function findPumpFeatureMetric(features: PumpFeature[], pumpId: string, keywords: string[]): number {
  const matchingFeature = features.find((feature) => {
    if (feature.pumpId !== pumpId) return false;
    const normalizedName = feature.name.trim().toLowerCase();
    return keywords.some((keyword) => normalizedName.includes(keyword));
  });

  const numericValue = matchingFeature ? Number.parseFloat(matchingFeature.value) : Number.NaN;
  if (Number.isNaN(numericValue)) return 0;
  return Number(numericValue.toFixed(2));
}

function getChartRowFromEvent(event: unknown): PumpChartRow | null {
  if (!isRecord(event)) return null;
  const activePayload = event.activePayload;
  if (!Array.isArray(activePayload) || activePayload.length === 0) return null;
  const firstPayload = activePayload[0];
  if (!isRecord(firstPayload)) return null;
  const payload = firstPayload.payload;
  if (!isRecord(payload)) return null;

  const pumpId = payload.pumpId;
  const name = payload.name;
  const riskPct = payload.riskPct;
  const vibration = payload.vibration;
  const temperature = payload.temperature;
  const pressure = payload.pressure;
  const healthScore = payload.healthScore;
  const status = payload.status;

  if (typeof pumpId !== 'string' || typeof name !== 'string') return null;
  if (
    typeof riskPct !== 'number' ||
    typeof vibration !== 'number' ||
    typeof temperature !== 'number' ||
    typeof pressure !== 'number' ||
    typeof healthScore !== 'number'
  ) {
    return null;
  }
  if (status !== 'good' && status !== 'normal' && status !== 'critical') return null;

  return {
    pumpId,
    name,
    riskPct,
    vibration,
    temperature,
    pressure,
    healthScore,
    status,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
