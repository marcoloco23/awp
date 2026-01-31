import { NextResponse } from "next/server";
import { readExperiment } from "@/lib/reader";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ societyId: string; experimentId: string }> },
) {
  const { societyId, experimentId } = await params;
  const experiment = await readExperiment(societyId, experimentId);
  if (!experiment) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(experiment);
}
