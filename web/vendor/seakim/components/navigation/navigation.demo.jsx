import React, { useState } from 'react';
import { Tabs } from './Tabs.jsx';
import { SideNav } from './SideNav.jsx';
import { TabBar } from './TabBar.jsx';
import { Badge } from '../core/Badge.jsx';

export function Demo() {
  const [tab, setTab] = useState('flights');
  const [dest, setDest] = useState('lineup');
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
