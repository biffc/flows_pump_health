export type ViewUsage = 'node' | 'edge';

export type ViewFieldType = 'text' | 'timestamp' | 'float64';

export type ViewField = {
  name: string;
  type: ViewFieldType;
  nullable: boolean;
};

export type ViewSchema = {
  externalId: string;
  title: string;
  description: string;
  usedFor: ViewUsage;
  writable: boolean;
  fields: ViewField[];
};

export type Pump = {
  externalId: string;
  pumpId: string;
  name: string;
  description: string;
  installDate: string | null;
};

export type Sensor = {
  externalId: string;
  sensorName: string;
  sensorType: string | null;
  unit: string;
};

export type PumpFeature = {
  externalId: string;
  featureId: string;
  pumpId: string;
  name: string;
  value: string;
  timestamp: string | null;
};

export type PumpPrediction = {
  externalId: string;
  predictionId: string;
  pumpId: string;
  predictionType: string;
  predictionValue: number;
  timestamp: string;
};

export type MaintenanceEvent = {
  externalId: string;
  eventId: string;
  pumpId: string;
  maintenanceType: string;
  description: string;
  timestamp: string;
};

export type FailureEvent = {
  externalId: string;
  eventId: string;
  failureType: string;
  severity: string;
  description: string;
  timestamp: string;
};

export type SensorReading = {
  externalId: string;
  sensorId: string;
  value: number;
  status: string | null;
  timestamp: string;
};

export const modelMetadata = {
  space: 'pump_health_v2',
  externalId: 'PumpModelV2',
  version: '1',
  name: 'Pump Health Model V2',
};

export const viewSchemas: ViewSchema[] = [
  {
    externalId: 'PumpView',
    title: 'Pump View',
    description: 'View exposing pump properties',
    usedFor: 'node',
    writable: false,
    fields: [
      { name: 'pumpId', type: 'text', nullable: false },
      { name: 'name', type: 'text', nullable: false },
      { name: 'description', type: 'text', nullable: true },
      { name: 'installDate', type: 'timestamp', nullable: true },
    ],
  },
  {
    externalId: 'SensorView',
    title: 'Sensor View',
    description: 'View exposing sensor properties',
    usedFor: 'node',
    writable: false,
    fields: [
      { name: 'unit', type: 'text', nullable: false },
      { name: 'sensorName', type: 'text', nullable: false },
      { name: 'sensorType', type: 'text', nullable: true },
      { name: 'installationDate', type: 'timestamp', nullable: true },
    ],
  },
  {
    externalId: 'PumpFeatureView',
    title: 'Pump Feature View',
    description: 'View exposing pump feature properties',
    usedFor: 'node',
    writable: true,
    fields: [
      { name: 'featureId', type: 'text', nullable: false },
      { name: 'name', type: 'text', nullable: false },
      { name: 'value', type: 'text', nullable: false },
      { name: 'pumpId', type: 'text', nullable: false },
      { name: 'timestamp', type: 'timestamp', nullable: true },
    ],
  },
  {
    externalId: 'PumpPredictionView',
    title: 'Pump Prediction View',
    description: 'View exposing pump prediction properties',
    usedFor: 'node',
    writable: true,
    fields: [
      { name: 'predictionId', type: 'text', nullable: false },
      { name: 'pumpId', type: 'text', nullable: false },
      { name: 'predictionType', type: 'text', nullable: false },
      { name: 'predictionValue', type: 'float64', nullable: false },
      { name: 'timestamp', type: 'timestamp', nullable: false },
    ],
  },
  {
    externalId: 'MaintenanceEventView',
    title: 'Maintenance Event View',
    description: 'View exposing maintenance event properties',
    usedFor: 'node',
    writable: true,
    fields: [
      { name: 'eventId', type: 'text', nullable: false },
      { name: 'timestamp', type: 'timestamp', nullable: false },
      { name: 'maintenanceType', type: 'text', nullable: false },
      { name: 'description', type: 'text', nullable: false },
      { name: 'pumpId', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'FailureEventView',
    title: 'Failure Event View',
    description: 'View exposing failure event properties',
    usedFor: 'node',
    writable: true,
    fields: [
      { name: 'eventId', type: 'text', nullable: false },
      { name: 'timestamp', type: 'timestamp', nullable: false },
      { name: 'failureType', type: 'text', nullable: false },
      { name: 'severity', type: 'text', nullable: false },
      { name: 'description', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'PumpTimeSeriesView',
    title: 'Pump Time Series View',
    description: 'View for pump-related time series metadata',
    usedFor: 'node',
    writable: true,
    fields: [
      { name: 'pumpId', type: 'text', nullable: false },
      { name: 'sensorId', type: 'text', nullable: false },
      { name: 'description', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'SensorReadingView',
    title: 'Sensor Reading View',
    description: 'View exposing sensor reading properties',
    usedFor: 'node',
    writable: false,
    fields: [
      { name: 'sensorId', type: 'text', nullable: false },
      { name: 'timestamp', type: 'timestamp', nullable: false },
      { name: 'value', type: 'float64', nullable: false },
      { name: 'status', type: 'text', nullable: true },
    ],
  },
  {
    externalId: 'PumpHasSensorView',
    title: 'Pump Has Sensor View',
    description: 'View exposing Pump -> Sensor relationship',
    usedFor: 'edge',
    writable: true,
    fields: [
      { name: 'startNode', type: 'text', nullable: false },
      { name: 'endNode', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'PumpHasFeatureView',
    title: 'Pump Has Feature View',
    description: 'View exposing Pump -> Feature relationship',
    usedFor: 'edge',
    writable: true,
    fields: [
      { name: 'startNode', type: 'text', nullable: false },
      { name: 'endNode', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'PumpHasPredictionView',
    title: 'Pump Has Prediction View',
    description: 'View exposing Pump -> Prediction relationship',
    usedFor: 'edge',
    writable: true,
    fields: [
      { name: 'startNode', type: 'text', nullable: false },
      { name: 'endNode', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'PumpHasMaintenanceEventView',
    title: 'Pump Has Maintenance Event View',
    description: 'View exposing Pump -> MaintenanceEvent relationship',
    usedFor: 'edge',
    writable: true,
    fields: [
      { name: 'startNode', type: 'text', nullable: false },
      { name: 'endNode', type: 'text', nullable: false },
    ],
  },
  {
    externalId: 'PumpHasFailureEventView',
    title: 'Pump Has Failure Event View',
    description: 'View exposing Pump -> FailureEvent relationship',
    usedFor: 'edge',
    writable: true,
    fields: [
      { name: 'startNode', type: 'text', nullable: false },
      { name: 'endNode', type: 'text', nullable: false },
    ],
  },
];

export const pumps: Pump[] = [
  {
    externalId: 'pump_101',
    pumpId: '101',
    name: 'Pump 101',
    description: 'Primary feed pump',
    installDate: '2020-01-15T00:00:00+00:00',
  },
  {
    externalId: 'pump_102',
    pumpId: '102',
    name: 'Pump 102',
    description: 'Backup pump for Unit B',
    installDate: '2019-06-10T00:00:00+00:00',
  },
  {
    externalId: 'pump_103',
    pumpId: '103',
    name: 'Pump 103',
    description: 'General service pump',
    installDate: '2021-03-22T00:00:00+00:00',
  },
  {
    externalId: 'pump_104',
    pumpId: '104',
    name: 'Pump 104',
    description: 'Chemical dosing pump',
    installDate: '2018-11-05T00:00:00+00:00',
  },
  {
    externalId: 'pump_105',
    pumpId: '105',
    name: 'Pump 105',
    description: 'New installation for expansion',
    installDate: '2022-08-30T00:00:00+00:00',
  },
];

export const sensors: Sensor[] = [
  {
    externalId: 'sensor_101_vibration_rms',
    sensorName: 'vibration_rms sensor for pump 101',
    sensorType: 'vibration_rms',
    unit: '',
  },
  {
    externalId: 'sensor_101_motor_current',
    sensorName: 'motor_current sensor for pump 101',
    sensorType: 'motor_current',
    unit: '',
  },
  {
    externalId: 'sensor_101_discharge_pressure',
    sensorName: 'discharge_pressure sensor for pump 101',
    sensorType: 'discharge_pressure',
    unit: '',
  },
  {
    externalId: 'sensor_101_suction_pressure',
    sensorName: 'suction_pressure sensor for pump 101',
    sensorType: 'suction_pressure',
    unit: '',
  },
  {
    externalId: 'sensor_101_flow_rate',
    sensorName: 'flow_rate sensor for pump 101',
    sensorType: 'flow_rate',
    unit: '',
  },
];

export const pumpFeatures: PumpFeature[] = [
  {
    externalId: 'feature_101_flow_rate',
    featureId: 'feature_101_flow_rate',
    pumpId: '101',
    name: 'Flow Rate',
    value: '150',
    timestamp: '2026-06-11T12:00:00+00:00',
  },
  {
    externalId: 'feature_101_pressure',
    featureId: 'feature_101_pressure',
    pumpId: '101',
    name: 'Discharge Pressure',
    value: '85',
    timestamp: '2026-06-11T12:00:00+00:00',
  },
  {
    externalId: 'feature_101_temperature',
    featureId: 'feature_101_temperature',
    pumpId: '101',
    name: 'Bearing Temperature',
    value: '72',
    timestamp: '2026-06-11T12:00:00+00:00',
  },
  {
    externalId: 'feature_102_flow_rate',
    featureId: 'feature_102_flow_rate',
    pumpId: '102',
    name: 'Flow Rate',
    value: '120',
    timestamp: '2026-06-11T12:00:00+00:00',
  },
  {
    externalId: 'feature_102_vibration',
    featureId: 'feature_102_vibration',
    pumpId: '102',
    name: 'Vibration Level',
    value: '8.5',
    timestamp: '2026-06-11T12:00:00+00:00',
  },
];

export const pumpPredictions: PumpPrediction[] = [
  {
    externalId: 'prediction_101_2025-01-01T00_00_00Z',
    predictionId: 'prediction_101_2025-01-01T00_00_00Z',
    pumpId: '101',
    predictionType: 'healthy',
    predictionValue: 0.01,
    timestamp: '2025-01-01T00:00:00+00:00',
  },
  {
    externalId: 'prediction_103_2025-01-01T07_00_00Z',
    predictionId: 'prediction_103_2025-01-01T07_00_00Z',
    pumpId: '103',
    predictionType: 'degrading',
    predictionValue: 0.1,
    timestamp: '2025-01-01T07:00:00+00:00',
  },
  {
    externalId: 'prediction_102_2025-01-02T00_00_00Z',
    predictionId: 'prediction_102_2025-01-02T00_00_00Z',
    pumpId: '102',
    predictionType: 'failure_soon',
    predictionValue: 0.8,
    timestamp: '2025-01-02T00:00:00+00:00',
  },
  {
    externalId: 'prediction_101_healthy_2026-06-05T20_36_34Z',
    predictionId: 'prediction_101_healthy_2026-06-05T20_36_34Z',
    pumpId: '101',
    predictionType: 'healthy',
    predictionValue: 0.92,
    timestamp: '2026-06-05T20:36:34+00:00',
  },
  {
    externalId: 'prediction_101_degrading_2026-06-05T20_36_34Z',
    predictionId: 'prediction_101_degrading_2026-06-05T20_36_34Z',
    pumpId: '101',
    predictionType: 'degrading',
    predictionValue: 0.07,
    timestamp: '2026-06-05T20:36:34+00:00',
  },
];

export const maintenanceEvents: MaintenanceEvent[] = [
  {
    externalId: 'maintenance_ME-001',
    eventId: 'ME-001',
    pumpId: '101',
    maintenanceType: 'Inspection',
    description: 'Routine inspection',
    timestamp: '2024-12-15T08:00:00+00:00',
  },
  {
    externalId: 'maintenance_ME-002',
    eventId: 'ME-002',
    pumpId: '103',
    maintenanceType: 'Repair',
    description: 'Seal replacement',
    timestamp: '2024-11-02T12:00:00+00:00',
  },
];

export const failureEvents: FailureEvent[] = [
  {
    externalId: 'failure_F001',
    eventId: 'F001',
    failureType: 'Bearing Failure',
    severity: 'Unknown',
    description: 'High vibration detected',
    timestamp: '2025-01-02T00:00:00+00:00',
  },
  {
    externalId: 'failure_F002',
    eventId: 'F002',
    failureType: 'Motor Failure',
    severity: 'Unknown',
    description: 'Overcurrent trip',
    timestamp: '2025-01-03T04:00:00+00:00',
  },
];

export const sensorReadings: SensorReading[] = [
  {
    externalId: 'reading_101_vibration_rms_2025-01-01T00:00:00Z',
    sensorId: 'sensor_101_vibration_rms',
    value: 1.5,
    status: 'ALERT',
    timestamp: '2025-01-01T00:00:00+00:00',
  },
  {
    externalId: 'reading_101_motor_current_2025-01-01T00:00:00Z',
    sensorId: 'sensor_101_motor_current',
    value: 81.1,
    status: 'ALERT',
    timestamp: '2025-01-01T00:00:00+00:00',
  },
  {
    externalId: 'reading_101_discharge_pressure_2025-01-01T00:00:00Z',
    sensorId: 'sensor_101_discharge_pressure',
    value: 147.7,
    status: 'ALERT',
    timestamp: '2025-01-01T00:00:00+00:00',
  },
  {
    externalId: 'reading_101_suction_pressure_2025-01-01T00:00:00Z',
    sensorId: 'sensor_101_suction_pressure',
    value: 100,
    status: 'ALERT',
    timestamp: '2025-01-01T00:00:00+00:00',
  },
  {
    externalId: 'reading_101_flow_rate_2025-01-01T00:00:00Z',
    sensorId: 'sensor_101_flow_rate',
    value: 131.4,
    status: 'ALERT',
    timestamp: '2025-01-01T00:00:00+00:00',
  },
];