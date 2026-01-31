import { NextResponse } from "next/server";
import { listSocieties } from "@/lib/reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const societies = await listSocieties(status);
  return NextResponse.json(societies);
}
