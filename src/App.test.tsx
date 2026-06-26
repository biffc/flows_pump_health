import type { HostAppAPI, ConnectToHostAppResult } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import { createChartPrompt } from './lib/chartPrompt';

vi.mock('recharts', () => {
  type ChartRow = Record<string, unknown>;

  function dispatchChartClick(
    onClick: ((event: { activePayload: Array<{ payload: ChartRow }> }) => void) | undefined,
    data: ChartRow[] | undefined
  ): void {
    if (!onClick) return;
    const payload = data && data.length > 1 ? data[1] : data?.[0] ?? {};
    onClick({ activePayload: [{ payload }] });
  }

  function MockContainer({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }

  function MockBarChart({
    data,
    onClick,
    children,
  }: {
    data?: ChartRow[];
    onClick?: (event: { activePayload: Array<{ payload: ChartRow }> }) => void;
    children?: ReactNode;
  }) {
    return (
      <div>
        <button type="button" onClick={() => dispatchChartClick(onClick, data)}>
          mock-barchart-click
        </button>
        {children}
      </div>
    );
  }

  function MockLineChart({
    data,
    onClick,
    children,
  }: {
    data?: ChartRow[];
    onClick?: (event: { activePayload: Array<{ payload: ChartRow }> }) => void;
    children?: ReactNode;
  }) {
    return (
      <div>
        <button type="button" onClick={() => dispatchChartClick(onClick, data)}>
          mock-linechart-click
        </button>
        {children}
      </div>
    );
  }

  function MockPrimitive({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }

  return {
    ResponsiveContainer: MockContainer,
    BarChart: MockBarChart,
    LineChart: MockLineChart,
    PieChart: MockPrimitive,
    CartesianGrid: MockPrimitive,
    XAxis: MockPrimitive,
    YAxis: MockPrimitive,
    Tooltip: MockPrimitive,
    Bar: MockPrimitive,
    Line: MockPrimitive,
    Pie: MockPrimitive,
    Cell: MockPrimitive,
  };
});

type AppDeps = NonNullable<ComponentProps<typeof App>['deps']>;

function makeApi(): HostAppAPI {
  return {
    getProject: vi.fn<HostAppAPI['getProject']>(() => Promise.resolve('tridcognite-sanbox')),
    getBaseUrl: vi.fn<HostAppAPI['getBaseUrl']>(() => Promise.resolve('https://cognite.test')),
    getAccessToken: vi.fn<HostAppAPI['getAccessToken']>(() => Promise.resolve('test-token')),
    getAppId: vi.fn<HostAppAPI['getAppId']>(() => Promise.resolve('test-app-id')),
    syncInternalState: vi.fn<HostAppAPI['syncInternalState']>(() => Promise.resolve(true)),
    navigateInternal: vi.fn<HostAppAPI['navigateInternal']>(() => Promise.resolve(true)),
    navigateExternal: vi.fn<HostAppAPI['navigateExternal']>(() => Promise.resolve(true)),
    registerAgentServer: vi.fn<HostAppAPI['registerAgentServer']>(() => Promise.resolve()),
    unregisterAgentServer: vi.fn<HostAppAPI['unregisterAgentServer']>(() => Promise.resolve()),
    sendAgentLayoutMode: vi.fn<HostAppAPI['sendAgentLayoutMode']>(() => Promise.resolve()),
    sendAgentMessage: vi.fn<HostAppAPI['sendAgentMessage']>(() => Promise.resolve()),
    sendAgentTheme: vi.fn<HostAppAPI['sendAgentTheme']>(() => Promise.resolve()),
  };
}

function makeLoadingDeps(): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() => new Promise<ConnectToHostAppResult>(() => undefined)),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

function makeConnectedDeps(api = makeApi()): AppDeps {
  return {
    connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() => Promise.resolve({ api })),
    createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
  };
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<App deps={makeLoadingDeps()} />);
    expect(screen.getByText('Loading project...')).toBeInTheDocument();
  });

  it('renders pump health dashboard with schema metadata', async () => {
    render(<App deps={makeConnectedDeps()} />);
    await waitFor(() => expect(screen.getByText('PHM Modeling for Pumps')).toBeInTheDocument());
    expect(screen.getByText('Total Pumps')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Predictions')).toBeInTheDocument();
    expect(screen.getByText('Schema Explorer')).toBeInTheDocument();
    expect(screen.getByText(/PumpModelV2 v1/)).toBeInTheDocument();

    const criticalCard = screen.getByText('Critical').closest('[data-slot="card"]');
    const warningCard = screen.getByText('Warning').closest('[data-slot="card"]');
    const healthyCard = screen.getByText('Healthy').closest('[data-slot="card"]');

    expect(criticalCard).not.toBeNull();
    expect(warningCard).not.toBeNull();
    expect(healthyCard).not.toBeNull();

    expect(within(criticalCard!).getByText('1')).toBeInTheDocument();
    expect(within(warningCard!).getByText('0')).toBeInTheDocument();
    expect(within(healthyCard!).getByText('4')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Predictions' }));
    expect(screen.getByText('Monitoring Charts')).toBeInTheDocument();
  });

  it('syncs internal state when pump selection changes', async () => {
    const api = makeApi();
    render(<App deps={makeConnectedDeps(api)} />);
    await waitFor(() => expect(screen.getByText('PHM Modeling for Pumps')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('combobox', { name: 'Select pump' }));
    await userEvent.click(screen.getByRole('option', { name: '102 - Pump 102' }));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ selectedPumpId: '102', schemaQuery: '', schemaFilter: 'all', chatDraft: '' })
    );
  });

  it('restores selected pump and schema filters from initial state', async () => {
    const api = makeApi();
    const deps: AppDeps = {
      connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() =>
        Promise.resolve({
          api,
          initialState: JSON.stringify({
            selectedPumpId: '103',
            schemaQuery: 'Prediction',
            schemaFilter: 'node',
            chatDraft: '',
          }),
        })
      ),
      createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
    };
    render(<App deps={deps} />);
    await waitFor(() => expect(screen.getByText('PHM Modeling for Pumps')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: 'Pump Overview' }));
    expect(screen.getByText('Pump 103')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Schema Explorer' }));
    expect(screen.getByDisplayValue('Prediction')).toBeInTheDocument();
    expect(screen.getByText('Pump Prediction View')).toBeInTheDocument();
  });

  it('builds a chart-driven chat prompt', () => {
    expect(
      createChartPrompt({
        pumpId: '102',
        pumpName: 'Pump 102',
        metricLabel: 'failure risk',
        metricValue: 80,
      })
    ).toContain('Pump 102 (Pump 102) has failure risk at 80.0.');
  });

  it('updates selected pump and chat draft from a chart click', async () => {
    render(<App deps={makeConnectedDeps()} />);
    await waitFor(() => expect(screen.getByText('PHM Modeling for Pumps')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('tab', { name: 'Predictions' }));
    const barChartButtons = screen.getAllByRole('button', { name: 'mock-barchart-click' });
    await userEvent.click(barChartButtons[0]);

    expect(screen.getByText('Predictions for Pump 102')).toBeInTheDocument();

    expect(screen.getByLabelText('Agent chat message')).toHaveValue(
      'Pump 102 (Pump 102) has failure risk at 80.0. Provide likely causes, immediate checks, and recommended next actions.'
    );
  });

  it('sends chat requests to Atlas AI endpoint with typed text content', async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              messages: [
                {
                  role: 'agent',
                  content: { type: 'text', text: 'mock-response' },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      render(<App deps={makeConnectedDeps()} />);
      await waitFor(() => expect(screen.getByText('PHM Modeling for Pumps')).toBeInTheDocument());

      const input = screen.getByLabelText('Agent chat message');
      await userEvent.type(input, 'test chat message');
      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      const [url, options] = fetchMock.mock.calls[0] ?? [];
      expect(String(url)).toContain('/api/v1/projects/tridcognite-sanbox/ai/agents/chat');
      expect((options?.headers as Record<string, string>)['cdf-version']).toBe('20230101-beta');

      const requestBody = JSON.parse(String(options?.body)) as {
        agentExternalId?: string;
        messages?: Array<{ role?: string; content?: { type?: string; text?: string } }>;
      };

      expect(requestBody.agentExternalId).toBe('c649e622-2350-4b86-911e-404a4974f5ae');
      expect(requestBody.agentId).toBe('c649e622-2350-4b86-911e-404a4974f5ae');
      expect(requestBody.messages?.[0]?.role).toBe('user');
      expect(requestBody.messages?.[0]?.content?.type).toBe('text');
      expect(requestBody.messages?.[0]?.content?.text).toBe('test chat message');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
