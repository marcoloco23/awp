import { NextResponse } from "next/server";
import { listProjects } from "@/lib/reader";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const projects = await listProjects(status);
  return NextResponse.json(projects);
}
