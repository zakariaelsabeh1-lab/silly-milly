// Tiny key/value store.
// On Vercel it uses Upstash Redis (added from the Vercel Marketplace, free tier).
// On a computer with no Redis set up, it falls back to a local JSON file so you can test.
import { Redis } from "@upstash/redis";
import fs from "node:fs";
import path from "node:path";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const PREFIX = "milly:";
const FILE = path.join(process.cwd(), ".local-data.json");

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

export function storageReady() {
  return Boolean(redis) || !process.env.VERCEL;
}

export async function getKey(key, fallback) {
  if (redis) {
    const v = await redis.get(PREFIX + key);
    return v == null ? fallback : v;
  }
  const all = readFile();
  return key in all ? all[key] : fallback;
}

export async function setKey(key, value) {
  if (redis) {
    await redis.set(PREFIX + key, value);
    return;
  }
  const all = readFile();
  all[key] = value;
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}
