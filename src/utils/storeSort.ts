import { Store } from '../models/store';

type SortableStore = Pick<Store, 'isOpen' | 'name'> & { distance?: number };

const distanceOf = (store: SortableStore): number =>
  typeof store.distance === 'number' && Number.isFinite(store.distance)
    ? store.distance
    : Number.POSITIVE_INFINITY;

/**
 * Nearby lists must read predictably: every open store comes before every
 * closed store, then the closest stores come first inside each group.
 */
export const sortStoresByAvailabilityAndDistance = <T extends SortableStore>(
  stores: T[]
): T[] =>
  [...stores].sort((a, b) => {
    const openA = a.isOpen !== false;
    const openB = b.isOpen !== false;
    if (openA !== openB) return openA ? -1 : 1;

    const distanceA = distanceOf(a);
    const distanceB = distanceOf(b);
    if (distanceA !== distanceB) return distanceA - distanceB;

    return a.name.localeCompare(b.name);
  });
