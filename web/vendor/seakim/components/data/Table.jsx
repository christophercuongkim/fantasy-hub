import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';
import { EmptyState } from '../feedback/EmptyState.jsx';

/* Per spec/Table.md and decision 0003.
   Two layouts from one column definition: a table from md up, stacked list rows at
   sm. The sm layout is not a fallback — a 6-column table cannot be read on a phone,
   and horizontal scroll takes the header (and the sort control) off screen. */

const TH = {
  font: 'var(--type-eyebrow)', textTransform: 'uppercase',
  letterSpacing: 'var(--tracking-caps)', color: 'var(--text-tertiary)',
  textAlign: 'left', padding: 'var(--space-4) var(--space-5)',
  borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap',
  fontWeight: 500, background: 'var(--surface-card)',
  position: 'sticky', top: 0, zIndex: 1,
};

function cellPad(density) {
  return density === 'compact' ? '4px var(--space-5)' : 'var(--space-4) var(--space-5)';
}

function SortArrow({ state }) {
  if (state === 'none') return null;
  return (
    <Icon
      name={state === 'desc' ? 'arrow-down' : 'arrow-up'}
      size={10}
      weight={state === 'active-asc' || state === 'active-desc' ? 'fill' : 'bold'}
      style={{ marginLeft: 4 }}
    />
  );
}

function HeaderCell({ col, sort, onSort }) {
  const [hover, setHover] = useState(false);
  const isActive = sort && sort.key === col.key;
  const sortable = col.sortable !== false && !!onSort;

  let arrow = 'none';
  if (isActive) arrow = sort.dir === 'desc' ? 'active-desc' : 'active-asc';
  else if (sortable && hover) arrow = 'asc';

  return (
    <th
      scope="col"
      aria-sort={isActive ? (sort.dir === 'desc' ? 'descending' : 'ascending') : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={sortable ? () => onSort(col.key) : undefined}
      style={{
        ...TH,
        width: col.width,
        textAlign: col.numeric ? 'right' : 'left',
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        color: isActive ? 'var(--text-accent)' : hover && sortable ? 'var(--text-secondary)' : 'var(--text-tertiary)',
        transition: 'color var(--dur-instant) var(--ease-out)',
      }}
    >
      {sortable
        ? <button
            type="button"
            tabIndex={-1}
            style={{
              all: 'unset', font: 'inherit', color: 'inherit', letterSpacing: 'inherit',
              textTransform: 'inherit', cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center',
            }}
          >{col.label}<SortArrow state={arrow} /></button>
        : col.label}
    </th>
  );
}

function Row({ row, columns, density, selected, onSelect, actions }) {
  const [hover, setHover] = useState(false);
  const clickable = !!onSelect;
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={clickable ? () => onSelect(row) : undefined}
      aria-selected={selected || undefined}
      style={{
        background: selected ? 'var(--surface-selected)' : hover ? 'var(--surface-hover)' : 'transparent',
        boxShadow: selected ? 'inset 2px 0 0 var(--border-accent)' : 'none',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'var(--transition-surface)',
      }}
    >
      {columns.map(col => (
        <td
          key={col.key}
          style={{
            padding: cellPad(density),
            borderTop: '1px solid var(--border-subtle)',
            font: col.numeric ? 'var(--type-data)' : 'var(--type-body-sm)',
            fontSize: col.numeric ? 'var(--text-md)' : undefined,
            fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
            textAlign: col.numeric ? 'right' : 'left',
            color: col.identifying ? 'var(--text-primary)' : col.numeric ? 'var(--text-primary)' : 'var(--text-secondary)',
            whiteSpace: col.numeric ? 'nowrap' : undefined,
            verticalAlign: 'middle',
          }}
        >
          {col.render ? col.render(row) : row[col.key]}
        </td>
      ))}
      {actions && (
        <td style={{
          padding: cellPad(density), borderTop: '1px solid var(--border-subtle)',
          textAlign: 'right', width: 96, whiteSpace: 'nowrap',
        }}>
          {/* Revealed on hover, but focusable at all times — nothing is reachable
              only by pointer. */}
          <span
            style={{
              display: 'inline-flex', gap: 'var(--space-3)',
              opacity: hover ? 1 : 0,
              transition: 'opacity var(--dur-fast) var(--ease-out)',
            }}
            onFocusCapture={e => { e.currentTarget.style.opacity = 1; }}
            onBlurCapture={e => { if (!hover) e.currentTarget.style.opacity = 0; }}
          >
            {actions(row)}
          </span>
        </td>
      )}
    </tr>
  );
}

function ListRow({ row, columns, onSelect, actions }) {
  const id = columns.find(c => c.identifying) || columns[0];
  const figure = columns.find(c => c.numeric && c.survives);
  const secondary = columns.filter(c => c.secondary);
  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(row) : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
        minHeight: 'var(--control-h-touch)', padding: 'var(--space-4) var(--space-5)',
        background: 'transparent', border: 'none',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'left', color: 'inherit', cursor: onSelect ? 'pointer' : 'default',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ font: 'var(--type-label)', fontSize: 'var(--text-md)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {id.render ? id.render(row) : row[id.key]}
          </span>
        </span>
        {secondary.length > 0 && (
          <span style={{ display: 'block', font: 'var(--type-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {secondary.map(c => (c.render ? c.render(row) : row[c.key])).filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      {figure && (
        <span style={{ textAlign: 'right', flex: 'none' }}>
          <span style={{
            display: 'block', font: 'var(--type-data)', fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-medium)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
          }}>{figure.render ? figure.render(row) : row[figure.key]}</span>
          {figure.subLabel && (
            <span style={{ display: 'block', font: 'var(--type-caption)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {figure.subLabel(row)}
            </span>
          )}
        </span>
      )}
      {actions && <span style={{ flex: 'none' }}>{actions(row)}</span>}
      {onSelect && <Icon name="caret-right" size={14} style={{ color: 'var(--text-tertiary)', flex: 'none' }} />}
    </button>
  );
}

export function Table({
  columns, rows, bp = 'lg', density = 'comfortable',
  sort, onSort, selectedKey, rowKey = r => r.id,
  onSelectRow, actions, empty, matrix = false, caption,
}) {
  const visible = columns.filter(col => {
    if (bp === 'lg') return true;
    if (bp === 'md') return col.priority !== 3;
    return false;
  });

  if (!rows.length) {
    return (
      <div style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)' }}>
        <div style={{ padding: 'var(--space-6)' }}>
          {empty || <EmptyState compact icon="tray" title="Nothing here yet" />}
        </div>
      </div>
    );
  }

  // sm: rows change species. A matrix scrolls instead, with the identifying column
  // frozen, because comparing its columns IS the task.
  if (bp === 'sm' && !matrix) {
    return (
      <div role="list" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-card)', borderLeft: 'none', borderRight: 'none' }}>
        {rows.map(row => (
          <div role="listitem" key={rowKey(row)}>
            <ListRow row={row} columns={columns} onSelect={onSelectRow} actions={actions} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--border-subtle)',
      overflowX: matrix && bp === 'sm' ? 'auto' : undefined,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface-card)' }}>
        {caption && <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{caption}</caption>}
        <thead>
          <tr>
            {visible.map(col => (
              <HeaderCell key={col.key} col={col} sort={sort} onSort={onSort} />
            ))}
            {actions && <th style={{ ...TH, width: 96 }} aria-label="Row actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <Row
              key={rowKey(row)}
              row={row}
              columns={visible}
              density={density}
              selected={selectedKey != null && rowKey(row) === selectedKey}
              onSelect={onSelectRow}
              actions={actions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
