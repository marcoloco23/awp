import { NextResponse } from "next/server";
import { readProject } from "@/lib/reader";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await readProject(slug);
  if (!project) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(project);
}
