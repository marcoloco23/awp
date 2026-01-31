import { NextResponse } from "next/server";
import { listContracts } from "@/lib/reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const contracts = await listContracts(status);
  return NextResponse.json(contracts);
}
