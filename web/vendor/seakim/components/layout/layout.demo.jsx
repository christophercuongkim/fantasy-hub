import React, { useState } from 'react';
import { PageHeader } from './PageHeader.jsx';
import { SplitPane } from './SplitPane.jsx';
import { GateLayout } from './GateLayout.jsx';
import { TopBar } from './TopBar.jsx';
import { PageBody } from './PageBody.jsx';
import { ContentRail } from './ContentRail.jsx';
import { ListRow } from '../data/ListRow.jsx';
import { ListGroup } from '../data/ListGroup.jsx';
import { Stat } from '../core/Stat.jsx';
import { Avatar } from '../core/Avatar.jsx';
import { Badge } from '../core/Badge.jsx';
import { Button } from '../core/Button.jsx';
import { IconButton } from '../core/IconButton.jsx';
import { SegmentedControl } from '../forms/SegmentedControl.jsx';
import { Select } from '../forms/Select.jsx';

const TRIPS = [
  { id: 1, city: 'Lisbon', dates: '14–21 Mar', who: 'Ada, Ravi', fare: '$412' },
  { id: 2, city: 'Kyoto', dates: '2–12 Apr', who: 'Mei', fare: '$1,180' },
  { id: 3, city: 'Oaxaca', dates: '19–26 May', who: 'Jonas, Lena, Sam', fare: '$640' },
];

export function Demo() {
  const [open, setOpen] = useState(2);
  const trip = TRIPS.find(t => t.id === open) || TRIPS[0];
  const index = TRIPS.indexOf(trip);
  const [menu, setMenu] = useState(false);
  const [under, setUnder] = useState(false);
  const balances = [
    <div key="you"><Stat label="Your balance" value="$84.50" size="sm" /><Button size="sm" style={{ marginTop: 'var(--space-4)' }}>Settle up</Button></div>,
    <div key="all" className="col" style={{ gap: 'var(--space-4)' }}><Stat label="Ada" value="-$40.00" size="sm" /><Stat label="Ravi" value="-$44.50" size="sm" /></div>,
  ];
  const feed = (
    <ListGroup heading="Activity">
      {TRIPS.map(t => <ListRow key={t.id} title={`${t.city} hotel`} meta={t.dates} trailing={t.fare} />)}
    </ListGroup>
  );
  return (
    <div className="col" style={{ gap: 'var(--space-7)' }}>
      <div>
        <div className="lbl">PageHeader</div>
        <PageHeader
          title="Trips"
          count={12}
          actions={<>
            <SegmentedControl options={['List', 'Board']} defaultValue="List" size="sm" />
            <Button iconLeft="plus">New trip</Button>
          </>}
          toolbar={<>
            <Select size="sm" options={['All trips', 'Upcoming', 'Past']} defaultValue="All trips" />
            <IconButton icon="funnel" label="Filter" variant="secondary" size="sm" />
          </>}
        />
      </div>
      <div>
        <div className="lbl">TopBar · back, a title that opens a menu, raised once content scrolls under it</div>
        <div style={{ height: 200, overflow: 'auto', background: 'var(--surface-page)' }} onScroll={e => setUnder(e.currentTarget.scrollTop > 0)}>
          <TopBar
            title="Lisbon"
            onBack={() => {}}
            onTitleClick={() => setMenu(m => !m)}
            titleMenu={<div className="col" style={{ padding: 'var(--space-4) var(--space-5)', gap: 'var(--space-3)', font: 'var(--type-body-sm)' }}><span>Trip settings</span><span>Invite people</span><span>Kyoto</span></div>}
            titleMenuOpen={menu}
            onTitleMenuDismiss={() => setMenu(false)}
            actions={<><IconButton icon="magnifying-glass" label="Search" /><IconButton icon="gear" label="Settings" /></>}
            scrolledUnder={under}
          />
          <PageBody width="list">
            <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', margin: 0, height: 400 }}>Scroll this box: the bar picks up its shadow once the page passes under it.</p>
          </PageBody>
        </div>
      </div>
      <div>
        <div className="lbl">PageBody · list ceiling (48rem), page padding outside, centred</div>
        <div style={{ background: 'var(--surface-sunken)' }}>
          <PageBody width="list">{feed}</PageBody>
        </div>
      </div>
      <div>
        <div className="lbl">ContentRail · lg: rail beside the content (a 1060px container, drawn at 62%)</div>
        <div style={{ height: 174, overflow: 'hidden' }}>
          <div style={{ width: 1060, height: 280, transform: 'scale(0.62)', transformOrigin: 'top left', background: 'var(--surface-page)' }}>
            <ContentRail content={<PageBody width="list">{feed}</PageBody>} rail={balances} />
          </div>
        </div>
      </div>
      <div>
        <div className="lbl">ContentRail · below lg: rail under the content, or hidden with railBelow false</div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div style={{ flex: 1, height: 360, background: 'var(--surface-page)' }}>
            <ContentRail content={<PageBody width="list">{feed}</PageBody>} rail={balances} />
          </div>
          <div style={{ flex: 1, height: 360, background: 'var(--surface-page)' }}>
            <ContentRail railBelow={false} content={<PageBody width="full"><span style={{ font: 'var(--type-body-sm)' }}>A chat thread; the rail is hidden.</span></PageBody>} rail={balances} />
          </div>
        </div>
      </div>
      <div>
        <div className="lbl">SplitPane · list, detail with header, aside from lg</div>
        <div style={{ height: 320, background: 'var(--surface-page)' }}>
          <SplitPane
            detailOpen={open != null}
            onBack={() => setOpen(null)}
            listWidth="16rem"
            list={
              <ListGroup heading="Trips">
                {TRIPS.map(t => (
                  <ListRow key={t.id} leading={<Avatar name={t.city} size="sm" />} title={t.city} meta={t.dates} trailing={t.fare} selected={t.id === open} onClick={() => setOpen(t.id)} />
                ))}
              </ListGroup>
            }
            detail={<>
              <SplitPane.Header
                title={trip.city}
                counter={`${index + 1} of ${TRIPS.length}`}
                onClose={() => setOpen(null)}
                onPrev={index > 0 ? () => setOpen(TRIPS[index - 1].id) : undefined}
                onNext={index < TRIPS.length - 1 ? () => setOpen(TRIPS[index + 1].id) : undefined}
              />
              <div style={{ padding: 'var(--space-6)', font: 'var(--type-body-sm)', color: 'var(--text-secondary)' }}>
                {trip.dates} with {trip.who}. Flights held; the hotel is still a plan.
              </div>
            </>}
            aside={<div className="col" style={{ padding: 'var(--space-6)', gap: 'var(--space-5)' }}><Stat label="Fare" value={trip.fare} size="sm" /><Stat label="Travellers" value={String(trip.who.split(',').length)} size="sm" /></div>}
          />
        </div>
      </div>
      <div>
        <div className="lbl">GateLayout · the gate: a 24rem card centred, footer at the bottom</div>
        <GateLayout
          brand="Voyage"
          style={{ minHeight: 420, background: 'var(--surface-sunken)' }}
          footer={<>By continuing you agree to the terms and the privacy policy.</>}
        >
          <h1 style={{ font: 'var(--type-title)', margin: 0 }}>Sign in</h1>
          <p style={{ font: 'var(--type-body-sm)', color: 'var(--text-secondary)', margin: 0 }}>Your trips, your bookings, your people.</p>
          <Button fullWidth>Continue with Google</Button>
          <Button variant="secondary" fullWidth>Continue with email</Button>
        </GateLayout>
      </div>
      <div>
        <div className="lbl">PageHeader · description, no toolbar</div>
        <PageHeader
          title="Settings"
          badge={<Badge tone="success" dot>Synced</Badge>}
          description="Account, notifications and the people who can see your trips."
          actions={<Button variant="secondary" size="sm">Sign out</Button>}
        />
      </div>
    </div>
  );
}
