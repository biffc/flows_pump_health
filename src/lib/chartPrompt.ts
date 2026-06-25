export type ChartPromptInput = {
  pumpId: string;
  pumpName: string;
  metricLabel: string;
  metricValue: number;
};

export function createChartPrompt({ pumpId, pumpName, metricLabel, metricValue }: ChartPromptInput): string {
  const formattedMetric = Number.isFinite(metricValue) ? metricValue.toFixed(1) : '0.0';
  return `Pump ${pumpId} (${pumpName}) has ${metricLabel} at ${formattedMetric}. Provide likely causes, immediate checks, and recommended next actions.`;
}
