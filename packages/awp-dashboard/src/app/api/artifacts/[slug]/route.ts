import { NextResponse } from "next/server";
import { readArtifact } from "@/lib/reader";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artifact = await readArtifact(slug);
  if (!artifact) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(artifact);
}
