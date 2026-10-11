/** The commit the live deployment was built from, so open tabs can tell when they're out of date. */

import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json({ sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers: { "Cache-Control": "no-store" } });
}
