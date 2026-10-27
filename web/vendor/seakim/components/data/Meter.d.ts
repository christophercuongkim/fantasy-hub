import * as React from 'react';

/**
 * A labelled measurement: label above-left, value above-right in mono, a thin bar
 * beneath. Never animates. One accent fill, no thresholds. `role="meter"`.
 */
export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value, clamped to `0..max`. */
  value?: number;
  /** Defaults to 1. */
  max?: number;
  /** What is measured: "Skills", "Seniority". Required; it labels the bar. */
  label: React.ReactNode;
  /** The figure shown right of the label. Defaults to the percentage. */
  valueText?: string;
  /** `sm` is a 4px track (default); `md` is 8px. */
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}
export declare function Meter(props: MeterProps): JSX.Element;
