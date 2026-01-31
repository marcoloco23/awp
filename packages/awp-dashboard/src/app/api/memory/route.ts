import { NextResponse } from "next/server";
import { readMemoryLogs, readLongTermMemory } from "@/lib/reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "14", 10);
  const [logs, longTerm] = await Promise.all([readMemoryLogs(limit), readLongTermMemory()]);
  return NextResponse.json({ logs, longTerm });
}
