import { connectToHostApp as connectToHostAppImpl } from '@cognite/app-sdk';
import type { HostAppAPI } from '@cognite/app-sdk';
import { CogniteSdkProvider, useCogniteSdk } from '@cognite/app-sdk/react';
import { Alert, AlertDescription, Card, CardContent, Loader } from '@cognite/aura/components';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Dashboard } from './pages/Dashboard';
import { PumpDetail } from './pages/PumpDetail';
import {
  failureEvents as fallbackFailureEvents,
  maintenanceEvents as fallbackMaintenanceEvents,
  modelMetadata as fallbackModelMetadata,
  pumpFeatures as fallbackPumpFeatures,
  pumpPredictions as fallbackPumpPredictions,
  pumps as fallbackPumps,
  sensorReadings as fallbackSensorReadings,
  type FailureEvent,
  type MaintenanceEvent,
  type Pump,
  type PumpFeature,
  type PumpPrediction,
  type SensorReading,
  type ViewSchema,
  viewSchemas as fallbackViewSchemas,
} from './data/pumpModelV2';

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

type CogniteClientLike = {
  project?: string;
  dataModels: {
    retrieve: (
      items: Array<{ space: string; externalId: string; version?: string }>
    ) => Promise<Array<Record<string, unknown>>>;
  };
  views: {
    retrieve: (
      items: Array<{ space: string; externalId: string; version?: string }>
    ) => Promise<Array<Record<string, unknown>>>;
  };
  instances: {
    list: (params: Record<string, unknown>) => Promise<{ items?: Array<Record<string, unknown>> }>;
  };
};

const MODEL_SPACE = 'pump_health_v2';
const MODEL_EXTERNAL_ID = 'PumpModelV2';
const MODEL_VERSION = '1';

const loadingFallback = (
  <main className="min-h-screen bg-muted/50 text-foreground">
    <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <Card aria-label="Loading project" aria-live="polite">
          <CardContent>
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <Loader size={20} />
              <span>Loading project...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  </main>
);

const errorFallback = (
  <main className="min-h-screen bg-muted/50 text-foreground">
    <section className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <Alert>
          <AlertDescription>
            Unable to connect to Fusion host. This app should run inside the Fusion custom-app iframe.
            Try running in Fusion or wait for the demo mode to load.
          </AlertDescription>
        </Alert>
      </div>
    </section>
  </main>
);

type AppContentProps = { api: HostAppAPI | null; initialState?: string };

function AppContent({ api, initialState }: AppContentProps) {
  // In dev/demo mode (no Fusion host), skip SDK initialization and use fallback data immediately
  const isDemoMode = !api;
  const [navigationMethod, setNavigationMethod] = useState<'react-router' | 'fusion-api'>('react-router');
  
  // Only call useCogniteSdk() when we're in a CogniteSdkProvider context (Fusion mode)
  let sdk: unknown = null;
  if (!isDemoMode) {
    sdk = useCogniteSdk() as unknown as CogniteClientLike;
  }

  const dataQuery = useQuery({
    queryKey: ['pump-health', MODEL_SPACE, MODEL_EXTERNAL_ID, MODEL_VERSION],
    queryFn: async (): Promise<PumpHealthData> => {
      if (isDemoMode) {
        // Skip API calls in demo mode, return fallback data immediately
        return {
          modelMetadata: fallbackModelMetadata,
          viewSchemas: fallbackViewSchemas,
          pumps: fallbackPumps,
          pumpFeatures: fallbackPumpFeatures,
          pumpPredictions: fallbackPumpPredictions,
          maintenanceEvents: fallbackMaintenanceEvents,
          failureEvents: fallbackFailureEvents,
          sensorReadings: fallbackSensorReadings,
        };
      }
      
      const modelResponse = await (sdk as CogniteClientLike).dataModels.retrieve([
        { space: MODEL_SPACE, externalId: MODEL_EXTERNAL_ID, version: MODEL_VERSION },
      ]);
      const modelItems = collectCollectionItems(modelResponse);
      if (modelItems.length === 0) {
        throw new Error('PumpModelV2 not found in CDF project.');
      }

      const model = modelItems[0];
      if (!model) {
        throw new Error('PumpModelV2 not found in CDF project.');
      }
      const modelViewRefs = getModelViewRefs(model);
      const viewResponse = modelViewRefs.length > 0 ? await (sdk as CogniteClientLike).views.retrieve(modelViewRefs) : { items: [] };
      const viewItems = collectCollectionItems(viewResponse);

      const pumps = await listNodes<Pump>(sdk as CogniteClientLike, 'PumpView', (item) => ({
        externalId: String(item.externalId ?? ''),
        pumpId: getString(item.properties, 'pumpId'),
        name: getString(item.properties, 'name'),
        description: getString(item.properties, 'description'),
        installDate: getNullableString(item.properties, 'installDate'),
      }));

      const pumpFeatures = await listNodes<PumpFeature>(sdk as CogniteClientLike, 'PumpFeatureView', (item) => ({
        externalId: String(item.externalId ?? ''),
        featureId: getString(item.properties, 'featureId'),
        pumpId: getString(item.properties, 'pumpId'),
        name: getString(item.properties, 'name'),
        value: getString(item.properties, 'value'),
        timestamp: getNullableString(item.properties, 'timestamp'),
      }));

      const pumpPredictions = await listNodes<PumpPrediction>(sdk as CogniteClientLike, 'PumpPredictionView', (item) => ({
        externalId: String(item.externalId ?? ''),
        predictionId: getString(item.properties, 'predictionId'),
        pumpId: getString(item.properties, 'pumpId'),
        predictionType: getString(item.properties, 'predictionType'),
        predictionValue: getNumber(item.properties, 'predictionValue'),
        timestamp: getString(item.properties, 'timestamp'),
      }));

      const maintenanceEvents = await listNodes<MaintenanceEvent>(sdk as CogniteClientLike, 'MaintenanceEventView', (item) => ({
        externalId: String(item.externalId ?? ''),
        eventId: getString(item.properties, 'eventId'),
        pumpId: getString(item.properties, 'pumpId'),
        maintenanceType: getString(item.properties, 'maintenanceType'),
        description: getString(item.properties, 'description'),
        timestamp: getString(item.properties, 'timestamp'),
      }));

      const failureEvents = await listNodes<FailureEvent>(sdk as CogniteClientLike, 'FailureEventView', (item) => ({
        externalId: String(item.externalId ?? ''),
        eventId: getString(item.properties, 'eventId'),
        failureType: getString(item.properties, 'failureType'),
        severity: getString(item.properties, 'severity'),
        description: getString(item.properties, 'description'),
        timestamp: getString(item.properties, 'timestamp'),
      }));

      const sensorReadings = await listNodes<SensorReading>(sdk as CogniteClientLike, 'SensorReadingView', (item) => ({
        externalId: String(item.externalId ?? ''),
        sensorId: getString(item.properties, 'sensorId'),
        value: getNumber(item.properties, 'value'),
        status: getNullableString(item.properties, 'status'),
        timestamp: getString(item.properties, 'timestamp'),
      }));

      return {
        modelMetadata: {
          space: String(model.space ?? MODEL_SPACE),
          externalId: String(model.externalId ?? MODEL_EXTERNAL_ID),
          version: String(model.version ?? MODEL_VERSION),
          name: String(model.name ?? MODEL_EXTERNAL_ID),
        },
        viewSchemas: viewItems.map(mapViewSchema),
        pumps,
        pumpFeatures,
        pumpPredictions,
        maintenanceEvents,
        failureEvents,
        sensorReadings,
      };
    },
    staleTime: 60_000,
    retry: 1,
  });

  const data: PumpHealthData = dataQuery.data ?? {
    modelMetadata: fallbackModelMetadata,
    viewSchemas: fallbackViewSchemas,
    pumps: fallbackPumps,
    pumpFeatures: fallbackPumpFeatures,
    pumpPredictions: fallbackPumpPredictions,
    maintenanceEvents: fallbackMaintenanceEvents,
    failureEvents: fallbackFailureEvents,
    sensorReadings: fallbackSensorReadings,
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              api={api}
              initialState={initialState}
              data={data}
              isLoadingData={dataQuery.isLoading}
              dataError={dataQuery.error}
              navigationMethod={navigationMethod}
              onNavigationMethodChange={setNavigationMethod}
            />
          }
        />
        <Route
          path="/pump/:pumpId"
          element={
            <PumpDetail
              pumps={data.pumps}
              pumpFeatures={data.pumpFeatures}
              pumpPredictions={data.pumpPredictions}
              maintenanceEvents={data.maintenanceEvents}
              failureEvents={data.failureEvents}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

type AppProps = {
  deps?: ComponentProps<typeof CogniteSdkProvider>['deps'];
  connectToHostApp?: typeof connectToHostAppImpl;
};

function App({
  deps,
  connectToHostApp = deps?.connectToHostApp ?? connectToHostAppImpl,
}: AppProps) {
  const [connection, setConnection] = useState<{ api: HostAppAPI; initialState?: string } | null>(null);
  const [connectionAttempted, setConnectionAttempted] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await connectToHostApp();
        if (!cancelled) {
          setConnection(result);
          setConnectionAttempted(true);
        }
      } catch {
        // Failed to connect to Fusion host - allow demo mode
        if (!cancelled) {
          setConnectionAttempted(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectToHostApp]);

  // If not in Fusion (demo mode), render directly without CogniteSdkProvider
  if (connectionAttempted && !connection) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppContent api={null} initialState={undefined} />
      </QueryClientProvider>
    );
  }

  // In Fusion or still connecting, use full setup with CogniteSdkProvider
  return (
    <QueryClientProvider client={queryClient}>
      <CogniteSdkProvider loadingFallback={loadingFallback} errorFallback={errorFallback} deps={deps}>
        <AppContent api={connection?.api ?? null} initialState={connection?.initialState} />
      </CogniteSdkProvider>
    </QueryClientProvider>
  );
}

export default App;

// Helper functions for data loading and transformation

function collectCollectionItems(response: unknown): Array<Record<string, unknown>> {
  if (!isRecord(response)) return [];
  const items = response.items;
  if (!Array.isArray(items)) return [];

  return items.filter((item): item is Record<string, unknown> => isRecord(item));
}

function getModelViewRefs(model: Record<string, unknown>): Array<{ space: string; externalId: string; version?: string }> {
  const rawViews = model.views;
  if (!Array.isArray(rawViews)) return [];

  const refs: Array<{ space: string; externalId: string; version?: string }> = [];
  for (const view of rawViews) {
    if (typeof view !== 'object' || view === null) continue;
    const typed = view as Record<string, unknown>;
    const space = typeof typed.space === 'string' ? typed.space : MODEL_SPACE;
    const externalId = typeof typed.externalId === 'string' ? typed.externalId : '';
    const version = typeof typed.version === 'string' ? typed.version : undefined;
    if (!externalId) continue;
    refs.push({ space, externalId, version });
  }
  return refs;
}

function mapViewSchema(view: Record<string, unknown>): ViewSchema {
  const externalId = typeof view.externalId === 'string' ? view.externalId : 'UnknownView';
  const title = typeof view.name === 'string' ? view.name : externalId;
  const description = typeof view.description === 'string' ? view.description : '';
  const usedFor = view.usedFor === 'edge' ? ('edge' as const) : ('node' as const);
  const writable = typeof view.writable === 'boolean' ? view.writable : false;

  const properties = typeof view.properties === 'object' && view.properties !== null
    ? (view.properties as Record<string, unknown>)
    : {};

  const fields = Object.entries(properties).map(([name, value]) => {
    if (typeof value !== 'object' || value === null) {
      return { name, type: 'text' as const, nullable: true };
    }
    const typedValue = value as Record<string, unknown>;
    const nullable = typeof typedValue.nullable === 'boolean' ? typedValue.nullable : true;
    const typeObj = typeof typedValue.type === 'object' && typedValue.type !== null
      ? (typedValue.type as Record<string, unknown>)
      : null;
    const typeName = typeObj && typeof typeObj.type === 'string' ? typeObj.type : 'text';

    return {
      name,
      type: normalizeType(typeName),
      nullable,
    };
  });

  return { externalId, title, description, usedFor, writable, fields };
}

function normalizeType(typeName: string): 'text' | 'timestamp' | 'float64' {
  if (typeName === 'timestamp') return 'timestamp';
  if (typeName === 'float64') return 'float64';
  return 'text';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function listNodes<T>(
  sdk: CogniteClientLike,
  viewExternalId: string,
  mapper: (item: { externalId?: unknown; properties: Record<string, unknown> }) => T
): Promise<T[]> {
  const response = await sdk.instances.list({
    instanceType: 'node',
    sources: [
      {
        source: {
          space: MODEL_SPACE,
          externalId: viewExternalId,
          version: MODEL_VERSION,
          type: 'view',
        },
      },
    ],
    limit: 1000,
  });

  const items = response.items ?? [];

  return items.map((item) => {
    const props = flattenProps(item);
    return mapper({ externalId: item.externalId, properties: props });
  });
}

function flattenProps(item: Record<string, unknown>): Record<string, unknown> {
  const props = item.properties;
  if (typeof props !== 'object' || props === null) return {};

  const level1 = Object.values(props as Record<string, unknown>)[0];
  if (typeof level1 !== 'object' || level1 === null) return {};

  const level2 = Object.values(level1 as Record<string, unknown>)[0];
  if (typeof level2 !== 'object' || level2 === null) return {};

  return level2 as Record<string, unknown>;
}

function getString(properties: Record<string, unknown>, key: string): string {
  const value = properties[key];
  return typeof value === 'string' ? value : '';
}

function getNullableString(properties: Record<string, unknown>, key: string): string | null {
  const value = properties[key];
  return typeof value === 'string' ? value : null;
}

function getNumber(properties: Record<string, unknown>, key: string): number {
  const value = properties[key];
  return typeof value === 'number' ? value : 0;
}
