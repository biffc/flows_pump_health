import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { connectToHostApp as connectToHostAppImpl } from '@cognite/app-sdk';
import type { HostAppAPI } from '@cognite/app-sdk';
import { CogniteSdkProvider, useCogniteSdk } from '@cognite/app-sdk/react';
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Loader,
  Separator,
} from '@cognite/aura/components';
import { IconCaretUpDown, IconRocket } from '@tabler/icons-react';

import appConfig from '../app.json';

const FLOWS_DOCUMENTATION_HREF = 'https://docs.cognite.com/cdf/flows';

const INTRO_COPY =
  "Build and deploy React apps to Cognite Data Fusion in minutes. Aura, Cognite's AI-native design system, comes pre-configured so your app looks and feels at home from day one. Follow the checklist below to get started.";

const CHECKLIST_STEPS = [
  {
    label: 'Plan',
    badge: 'Step 1',
    body: (
      <>
        Open <code>SPEC.md</code> at the repo root and describe what you want to build. If <code>.specify/</code> is
        present, run <code>/speckit.specify</code> in Claude Code or Cursor to fill it in interactively. Otherwise, ask
        your agent to collaborate on <code>SPEC.md</code> directly. Keep it simple and clear, then move on to building
        when ready.
      </>
    ),
  },
  {
    label: 'Explore',
    badge: 'Step 2',
    body: (
      <>
        Ask Cursor to review and understand your data model, then answer any follow-up questions it raises. Continue
        refining the app by providing additional input as needed.
      </>
    ),
  },
  {
    label: 'Deploy',
    badge: 'Step 3',
    body: (
      <>
        When ready to deploy, run <code>npx @cognite/cli apps deploy --interactive</code> in the terminal. Your app will
        appear in the Fusion portal under Custom apps. Run the command again to redeploy new changes.
      </>
    ),
  },
] as const;

type AppInternalState = { openStep: string | null };

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
          <AlertDescription>Failed to connect to Fusion host</AlertDescription>
        </Alert>
      </div>
    </section>
  </main>
);

type AppContentProps = { api: HostAppAPI | null; initialState?: string };

function AppContent({ api, initialState }: AppContentProps) {
  const client = useCogniteSdk();

  const deployment = appConfig.deployments?.[0];
  const orgLabel = deployment?.org ?? '';
  const projectLabel = deployment?.project ?? client.project ?? '';

  const [openStep, setOpenStep] = useState<string | null>(CHECKLIST_STEPS[0].label);

  // initialState is restored from the ?customAppInternalState search param by the host.
  useEffect(() => {
    if (!initialState) return;
    try {
      const saved = JSON.parse(initialState) as AppInternalState;
      if (typeof saved.openStep === 'string' || saved.openStep === null) {
        setOpenStep(saved.openStep);
      }
    } catch {
      // ignore malformed saved state
    }
  }, [initialState]);

  function handleStepToggle(label: string, isOpen: boolean) {
    const next = isOpen ? label : null;
    setOpenStep(next);
    // Writes to the ?customAppInternalState search param so the URL is bookmarkable/shareable.
    void api?.syncInternalState(JSON.stringify({ openStep: next } satisfies AppInternalState));
  }

  return (
    <main className="min-h-screen bg-muted/50 text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center p-4 sm:p-8">
        <Card>
          <div className="p-15 gap-16">
            <CardHeader>
              <CardTitle as="h1">Welcome to Flows custom apps</CardTitle>
              <CardDescription>{INTRO_COPY}</CardDescription>
            </CardHeader>

            <CardContent>
              <Separator />

              <div className="flex flex-col gap-6 pt-16">
                <div className="flex items-center gap-2 pt-4">
                  <IconRocket aria-hidden />
                  <span className="text-2xl font-medium">App deployment checklist</span>
                </div>

                <div className="flex flex-col gap-4 px-4">
                  {CHECKLIST_STEPS.map((step) => (
                    <Collapsible
                      key={step.label}
                      open={openStep === step.label}
                      onOpenChange={(isOpen) => handleStepToggle(step.label, isOpen)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex w-full min-w-0 items-center justify-between gap-3 text-left">
                          <span className="text-lg">{step.label}</span>
                          <span className="inline-flex shrink-0 items-center gap-2">
                            <Badge variant="mountain" background>
                              {step.badge}
                            </Badge>
                            <IconCaretUpDown aria-hidden className="size-4 text-muted-foreground" />
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="py-2">{step.body}</div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>

                <div className="mb-10">
                  <Alert variant="secondary">
                    <AlertDescription>
                      <div className="flex flex-wrap items-center gap-2 text-lg">
                        <span>Your app will deploy to</span>
                        {orgLabel ? (
                          <>
                            <span>org</span>
                            <Badge variant="nordic" background>
                              {orgLabel}
                            </Badge>
                            <span>and project</span>
                          </>
                        ) : (
                          <span>project</span>
                        )}
                        <Badge variant="nordic" background>
                          {projectLabel}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>

                <Collapsible>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex w-full min-w-0 items-center justify-between gap-3 text-left">
                      <span className="text-lg">Support</span>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        <Badge variant="mountain">
                          Help & feedback
                        </Badge>
                        <IconCaretUpDown aria-hidden className="size-4 text-muted-foreground" />
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="py-2">
                      <p>
                        For additional support and feedback, please head to{' '}
                        <a
                          href={FLOWS_DOCUMENTATION_HREF}
                          rel="noreferrer"
                          style={{ color: '#486AED' }}
                          target="_blank"
                        >
                          Flows documentation
                        </a>
                        .
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>
    </main>
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

  useEffect(() => {
    let cancelled = false;
    void connectToHostApp().then((result) => {
      if (!cancelled) setConnection(result);
    });
    return () => {
      cancelled = true;
    };
  }, [connectToHostApp]);

  return (
    <CogniteSdkProvider loadingFallback={loadingFallback} errorFallback={errorFallback} deps={deps}>
      <AppContent api={connection?.api ?? null} initialState={connection?.initialState} />
    </CogniteSdkProvider>
  );
}

export default App;
