import { NextResponse } from "next/server";
import { readOrgChart } from "@/lib/reader";

export async function GET() {
  const chart = await readOrgChart();
  return NextResponse.json(chart);
}
