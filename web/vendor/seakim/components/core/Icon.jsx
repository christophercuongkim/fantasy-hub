import React from 'react';

const WEIGHT_CLASS = { regular: 'ph', bold: 'ph-bold', fill: 'ph-fill', duotone: 'ph-duotone' };

/** Phosphor icon. Requires the Phosphor web font stylesheet on the page. */
export function Icon({ name, weight = 'regular', size = 16, color, style, ...rest }) {
  return (
    <i
      className={`${WEIGHT_CLASS[weight] || 'ph'} ph-${name}`}
      aria-hidden="true"
      style={{ fontSize: size, lineHeight: 1, color: color || 'inherit', display: 'inline-block', flex: 'none', ...style }}
      {...rest}
    />
  );
}
