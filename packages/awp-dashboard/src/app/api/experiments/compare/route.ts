import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readExperimentComparison } from "@/lib/reader";
import { compareExperiments } from "@agent-workspace/agent";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const societyA = searchParams.get("societyA");
  const expA = searchParams.get("expA");
  const societyB = searchParams.get("societyB");
  const expB = searchParams.get("expB");
  const test = searchParams.get("test") === "mann-whitney" ? "mann-whitney" as const : "t-test" as const;

  if (!societyA || !expA || !societyB || !expB) {
    return NextResponse.json(
      { error: "Missing required params: societyA, expA, societyB, expB" },
      { status: 400 }
    );
  }

  const data = await readExperimentComparison(societyA, expA, societyB, expB);
  if (!data) {
    return NextResponse.json(
      { error: "One or both experiments not found" },
      { status: 404 }
    );
  }

  const comparison = compareExperiments(data.expA, data.expB, { test });
  return NextResponse.json(comparison);
}
