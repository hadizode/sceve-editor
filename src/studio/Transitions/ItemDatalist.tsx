import { useMemo } from 'react';
import { obtainableItems } from '../../shared/validation';
import { useRooms } from './hooks';

/** Autocomplete list of item ids that something in the project actually grants. */
export function ItemDatalist() {
  const rooms = useRooms();
  const ids = useMemo(() => [...obtainableItems(rooms)].sort(), [rooms]);
  return (
    <datalist id="item-ids">
      {ids.map((i) => <option key={i} value={i} />)}
    </datalist>
  );
}
