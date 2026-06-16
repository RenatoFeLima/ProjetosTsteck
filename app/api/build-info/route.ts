import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    label: "diagnostic-v4",
    commit: "f9323fd",
    app: "projetos-tsteck",
    time: new Date().toISOString(),
  });
}
