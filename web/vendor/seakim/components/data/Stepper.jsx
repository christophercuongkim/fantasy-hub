import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { useMeasuredBreakpoint } from '../core/useMeasuredBreakpoint.js';

const HIDDEN = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/**
 * A labelled pipeline: every step named, the current one filled, the ones
 * behind it checked, the ones ahead outlined, a connector between. Salesforce
 * is the horizontal reference (every step labelled, current filled); Grab is
 * the vertical one (check circles, a connector, the label beside each node),
 * and it is the only pipeline any phone reference showed. So `auto` goes
 * vertical under `md`, measured on the container.
 *
 * It is a display of where something is in a known sequence. It is not a
 * wizard's progress (that is `Progress`: no reference labels wizard dots) and
 * not a status control on its own; pass `onSelect` only for the moves the app
 * allows, and the steps become buttons.
 */
export function Stepper({ steps = [], current, orientation = 'auto', onSelect, style, ...rest }) {
  const { ref, bp } = useMeasuredBreakpoint();
  const vertical = orientation === 'vertical' || (orientation === 'auto' && bp === 'sm');
  const currentIndex = steps.findIndex(s => s.key === current);
  return (
    <ol
      ref={ref}
      style={{
        display: 'flex', flexDirection: vertical ? 'column' : 'row',
        listStyle: 'none', margin: 0, padding: 0, gap: vertical ? 0 : 'var(--space-2)',
        ...style,
      }}
      {...rest}
    >
      {steps.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming';
        const first = i === 0;
        const last = i === steps.length - 1;
        const node = (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
              width: 'var(--space-7)', height: 'var(--space-7)', borderRadius: 'var(--radius-circle)',
              boxSizing: 'border-box',
              background: state === 'current' ? 'var(--fill-primary)' : state === 'done' ? 'var(--surface-selected)' : 'transparent',
              border: state === 'upcoming' ? '1px solid var(--border-strong)' : '1px solid transparent',
              color: state === 'current' ? 'var(--on-primary)' : state === 'done' ? 'var(--text-accent)' : 'var(--text-tertiary)',
              font: 'var(--type-caption)', fontFamily: 'var(--font-mono)',
              transition: 'var(--transition-control)',
            }}
          >
            {state === 'done' ? <Icon name="check" size={12} weight="bold" /> : i + 1}
          </span>
        );
        const line = (hidden, done) => (
          <span aria-hidden="true" style={{
            flex: 1, [vertical ? 'width' : 'height']: 2, minHeight: vertical ? 'var(--space-5)' : undefined,
            background: hidden ? 'transparent' : done ? 'var(--border-strong)' : 'var(--border-subtle)',
          }} />
        );
        const text = (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: vertical ? 'flex-start' : 'center', textAlign: vertical ? 'left' : 'center', minWidth: 0 }}>
            <span style={{ font: 'var(--type-label)', color: state === 'current' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{step.label}</span>
            {step.description && <span style={{ font: 'var(--type-caption)', color: 'var(--text-tertiary)' }}>{step.description}</span>}
            {state !== 'upcoming' && <span style={HIDDEN}>{state === 'done' ? 'Completed' : 'Current step'}</span>}
          </span>
        );
        const Inner = onSelect ? 'button' : 'div';
        const innerProps = onSelect ? { type: 'button', onClick: () => onSelect(step.key) } : {};
        const inner = vertical ? (
          <Inner {...innerProps} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'stretch', width: '100%', background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: onSelect ? 'pointer' : 'default' }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
              {node}
              {line(last, state === 'done')}
            </span>
            <span style={{ paddingTop: 'var(--space-1)', paddingBottom: last ? 0 : 'var(--space-6)', minWidth: 0 }}>{text}</span>
          </Inner>
        ) : (
          <Inner {...innerProps} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', width: '100%', background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: onSelect ? 'pointer' : 'default' }}>
            <span style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {line(first, state !== 'upcoming')}
              {node}
              {line(last, state === 'done')}
            </span>
            {text}
          </Inner>
        );
        return (
          <li key={step.key} aria-current={state === 'current' ? 'step' : undefined} style={{ flex: vertical ? 'none' : 1, minWidth: 0, display: 'flex' }}>
            {inner}
          </li>
        );
      })}
    </ol>
  );
}
