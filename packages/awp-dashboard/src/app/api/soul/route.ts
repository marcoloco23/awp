import { NextResponse } from "next/server";
import { readSoul } from "@/lib/reader";

export async function GET() {
  const soul = await readSoul();
  if (!soul) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(soul);
}
