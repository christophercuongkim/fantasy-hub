import React, { useState } from 'react';
import { Toast } from './Toast.jsx';
import { Tooltip } from './Tooltip.jsx';
import { Popover } from './Popover.jsx';
import { Combobox } from './Combobox.jsx';
import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { Skeleton } from './Skeleton.jsx';
import { LoadingState } from './LoadingState.jsx';
import { Progress } from './Progress.jsx';
import { Disclosure } from './Disclosure.jsx';
import { Sheet } from './Sheet.jsx';
import { ListRow } from '../data/ListRow.jsx';
import { Icon } from '../core/Icon.jsx';
import { Dialog } from './Dialog.jsx';
import { Button } from '../core/Button.jsx';
import { IconButton } from '../core/IconButton.jsx';

export function Demo() {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [currency, setCurrency] = useState('EUR');
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
      <div className="col">
        <div className="lbl">Toast</div>
        <Toast message="Trip saved" tone="success" onDismiss={() => {}} />
        <Toast message="Okafor moved to bench" actionLabel="Undo" action={() => {}} onDismiss={() => {}} />
        <Toast message="Fare changed to $438 while you were deciding" tone="warning" onDismiss={() => {}} />
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>Tooltip · Dialog</div>
        <div className="row">
          <Tooltip label="Add leg"><IconButton icon="plus" label="Add leg" variant="secondary" /></Tooltip>
          <Tooltip label="Saved trips" side="right"><IconButton icon="bookmark-simple" label="Saved trips" variant="secondary" /></Tooltip>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Open dialog</Button>
          <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>Open sheet</Button>
        </div>
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>Popover</div>
        <Popover
          open
          onDismiss={() => {}}
          trigger={<Button variant="secondary" size="sm">Actions</Button>}
        >
          <div style={{ padding: 'var(--space-4)', font: 'var(--type-body-sm)', color: 'var(--text-primary)' }}>
            Rename · Duplicate · Delete
          </div>
        </Popover>
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>Combobox</div>
        <Combobox
          value={currency}
          onChanged={setCurrency}
          placeholder="Select currency"
          options={[
            { value: 'USD', label: 'US Dollar' },
            { value: 'EUR', label: 'Euro' },
            { value: 'GBP', label: 'British Pound' },
            { value: 'JPY', label: 'Japanese Yen' },
            { value: 'AUD', label: 'Australian Dollar' },
          ]}
        />
      </div>
      <div className="col">
        <div className="lbl">EmptyState</div>
        <EmptyState
          icon="airplane-tilt"
          title="No trips yet"
          description="Start with a destination and dates. Hotels and cars can come later."
          action={<Button iconLeft="plus">New trip</Button>}
        />
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>Skeleton · LoadingState</div>
        <div className="col" style={{ gap: 'var(--space-2)' }}>
          <Skeleton width="60%" height="var(--space-5)" />
          <Skeleton />
          <Skeleton width="80%" />
        </div>
        <LoadingState
          title="Checking 40 airlines…"
          description="Holding your dates while we compare fares."
          compact
        />
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>Progress</div>
        <div className="col" style={{ gap: 'var(--space-3)' }}>
          <Progress value={1} max={13} label="1 of 13" />
          <Progress value={4} max={13} label="4 of 13" />
          <Progress value={13} max={13} label="13 of 13" />
          <Progress value={62} size="md" aria-label="Uploading résumé" />
        </div>
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>Disclosure</div>
        <div className="col" style={{ gap: 0 }}>
          <Disclosure summary="Fare breakdown" meta="4 items">
            <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', margin: 0 }}>Base fare $312 · Taxes $86 · Seat $14 · Bag $0</p>
          </Disclosure>
          <Disclosure summary="Cancellation" meta="Free until 12 Mar" defaultOpen>
            <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', margin: 0 }}>Cancel for a full refund up to 24 hours before departure. After that, the fare is held as credit.</p>
          </Disclosure>
        </div>
        <div className="lbl" style={{ marginTop: 'var(--space-4)' }}>ErrorState</div>
        <ErrorState
          title="Couldn't load places"
          description="Check your connection and try again."
          compact
          onRetry={() => {}}
        />
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)}>
        <ListRow leading={<Icon name="arrow-right" size={18} />} title="Move to Applied" onClick={() => setSheet(false)} />
        <ListRow leading={<Icon name="prohibit" size={18} />} title="Skip" onClick={() => setSheet(false)} />
        <ListRow leading={<Icon name="trash" size={18} />} title="Delete" onClick={() => setSheet(false)} />
      </Sheet>
      <Dialog
        open={open}
        title="Delete this trip"
        description="Lisbon, 14–21 Mar. Bookings you have already paid for are not cancelled by this."
        onClose={() => setOpen(false)}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>Keep trip</Button>
          <Button variant="danger" onClick={() => setOpen(false)}>Delete trip</Button>
        </>}
      />
    </div>
  );
}
