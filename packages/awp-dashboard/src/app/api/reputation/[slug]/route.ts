import { NextResponse } from "next/server";
import { readReputationProfile } from "@/lib/reader";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await readReputationProfile(slug);
  if (!profile) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(profile);
}
