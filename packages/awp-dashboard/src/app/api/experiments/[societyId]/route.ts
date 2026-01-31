import { NextResponse } from "next/server";
import { readSocietyDetail } from "@/lib/reader";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ societyId: string }> },
) {
  const { societyId } = await params;
  const detail = await readSocietyDetail(societyId);
  if (!detail) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(detail);
}
