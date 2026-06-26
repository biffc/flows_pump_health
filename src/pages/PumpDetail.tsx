import { useNavigate, useParams } from 'react-router-dom';
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
} from '@cognite/aura/components';
import { IconArrowLeft } from '@tabler/icons-react';
import type { Pump, PumpFeature, PumpPrediction, MaintenanceEvent, FailureEvent } from '../data/pumpModelV2';

type PumpDetailProps = {
  pumps: Pump[];
  pumpFeatures: PumpFeature[];
  pumpPredictions: PumpPrediction[];
  maintenanceEvents: MaintenanceEvent[];
  failureEvents: FailureEvent[];
};

export function PumpDetail({
  pumps,
  pumpFeatures,
  pumpPredictions,
  maintenanceEvents,
  failureEvents,
}: PumpDetailProps) {
  const { pumpId } = useParams<{ pumpId: string }>();
  const navigate = useNavigate();

  function handleBackToDashboard(): void {
    navigate('/');
  }

  const pump = pumps.find((p) => p.pumpId === pumpId);

  if (!pump) {
    return (
      <main className="min-h-screen bg-muted/50 text-foreground">
        <section className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
          <Button onClick={handleBackToDashboard} variant="ghost" className="w-fit">
            <IconArrowLeft aria-hidden className="mr-2 size-4" />
            Back to Dashboard
          </Button>
          <Alert variant="secondary">
            <AlertDescription>Pump {pumpId} not found.</AlertDescription>
          </Alert>
        </section>
      </main>
    );
  }

  const selectedFeatures = pumpFeatures.filter((feature) => feature.pumpId === pump.pumpId);
  const selectedPredictions = pumpPredictions.filter((prediction) => prediction.pumpId === pump.pumpId);
  const selectedMaintenance = maintenanceEvents.filter((event) => event.pumpId === pump.pumpId);
  const pumpFailureEvents = failureEvents.filter(
    (event) => event.failureType.toLowerCase().includes(pump.name.toLowerCase()) ||
    event.description.toLowerCase().includes(pump.pumpId)
  );

  return (
    <main className="phm-app min-h-screen text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <Button onClick={handleBackToDashboard} variant="ghost" size="sm">
            <IconArrowLeft aria-hidden className="mr-2 size-4" />
            Dashboard
          </Button>
          <span className="text-sm text-muted-foreground">/</span>
          <h1 className="text-lg font-semibold">
            {pump.pumpId} - {pump.name}
          </h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle as="h2">Pump Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[100px_1fr] gap-3 text-sm">
                <dt className="font-medium text-muted-foreground">Pump ID</dt>
                <dd className="font-mono">{pump.pumpId}</dd>

                <dt className="font-medium text-muted-foreground">Name</dt>
                <dd>{pump.name}</dd>

                <dt className="font-medium text-muted-foreground">Description</dt>
                <dd className="break-words">{pump.description}</dd>

                <dt className="font-medium text-muted-foreground">Install Date</dt>
                <dd>{formatTimestamp(pump.installDate)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle as="h2">Operational Metrics</CardTitle>
              <CardDescription>Current features extracted from sensor data</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedFeatures.length === 0 ? (
                <p className="text-sm text-muted-foreground">No features recorded for this pump.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium py-2">Feature</th>
                      <th className="text-left font-medium py-2">Value</th>
                      <th className="text-left font-medium py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFeatures.map((feature) => (
                      <tr key={feature.externalId} className="border-b last:border-0">
                        <td className="py-2">{feature.name}</td>
                        <td className="py-2 font-mono">{feature.value}</td>
                        <td className="py-2 text-xs text-muted-foreground">{formatTimestamp(feature.timestamp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Predictions</CardTitle>
              <CardDescription>Health and failure predictions</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedPredictions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No predictions available.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium py-2">Type</th>
                      <th className="text-left font-medium py-2">Score</th>
                      <th className="text-left font-medium py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPredictions.map((prediction) => (
                      <tr key={prediction.externalId} className="border-b last:border-0">
                        <td className="py-2">{prediction.predictionType}</td>
                        <td className="py-2">
                          <Badge
                            variant={prediction.predictionValue >= 0.75 ? 'error' : 'nordic'}
                            background
                          >
                            {(prediction.predictionValue * 100).toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {formatTimestamp(prediction.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Maintenance Events</CardTitle>
              <CardDescription>Service and maintenance history</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedMaintenance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No maintenance events recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium py-2">Type</th>
                      <th className="text-left font-medium py-2">Description</th>
                      <th className="text-left font-medium py-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMaintenance.map((event) => (
                      <tr key={event.externalId} className="border-b last:border-0">
                        <td className="py-2">{event.maintenanceType}</td>
                        <td className="py-2 text-xs">{event.description}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Failure Events</CardTitle>
            <CardDescription>Recent failures and incidents</CardDescription>
          </CardHeader>
          <CardContent>
            {pumpFailureEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failure events recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium py-2">Type</th>
                    <th className="text-left font-medium py-2">Severity</th>
                    <th className="text-left font-medium py-2">Description</th>
                    <th className="text-left font-medium py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {pumpFailureEvents.map((event) => (
                    <tr key={event.externalId} className="border-b last:border-0">
                      <td className="py-2">{event.failureType}</td>
                      <td className="py-2">
                        <Badge variant="error" background>
                          {event.severity}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs">{event.description}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleBackToDashboard} variant="outline" className="w-fit">
          <IconArrowLeft aria-hidden className="mr-2 size-4" />
          Back to Dashboard
        </Button>
      </section>
    </main>
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
