import { get as idbGet, set, del, keys } from "idb-keyval";
import type {
  ClosetItem,
  WigItem,
  HairProfile,
  GeneratedLook,
  WishlistItem,
  Trip,
  UpcomingPlan,
  ColorProfile,
  StyleProfile,
  StyleInspiration,
  UserMeasurements,
} from "./types";

// ---- id + prefix helpers -------------------------------------------------

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PREFIX = {
  closet: "closet:",
  wig: "wig:",
  look: "look:",
  wishlist: "wishlist:",
  trip: "trip:",
  plan: "plan:",
  inspiration: "inspiration:",
} as const;

const SINGLETON_KEY = {
  hairProfile: "hair-profile",
  colorProfile: "color-profile",
  styleProfile: "style-profile",
  measurements: "user-measurements",
} as const;

/**
 * Generic collection helper. Every collection (closet, wigs, looks, etc.)
 * follows the same create / list / update / delete shape, so we implement
 * it once instead of duplicating the idb-keyval calls per entity.
 *
 * Defensive by default: getAll() always returns an array (`|| []`), never
 * throws on a missing/corrupt key, and skips null entries rather than
 * crashing the caller's render.
 *
 * `timestampField` lets callers use a domain-specific name (e.g.
 * WishlistItem's `addedAt`) instead of forcing every entity onto a
 * literal `createdAt` field.
 */
function createCollection<
  T extends { id: string },
  TimestampField extends keyof T = "createdAt" extends keyof T
    ? "createdAt"
    : keyof T
>(
  prefix: string,
  timestampField: TimestampField,
  sortFn?: (a: T, b: T) => number
) {
  const defaultSort = (a: T, b: T) =>
    (b[timestampField] as unknown as number) -
    (a[timestampField] as unknown as number);
  const sort = sortFn || defaultSort;

  return {
    async create(
      item: Omit<T, "id" | TimestampField>
    ): Promise<T> {
      const full = {
        ...item,
        id: makeId(),
        [timestampField]: Date.now(),
      } as unknown as T;
      await set(prefix + full.id, full);
      return full;
    },

    async getAll(): Promise<T[]> {
      try {
        const allKeys = (await keys()) || [];
        const matched = allKeys.filter(
          (k) => typeof k === "string" && k.startsWith(prefix)
        );
        const items = await Promise.all(
          matched.map((k) => idbGet(k as string).catch(() => null))
        );
        return ((items || []).filter(Boolean) as T[]).sort(sort);
      } catch {
        return [];
      }
    },

    async getById(id: string): Promise<T | undefined> {
      try {
        const item = await idbGet(prefix + id);
        return item || undefined;
      } catch {
        return undefined;
      }
    },

    async update(item: T): Promise<void> {
      await set(prefix + item.id, item);
    },

    async remove(id: string): Promise<void> {
      await del(prefix + id);
    },
  };
}

/**
 * Helper for single-record ("singleton") stores like hair/color/style
 * profile, which have exactly one value rather than a keyed collection.
 */
function createSingleton<T>(key: string) {
  return {
    async save(value: T): Promise<void> {
      await set(key, value);
    },
    async get(): Promise<T | undefined> {
      try {
        const value = await idbGet(key);
        return value || undefined;
      } catch {
        return undefined;
      }
    },
  };
}

// ---- collections ----------------------------------------------------------

export const closetStore = createCollection<ClosetItem>(
  PREFIX.closet,
  "createdAt"
);
export const wigStore = createCollection<WigItem>(PREFIX.wig, "createdAt");
export const lookStore = createCollection<GeneratedLook>(
  PREFIX.look,
  "createdAt"
);
export const wishlistStore = createCollection<WishlistItem>(
  PREFIX.wishlist,
  "addedAt",
  (a, b) => b.addedAt - a.addedAt
);
export const tripStore = createCollection<Trip>(PREFIX.trip, "createdAt");
export const planStore = createCollection<UpcomingPlan>(
  PREFIX.plan,
  "createdAt",
  (a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    return a.createdAt - b.createdAt;
  }
);
export const inspirationStore = createCollection<StyleInspiration>(
  PREFIX.inspiration,
  "createdAt"
);

// ---- singletons -------------------------------------------------------

export const hairProfileStore = createSingleton<HairProfile>(
  SINGLETON_KEY.hairProfile
);
export const colorProfileStore = createSingleton<ColorProfile>(
  SINGLETON_KEY.colorProfile
);
export const styleProfileStore = createSingleton<StyleProfile>(
  SINGLETON_KEY.styleProfile
);
export const measurementsStore = createSingleton<UserMeasurements>(
  SINGLETON_KEY.measurements
);

// ---- cross-cutting helpers ----------------------------------------------

/**
 * Bumps timesWorn for a set of closet items after a look is logged as worn.
 * Uses a cumulative counter only (never resets/decrements), consistent with
 * the forgiving-systems rule: no punitive tracking anywhere in this app.
 */
export async function incrementTimesWorn(itemIds: string[] | undefined) {
  for (const itemId of itemIds || []) {
    const item = await closetStore.getById(itemId);
    if (item) {
      await closetStore.update({
        ...item,
        timesWorn: (item.timesWorn || 0) + 1,
      });
    }
  }
}

// Maps a backup JSON key to its idb-keyval prefix, used by importAllData.
const BACKUP_KEY_TO_PREFIX: Record<string, string> = {
  closet: PREFIX.closet,
  wigs: PREFIX.wig,
  looks: PREFIX.look,
  wishlist: PREFIX.wishlist,
  trips: PREFIX.trip,
  plans: PREFIX.plan,
  inspirations: PREFIX.inspiration,
};

/**
 * Restores a full local data export produced by exportAllData(). Writes
 * are done per-collection with a try/catch each, so a malformed or
 * partial backup file restores whatever sections it can rather than
 * failing the whole import. Original ids are preserved so re-importing
 * the same backup doesn't create duplicates. Returns which sections
 * succeeded and which failed.
 */
export async function importAllData(
  data: unknown
): Promise<{ restored: string[]; failed: string[] }> {
  const restored: string[] = [];
  const failed: string[] = [];

  if (!data || typeof data !== "object") {
    return { restored, failed: ["invalid file"] };
  }

  const backup = data as Record<string, unknown>;

  for (const [key, prefix] of Object.entries(BACKUP_KEY_TO_PREFIX)) {
    try {
      const items = backup[key];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (item && typeof item === "object" && "id" in item) {
          await set(prefix + (item as { id: string }).id, item);
        }
      }
      restored.push(key);
    } catch {
      failed.push(key);
    }
  }

  const singletonStores: [string, { save: (v: never) => Promise<void> }][] = [
    ["hairProfile", hairProfileStore],
    ["colorProfile", colorProfileStore],
    ["styleProfile", styleProfileStore],
    ["measurements", measurementsStore],
  ];

  for (const [key, store] of singletonStores) {
    try {
      const value = backup[key];
      if (value && typeof value === "object") {
        await store.save(value as never);
        restored.push(key);
      }
    } catch {
      failed.push(key);
    }
  }

  return { restored, failed };
}

/**
 * Full local data export, used for backup/manifest features. Always
 * returns a plain object with array fallbacks so a partially-corrupt
 * store never breaks the export.
 */
export async function exportAllData() {
  const [closet, wigs, looks, wishlist, trips, plans, inspirations, hair, color, style, measurements] =
    await Promise.all([
      closetStore.getAll(),
      wigStore.getAll(),
      lookStore.getAll(),
      wishlistStore.getAll(),
      tripStore.getAll(),
      planStore.getAll(),
      inspirationStore.getAll(),
      hairProfileStore.get(),
      colorProfileStore.get(),
      styleProfileStore.get(),
      measurementsStore.get(),
    ]);

  return {
    closet: closet || [],
    wigs: wigs || [],
    looks: looks || [],
    wishlist: wishlist || [],
    trips: trips || [],
    plans: plans || [],
    inspirations: inspirations || [],
    hairProfile: hair || null,
    colorProfile: color || null,
    styleProfile: style || null,
    measurements: measurements || null,
    exportedAt: Date.now(),
  };
}
