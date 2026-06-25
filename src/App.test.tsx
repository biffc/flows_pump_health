import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostAppAPI, ConnectToHostAppResult } from '@cognite/app-sdk';
import { CogniteClient } from '@cognite/sdk';
import type { ComponentProps } from 'react';

import App from './App';

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

  it('renders splash with deployment targets and checklist copy', async () => {
    render(<App deps={makeConnectedDeps()} />);
    await waitFor(() => expect(screen.getByText('Welcome to Flows custom apps')).toBeInTheDocument());
    expect(screen.getByText('App deployment checklist')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
    expect(screen.getByText('Deploy')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Help & feedback')).toBeInTheDocument();
    expect(screen.getByText('Your app will deploy to')).toBeInTheDocument();
    expect(screen.getByText('org')).toBeInTheDocument();
    expect(screen.getByText('and project')).toBeInTheDocument();
    expect(screen.getByText('tridiagonal.ai')).toBeInTheDocument();
    expect(screen.getByText('tridcognite-sanbox')).toBeInTheDocument();
    expect(screen.getAllByText(/SPEC\.md/).length).toBeGreaterThan(0);
    expect(screen.getByText(/apps deploy --interactive/)).toBeInTheDocument();
  });

  it('syncs internal state when the open step changes', async () => {
    const api = makeApi();
    render(<App deps={makeConnectedDeps(api)} />);
    await waitFor(() => expect(screen.getByText('App deployment checklist')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Explore'));

    expect(api.syncInternalState).toHaveBeenCalledWith(
      JSON.stringify({ openStep: 'Explore' })
    );
  });

  it('restores the open step from initial state', async () => {
    const api = makeApi();
    const deps: AppDeps = {
      connectToHostApp: vi.fn<AppDeps['connectToHostApp']>(() =>
        Promise.resolve({ api, initialState: JSON.stringify({ openStep: 'Deploy' }) })
      ),
      createClient: vi.fn<AppDeps['createClient']>((config) => new CogniteClient(config)),
    };
    render(<App deps={deps} />);
    await waitFor(() => expect(screen.getByText('App deployment checklist')).toBeInTheDocument());

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /deploy/i })).toHaveAttribute('aria-expanded', 'true')
    );
    expect(screen.getByRole('button', { name: /plan/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
