import React, { useState } from 'react';
import { Table } from './Table.jsx';
import { Range } from './Range.jsx';
import { Badge } from '../core/Badge.jsx';
import { Avatar } from '../core/Avatar.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { SegmentedControl } from '../forms/SegmentedControl.jsx';

// A projection column of Range glyphs, one shared domain. Grey by default;
// the hovered row is promoted — never the selected row (0003 owns that accent).
const PROJECTIONS = [
  { id: 1, name: 'Chase', low: 12.1, mid: 18.4, high: 24.0 },
  { id: 2, name: 'Robinson', low: 5.2, mid: 12.6, high: 22.8 },
  { id: 3, name: 'Njoku', low: 15.6, mid: 17.1, high: 18.9 },
  { id: 4, name: 'Vrba', low: 2.0, mid: 6.1, high: 14.5 },
];

const STARTERS = [
  { id: 1, slot: 'PG', name: 'Dana Okafor', pos: 'PG', team: 'ATL', matchup: 'vs MIA', live: '24.6', proj: '18.4', own: '68%' },
  { id: 2, slot: 'SG', name: 'Theo Lindqvist', pos: 'SG', team: 'BOS', matchup: '@ NYK', live: '11.2', proj: '14.8', own: '54%' },
  { id: 3, slot: 'SF', name: 'Marcus Reid', pos: 'SF', team: 'DEN', matchup: 'vs PHX', live: '0.0', proj: '21.1', own: '91%', flag: 'Q' },
  { id: 4, slot: 'C', name: 'Nikola Vrba', pos: 'C', team: 'ORL', matchup: 'vs CHI', live: '0.0', proj: '0.0', own: '44%', flag: 'Out' },
];

export function Demo() {
  const [bp, setBp] = useState('lg');
  const [density, setDensity] = useState('comfortable');
  const [sort, setSort] = useState({ key: 'live', dir: 'desc' });
  const [selected, setSelected] = useState(2);
  const [hovered, setHovered] = useState(null);

  const columns = [
    { key: 'slot', label: 'Slot', width: 48, sortable: false },
    {
      key: 'name', label: 'Player', identifying: true,
      render: r => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Avatar name={r.name} size="sm" />
          {r.name}
          {r.flag && <Badge tone={r.flag === 'Out' ? 'danger' : 'warning'}>{r.flag}</Badge>}
        </span>
      ),
    },
    { key: 'matchup', label: 'Matchup', secondary: true, priority: 3, render: r => `${r.pos} · ${r.team} · ${r.matchup}` },
    { key: 'live', label: 'Live', numeric: true, survives: true, subLabel: r => `proj ${r.proj}` },
    { key: 'proj', label: 'Proj', numeric: true, priority: 3 },
    { key: 'own', label: 'Owned', numeric: true, priority: 3 },
  ];

  return (
    <div className="col" style={{ gap: 'var(--space-6)' }}>
      <div className="row" style={{ gap: 'var(--space-7)' }}>
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <div className="lbl">Breakpoint</div>
          <SegmentedControl size="sm" value={bp} onChange={setBp} options={[
            { value: 'sm', label: 'sm' }, { value: 'md', label: 'md' }, { value: 'lg', label: 'lg' },
          ]} />
        </div>
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <div className="lbl">Density</div>
          <SegmentedControl size="sm" value={density} onChange={setDensity} options={[
            { value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' },
          ]} />
        </div>
      </div>

      <div style={{ maxWidth: bp === 'sm' ? 380 : '100%' }}>
        <Table
          columns={columns}
          rows={STARTERS}
          bp={bp}
          density={density}
          sort={sort}
          onSort={key => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))}
          selectedKey={selected}
          onSelectRow={r => setSelected(r.id)}
          actions={r => (
            <>
              <IconButton icon="arrows-left-right" label={`Swap ${r.name}`} size="sm" />
              <IconButton icon="trash" label={`Drop ${r.name}`} size="sm" />
            </>
          )}
          caption="Starting lineup for week 14"
        />
      </div>

      <div style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)', maxWidth: '64ch' }}>
        At <code>md</code> the three <code>priority: 3</code> columns drop. At <code>sm</code>
        rows change species — matchup joins the secondary line, Live survives as the figure,
        and hover actions become reachable inline.
      </div>

      <div className="col" style={{ gap: 'var(--space-3)', maxWidth: 300 }}>
        <div className="lbl">Range · a projection column, one shared domain</div>
        {PROJECTIONS.map(p => (
          <div
            key={p.id}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(h => (h === p.id ? null : h))}
            style={{ display: 'grid', gridTemplateColumns: '4.5ch 1fr 3.5ch', alignItems: 'center', gap: 'var(--space-3)', font: 'var(--type-caption)', color: 'var(--text-secondary)' }}
          >
            <span>{p.name}</span>
            <Range
              low={p.low}
              mid={p.mid}
              high={p.high}
              domain={[0, 30]}
              accent={hovered === p.id}
              label={`${p.name}: floor ${p.low}, projected ${p.mid}, ceiling ${p.high}`}
            />
            <span style={{ font: 'var(--font-mono)', textAlign: 'right' }}>{p.mid}</span>
          </div>
        ))}
        <div style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>
          Njoku's tight band is the safe start; Robinson's wide one is boom-or-bust. Same
          projected figure, different risk — the shape carries what the number can't. Hover
          promotes one row's band; the exact figures stay in the adjacent cell.
        </div>
      </div>
    </div>
  );
}
