async function readKvJson(
  kv: KVNamespace,
  key: string,
): Promise<unknown | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
}

export { readKvJson };
