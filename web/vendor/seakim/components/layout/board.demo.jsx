import React from 'react';
import { Board, BoardColumn } from './Board.jsx';
import { Card } from '../core/Card.jsx';
import { Tag } from '../core/Tag.jsx';
import { Button } from '../core/Button.jsx';
import { IconButton } from '../core/IconButton.jsx';

const CARDS = [
  { id: 1, company: 'Northwind Labs', title: 'Senior frontend engineer', chip: '91 · pursue', days: '1 day here' },
  { id: 2, company: 'Lumen Works', title: 'Staff engineer, platform', chip: '84 · pursue', days: '3 days here' },
  { id: 3, company: 'Harbor Health', title: 'Product engineer', chip: '79 · consider', days: '6 days here' },
];

function Posting({ p }) {
  return (
    <Card interactive eyebrow={p.company} title={p.title} meta={p.days} padding="var(--space-5)" onClick={() => {}}>
      <Tag>{p.chip}</Tag>
    </Card>
  );
}

const add = <Button variant="ghost" size="sm" iconLeft="plus">Add</Button>;
const menu = <IconButton icon="dots-three" label="Column menu" variant="ghost" size="sm" />;

export function Demo() {
  return (
    <div className="col" style={{ gap: 'var(--space-7)' }}>
      <div>
        <div className="lbl">Board · the default: empty columns collapsed</div>
        <Board columnWidth="16rem">
          <BoardColumn label="Pursuing" count={3} tone="accent" menu={menu} footer={add}>
            {CARDS.map(p => <Posting key={p.id} p={p} />)}
          </BoardColumn>
          <BoardColumn label="Applied" count={1} footer={add}>
            <Posting p={{ id: 4, company: 'Vantage', title: 'Engineering manager', chip: 'applied Oct 3', days: '9 days here' }} />
          </BoardColumn>
          <BoardColumn label="Phone screen" count={0} footer={add} />
          <BoardColumn label="Offer" count={0} footer={add} />
        </Board>
      </div>
      <div>
        <div className="lbl">Board · collapseEmpty={false}: every column open</div>
        <Board columnWidth="16rem" collapseEmpty={false}>
          <BoardColumn label="Pursuing" count={1} footer={add}>
            <Posting p={CARDS[0]} />
          </BoardColumn>
          <BoardColumn label="Applied" count={0} />
          <BoardColumn label="Phone screen" count={0} />
          <BoardColumn label="Onsite" count={1} footer={add}>
            <Posting p={CARDS[2]} />
          </BoardColumn>
        </Board>
      </div>
    </div>
  );
}
