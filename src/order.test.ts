import { createStableOrder } from './order';

interface Row { id: string; at: number }

const newestFirst = (a: Row, b: Row): number => b.at - a.at;
const ids = (rows: Row[]): string[] => rows.map((r) => r.id);

describe('createStableOrder', () => {
  it('sorts what it sees first', () => {
    const order = createStableOrder<Row>((r) => r.id, newestFirst);
    expect(ids(order([{ id: 'a', at: 1 }, { id: 'b', at: 3 }, { id: 'c', at: 2 }]))).toEqual(['b', 'c', 'a']);
  });

  it('keeps shown rows in place and adds newer finds after them, sorted among themselves', () => {
    const order = createStableOrder<Row>((r) => r.id, newestFirst);
    order([{ id: 'a', at: 1 }, { id: 'b', at: 3 }]);
    const next = order([{ id: 'a', at: 1 }, { id: 'b', at: 3 }, { id: 'c', at: 9 }, { id: 'd', at: 5 }]);
    expect(ids(next)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('drops rows that are gone without moving the rest', () => {
    const order = createStableOrder<Row>((r) => r.id, newestFirst);
    order([{ id: 'a', at: 1 }, { id: 'b', at: 3 }, { id: 'c', at: 2 }]);
    expect(ids(order([{ id: 'a', at: 1 }, { id: 'b', at: 3 }]))).toEqual(['b', 'a']);
  });

  it('does not reorder when called again with the same rows', () => {
    const order = createStableOrder<Row>((r) => r.id, newestFirst);
    const rows = [{ id: 'a', at: 1 }, { id: 'b', at: 3 }];
    expect(ids(order(rows))).toEqual(ids(order(rows)));
  });
});
