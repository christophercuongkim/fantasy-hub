import React, { useState } from 'react';
import { Slider } from './Slider.jsx';
import { DatePicker } from './DatePicker.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';

export function Demo() {
  const [bp, setBp] = useState('lg');
  const [price, setPrice] = useState([380, 460]);
  const [stops, setStops] = useState(1);
  const [dates, setDates] = useState([new Date(2026, 2, 14), new Date(2026, 2, 21)]);
  const [single, setSingle] = useState(new Date(2026, 2, 4));

  return (
    <div className="col" style={{ gap: 'var(--space-7)' }}>
      <div className="col" style={{ gap: 'var(--space-3)' }}>
        <div className="lbl">Breakpoint</div>
        <SegmentedControl size="sm" value={bp} onChange={setBp} options={[
          { value: 'sm', label: 'sm' }, { value: 'md', label: 'md' }, { value: 'lg', label: 'lg' },
        ]} />
      </div>

      <div className="row" style={{ gap: 'var(--space-11)', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 'var(--space-6)', width: 300 }}>
          <div className="lbl">Slider</div>
          <Slider
            range label="Price range" min={200} max={800} step={10}
            value={price} onChange={setPrice} format={v => '$' + v}
          />
          <Slider
            label="Max stops" min={0} max={3} step={1} ticks
            value={stops} onChange={setStops}
            format={v => v === 0 ? 'Direct only' : v + (v === 1 ? ' stop' : ' stops')}
          />
          <Slider label="Unavailable" min={0} max={10} value={4} disabled />
        </div>

        <div className="col" style={{ gap: 'var(--space-6)', flex: 1, minWidth: 320 }}>
          <div className="lbl">Date range · click the calendar button</div>
          <DatePicker range label="Trip dates" value={dates} onChange={setDates} bp={bp} />
          <DatePicker
            label="Single date" value={single} onChange={setSingle} bp={bp}
            hint="Or type it — YYYY-MM-DD"
          />
        </div>
      </div>
    </div>
  );
}
