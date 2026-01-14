import type { APIContext } from "astro";
import { getLatestMacro } from "../../lib/db/client";

export async function GET(context: APIContext) {
  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json(
      { error: "database not configured" },
      { status: 500 }
    );
  }

  const macro = await getLatestMacro(db);
  if (!macro) {
    return Response.json(
      { error: "no macro signal available" },
      { status: 404 }
    );
  }

  return Response.json({
    ...macro,
    data: macro.data_json ? JSON.parse(macro.data_json) : null,
  });
}
