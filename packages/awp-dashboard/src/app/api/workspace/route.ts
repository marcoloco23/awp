import { NextResponse } from "next/server";
import { readManifest, computeWorkspaceHealth, computeStats } from "@/lib/reader";

export async function GET() {
  const [manifest, health, stats] = await Promise.all([
    readManifest(),
    computeWorkspaceHealth(),
    computeStats(),
  ]);
  return NextResponse.json({ manifest, health, stats });
}
