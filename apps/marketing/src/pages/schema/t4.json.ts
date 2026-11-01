import type { APIRoute } from "astro";

import { buildT4ProjectFileJsonSchema } from "@t4tools/shared/t4ProjectFile";

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(buildT4ProjectFileJsonSchema(), null, 2)}\n`, {
    headers: { "Content-Type": "application/json" },
  });
