/**
 * One entry's preview sheet, library/reactions/previews/<id>.jpg (made by
 * reactions.py fill). Only that folder, only a valid entry id.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LIB_DIR, validEntryId } from "@/lib/reactions";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validEntryId(id)) return new Response("Not found", { status: 404 });
  try {
    const body = readFileSync(join(LIB_DIR, "previews", `${id}.jpg`));
    return new Response(new Uint8Array(body), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-cache" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
