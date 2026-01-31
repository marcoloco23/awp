import { NextResponse } from "next/server";
import { listArtifacts } from "@/lib/reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tag = searchParams.get("tag") || undefined;
  const artifacts = await listArtifacts(tag);
  return NextResponse.json(artifacts);
}
