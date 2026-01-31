import { NextResponse } from "next/server";
import { listReputationProfiles } from "@/lib/reader";

export async function GET() {
  const profiles = await listReputationProfiles();
  return NextResponse.json(profiles);
}
