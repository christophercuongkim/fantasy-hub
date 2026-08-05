import React from 'react';
import { Button } from './Button.jsx';
import { IconButton } from './IconButton.jsx';
import { Badge } from './Badge.jsx';
import { Tag } from './Tag.jsx';
import { Avatar } from './Avatar.jsx';
import { Stat } from './Stat.jsx';

export function Demo() {
  return (
    <div className="col" style={{ gap: 'var(--space-7)' }}>
      <div className="col" style={{ gap: 'var(--space-4)' }}>
        <div className="lbl">Button · variant</div>
        <div className="row">
          <Button>Book trip</Button>
          <Button variant="secondary">Add leg</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger">Delete trip</Button>
          <Button disabled>Unavailable</Button>
          <Button loading loadingLabel="Booking…">Book</Button>
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--space-11)', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">Size · sm / md / lg</div>
          <div className="row">
            <Button size="sm" iconLeft="plus">Add</Button>
            <Button size="md" iconLeft="plus">Add</Button>
            <Button size="lg" iconRight="arrow-right">Continue</Button>
          </div>
        </div>
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">IconButton</div>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <IconButton icon="heart" label="Save" />
            <IconButton icon="heart" label="Saved" active />
            <IconButton icon="share-network" label="Share" variant="secondary" />
            <IconButton icon="dots-three" label="More" size="sm" />
            <IconButton icon="trash" label="Delete" disabled />
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--space-11)', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">Badge</div>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Badge>Draft</Badge>
            <Badge tone="accent">Selected</Badge>
            <Badge tone="success" dot>Confirmed</Badge>
            <Badge tone="warning" icon="clock">Holds 9m</Badge>
            <Badge tone="danger" variant="solid">Cancelled</Badge>
            <Badge mono tone="info">XG4K2P</Badge>
          </div>
        </div>
        <div className="col" style={{ gap: 'var(--space-4)' }}>
          <div className="lbl">Avatar</div>
          <div className="row" style={{ gap: 'var(--space-4)' }}>
            <Avatar name="Dana Okafor" size="sm" />
            <Avatar name="Marcus Reid" size="md" status="live" />
            <Avatar name="Priya Shah" size="lg" status="out" />
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 'var(--space-4)' }}>
        <div className="lbl">Tag · Stat</div>
        <div className="row" style={{ gap: 'var(--space-8)' }}>
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <Tag icon="airplane-tilt" onClick={() => {}}>Direct</Tag>
            <Tag icon="check" selected onClick={() => {}}>Under $500</Tag>
            <Tag onRemove={() => {}}>Lisbon</Tag>
          </div>
          <div className="row" style={{ gap: 'var(--space-9)' }}>
            <Stat label="Total fare" value="$412" hint="2 travellers" />
            <Stat label="Projected" value="18.4" unit="pts" delta="+2.1" />
            <Stat label="Rank" value="4" delta="-2" size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
