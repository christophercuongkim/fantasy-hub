import React from 'react';
import { Field } from './Field.jsx';
import { Input } from './Input.jsx';
import { Textarea } from './Textarea.jsx';
import { Select } from './Select.jsx';
import { Checkbox } from './Checkbox.jsx';
import { Radio } from './Radio.jsx';
import { Switch } from './Switch.jsx';
import { SegmentedControl } from './SegmentedControl.jsx';

export function Demo() {
  return (
    <div className="grid" style={{ gridTemplateColumns: '1.1fr 1fr 1fr', alignItems: 'start', gap: 'var(--space-7)' }}>
      <div className="col">
        <Field label="Where to" hint="City or airport code" htmlFor="d1">
          <Input id="d1" iconLeft="magnifying-glass" placeholder="Lisbon, LIS" />
        </Field>
        <Field label="Confirmation code" error="No booking matches that code." htmlFor="d2">
          <Input id="d2" mono invalid defaultValue="XG4K2Q" />
        </Field>
        <Field label="Cabin" htmlFor="d3">
          <Select id="d3" options={['Economy', 'Premium economy', 'Business', 'First']} defaultValue="Premium economy" />
        </Field>
        <Field label="Notes for the driver" hint="Optional">
          <Textarea rows={2} placeholder="Gate code, floor, anything useful" />
        </Field>
      </div>

      <div className="col">
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <div className="lbl">SegmentedControl</div>
          <SegmentedControl size="sm" options={['One way', 'Round trip']} defaultValue="Round trip" fullWidth />
          <SegmentedControl size="sm" fullWidth options={[
            { value: 'list', label: 'List', icon: 'rows' },
            { value: 'map', label: 'Map', icon: 'map-trifold' },
          ]} />
        </div>
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <div className="lbl">Input · sizes</div>
          <Input size="sm" mono suffix="USD" defaultValue="412.00" />
          <Input size="md" placeholder="Disabled" disabled />
        </div>
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <div className="lbl">Radio</div>
          <Radio name="cx" defaultValue="flex" options={[
            { value: 'basic', label: 'Non-refundable', hint: 'Cheapest. No changes.' },
            { value: 'flex', label: 'Flexible', hint: '+$48. One free change.' },
          ]} />
        </div>
      </div>

      <div className="col">
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">Checkbox</div>
          <Checkbox label="Direct flights only" defaultChecked />
          <Checkbox label="Nearby airports" hint="Adds SJC and OAK" />
          <Checkbox label="All cabins" indeterminate />
          <Checkbox label="Unavailable" disabled />
        </div>
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">Switch</div>
          <Switch label="Price alerts" hint="Email me when this fare drops" defaultChecked />
          <Switch label="Share with Priya" />
        </div>
      </div>
    </div>
  );
}
