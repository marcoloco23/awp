import { NextResponse } from "next/server";
import { readIdentity } from "@/lib/reader";

export async function GET() {
  const identity = await readIdentity();
  if (!identity) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(identity);
}
