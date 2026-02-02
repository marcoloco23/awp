import { NextResponse } from "next/server";
import { readSyncOverview } from "@/lib/reader";

export async function GET() {
  const overview = await readSyncOverview();
  return NextResponse.json(overview);
}
