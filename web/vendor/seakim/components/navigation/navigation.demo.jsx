import React, { useState } from 'react';
import { Tabs } from './Tabs.jsx';
import { SideNav } from './SideNav.jsx';
import { TabBar } from './TabBar.jsx';
import { Badge } from '../core/Badge.jsx';
import { Button } from '../core/Button.jsx';

export function Demo() {
  const [tab, setTab] = useState('flights');
  const [dest, setDest] = useState('lineup');
  const [day, setDay] = useState('d1');
  const DAYS = Array.from({ length: 20 }, (_, i) => ({ value: `d${i + 1}`, label: `Day ${i + 1}` }));
  return (
    <div className="col" style={{ gap: 'var(--space-7)' }}>
      <div className="col" style={{ gap: 'var(--space-4)' }}>
        <div className="lbl">Tabs</div>
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'flights', label: 'Flights', icon: 'airplane-tilt', count: 4 },
          { value: 'stays', label: 'Stays', icon: 'bed', count: 2 },
          { value: 'cars', label: 'Cars', icon: 'car' },
          { value: 'notes', label: 'Notes', icon: 'note' },
        ]} />
      </div>
      <div className="col" style={{ gap: 'var(--space-4)' }}>
        <div className="lbl">Tabs · fill, four tabs share the width</div>
        <Tabs fill value={tab} onChange={setTab} tabs={[
          { value: 'flights', label: 'Flights', icon: 'airplane-tilt', count: 4 },
          { value: 'stays', label: 'Stays', icon: 'bed', count: 2 },
          { value: 'cars', label: 'Cars', icon: 'car' },
          { value: 'notes', label: 'Notes', icon: 'note' },
        ]} />
      </div>
      <div className="col" style={{ gap: 'var(--space-4)' }}>
        <div className="lbl">Tabs · fill, twenty tabs scroll; the buttons set value from outside</div>
        <Tabs fill value={day} onChange={setDay} tabs={DAYS} />
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <Button size="sm" variant="secondary" onClick={() => setDay('d1')}>Go to day 1</Button>
          <Button size="sm" variant="secondary" onClick={() => setDay('d17')}>Go to day 17</Button>
        </div>
      </div>
      <div className="row" style={{ alignItems: 'stretch', gap: 'var(--space-8)' }}>
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">SideNav</div>
          <div style={{ height: 258, border: '1px solid var(--border-subtle)', display: 'flex' }}>
            <SideNav
              brand="Voyage"
              active="trips"
              groups={[
                { items: [
                  { value: 'trips', label: 'Trips', icon: 'suitcase-rolling', trailing: <Badge tone="accent">3</Badge> },
                  { value: 'search', label: 'Search', icon: 'magnifying-glass' },
                  { value: 'saved', label: 'Saved', icon: 'bookmark-simple' },
                ] },
                { label: 'Account', items: [
                  { value: 'billing', label: 'Billing', icon: 'credit-card' },
                ] },
              ]}
            />
            <SideNav collapsed active="trips" groups={[{ items: [
              { value: 'trips', label: 'Trips', icon: 'suitcase-rolling' },
              { value: 'search', label: 'Search', icon: 'magnifying-glass' },
              { value: 'saved', label: 'Saved', icon: 'bookmark-simple' },
            ] }]} />
          </div>
        </div>
        <div className="col" style={{ gap: 'var(--space-4)', flex: 1 }}>
          <div className="lbl">TabBar · mobile</div>
          <div style={{ width: 300, border: '1px solid var(--border-subtle)', background: 'var(--surface-page)' }} data-app="bench">
            <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
              {dest}
            </div>
            <TabBar active={dest} onChange={setDest} items={[
              { value: 'lineup', label: 'Lineup', icon: 'users-three' },
              { value: 'matchup', label: 'Matchup', icon: 'chart-bar' },
              { value: 'players', label: 'Players', icon: 'magnifying-glass' },
              { value: 'league', label: 'League', icon: 'trophy' },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
}
