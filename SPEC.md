# Feature Specification: Pump Health

## Contributor Note

- For local development and Fusion live-refresh troubleshooting (fixed port `3003`, URL pattern, and certificate trust), see `README.md` at the repo root.

<!--
  This is your app's living product spec. Edit it directly or ask your coding
  agent to collaborate with you on it.
-->

## User Scenarios & Testing

### User Stories

- As an operations engineer, I want to inspect pump profile, maintenance, and feature values in one screen, so that I can quickly assess pump condition.
- As a reliability engineer, I want to review pump predictions with risk scores and failure events, so that I can prioritize interventions.
- As an app developer, I want to browse PumpModelV2 view schemas and field constraints, so that I can generate robust UI modules from model metadata.

### Acceptance Scenarios

- Given the app loads, when CDF model queries succeed, then the dashboard renders with live PumpModelV2 data and model identity (space, model, version).
- Given the app loads, when CDF model queries fail, then the app shows a warning and falls back to local sample data so core tabs remain usable.
- Given a pump is selected in the overview tab, when the selection changes, then profile, maintenance, and feature tables update to that pump.
- Given predictions are available for a selected pump, when the predictions tab is opened, then prediction type, score, and timestamp are visible in a table.
- Given the user opens PumpCharts and clicks a datapoint, when the click is registered, then the corresponding pump is selected and the chat draft is prefilled with a pump-specific triage prompt.
- Given schema explorer filters are used, when a user enters a query or usage filter, then only matching node/edge view cards and their fields are displayed.

## Requirements

### Functional Requirements

<!--
  List numbered functional requirements (FR-001, FR-002, …) so plans and tasks
  can reference them.
-->

- FR-001: The app MUST render a Pump Health dashboard backed by PumpModelV2 schema artifacts.
- FR-002: The app MUST provide a pump selector and display selected pump profile attributes (`pumpId`, `name`, `description`, `installDate`).
- FR-003: The app MUST display selected pump maintenance and feature records in tabular format.
- FR-004: The app MUST display prediction rows (type, score, timestamp) and failure events in a dedicated predictions view.
- FR-005: The app MUST provide a schema explorer over PumpModelV2 views with search and node/edge filtering.
- FR-006: The app MUST persist user UI state (selected pump, schema query, schema filter, chat draft) through host `syncInternalState` so reload/share restores context.
- FR-007: The app MUST support direct agent chat by calling the CDF Agent API from the frontend using host-provided base URL, project, and access token.
- FR-008: The app MUST provide a PumpCharts section in the predictions view, and chart datapoint clicks MUST select the associated pump and prefill the chat draft with a contextual troubleshooting prompt.
- FR-009: The app MUST present a dashboard shell with a top summary strip (Total Pumps, Critical, Warning, Healthy, Avg Risk) visible on initial load.
- FR-010: The app MUST render the AI chat interface as a persistent right-side panel on desktop layouts while keeping chart and drilldown content in the main left pane.

## Success Criteria

<!--
  Measurable outcomes that signal the feature is working. Prefer user-visible
  criteria over implementation details.
-->

- SC-001: Users can switch between pumps and see updated overview data in under 1 second in local runtime.
- SC-002: Users can identify the highest prediction risk for a selected pump within one interaction on the predictions tab.
- SC-003: Users can find a target view in schema explorer using text search and usage filter in at most two interactions.

## Clarifications

<!--
  Open questions or ambiguities that need to be resolved before planning.
  `/speckit.clarify` can help surface these.
-->

## Assumptions

<!-- - [Mobile support is out of scope for v1] -->

---

## Data Models & CDF Integration *(mandatory)*

<!--
  Capture how this app integrates with Cognite Data Fusion data models.
  Every Flows app should fill this in.
-->

### Existing views

<!--
  CDF views this app reads from. Format: `<space>.<view>:<version>`.
-->

- `pump_health_v2.PumpView:1`
- `pump_health_v2.SensorView:1`
- `pump_health_v2.PumpFeatureView:1`
- `pump_health_v2.PumpPredictionView:1`
- `pump_health_v2.MaintenanceEventView:1`
- `pump_health_v2.FailureEventView:1`
- `pump_health_v2.PumpTimeSeriesView:1`
- `pump_health_v2.SensorReadingView:1`
- `pump_health_v2.PumpHasSensorView:1`
- `pump_health_v2.PumpHasFeatureView:1`
- `pump_health_v2.PumpHasPredictionView:1`
- `pump_health_v2.PumpHasMaintenanceEventView:1`
- `pump_health_v2.PumpHasFailureEventView:1`

### New views

<!--
  Views this app needs that don't yet exist. Describe properties and relationships.
-->

- None for current scope. Future iteration may add consolidated `PumpHealthSummaryView` for denormalized dashboard queries.

### Spaces

<!--
  CDF spaces this app uses, and what each contains.
-->

- `pump_health_v2`: Pump fleet entities, sensor entities/readings, engineered features, predictions, maintenance/failure events, and pump relationship edges.
