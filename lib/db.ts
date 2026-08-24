import mongoose from "mongoose";
import { ClickEvent } from "@/lib/models/click-event";
import { ShortUrl } from "@/lib/models/short-url";
import { MONGO_ERROR, MONGO_INDEX } from "@/lib/mongo-errors";
import { ensureUserRoles } from "@/lib/roles";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  ensure: Promise<void> | null;
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongoose?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose.mongoose ?? {
  conn: null,
  promise: null,
  ensure: null,
};

if (!globalWithMongoose.mongoose) {
  globalWithMongoose.mongoose = cached;
}

export const MONGODB_DB_NAME = "url-shortener";

/** Drop legacy global unique index on `short` so path and subdomain can share labels. */
async function ensureShortUrlIndexes() {
  try {
    const indexes = await ShortUrl.collection.indexes();
    if (indexes.some((index) => index.name === MONGO_INDEX.LEGACY_SHORT)) {
      await ShortUrl.collection.dropIndex(MONGO_INDEX.LEGACY_SHORT);
    }
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    // 26 = NamespaceNotFound (empty database)
    if (code !== MONGO_ERROR.NAMESPACE_NOT_FOUND) {
      throw error;
    }
  }
  await ShortUrl.createIndexes();
  await ClickEvent.createIndexes();
}

function scheduleEnsure() {
  if (!cached.ensure) {
    cached.ensure = (async () => {
      try {
        await ensureShortUrlIndexes();
        await ensureUserRoles();
      } catch (error) {
        cached.ensure = null;
        console.warn("[db] schema ensure failed:", error);
      }
    })();
  }

  return cached.ensure;
}

export async function connectDB(options?: { waitForEnsure?: boolean }) {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (!cached.conn) {
    if (!cached.promise) {
      cached.promise = mongoose.connect(mongoUri, {
        bufferCommands: false,
        autoIndex: false,
        dbName: MONGODB_DB_NAME,
      });
    }

    try {
      cached.conn = await cached.promise;
    } catch (error) {
      cached.promise = null;
      cached.conn = null;
      cached.ensure = null;
      await mongoose.disconnect().catch(() => undefined);
      throw error;
    }
  }

  const ensure = scheduleEnsure();
  if (options?.waitForEnsure) {
    await ensure;
  }

  return cached.conn;
}
