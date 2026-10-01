import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { FarmData } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  if (!isLocalDatabaseEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: responseHeaders });
  try {
    const { readFarmData } = await import("@/lib/local-database");
    return NextResponse.json(readFarmData(), { headers: responseHeaders });
  } catch (error) {
    console.error("Local database read failed:", error);
    return NextResponse.json({ error: "Database lokal tidak dapat dibaca." }, { status: 500, headers: responseHeaders });
  }
}

export async function PUT(request: Request) {
  if (!isLocalDatabaseEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404, headers: responseHeaders });
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Permintaan tidak diizinkan." }, { status: 403, headers: responseHeaders });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Ukuran data melebihi batas 20 MB." }, { status: 413, headers: responseHeaders });
  }

  try {
    const data: unknown = await request.json();
    if (!isFarmData(data)) {
      return NextResponse.json({ error: "Format data tidak valid." }, { status: 400, headers: responseHeaders });
    }
    const { writeFarmData } = await import("@/lib/local-database");
    return NextResponse.json(writeFarmData(data), { headers: responseHeaders });
  } catch (error) {
    console.error("Local database write failed:", error);
    return NextResponse.json({ error: "Data belum berhasil disimpan ke database." }, { status: 500, headers: responseHeaders });
  }
}

function isLocalDatabaseEnabled() {
  return process.env.NODE_ENV !== "production" && !isSupabaseConfigured;
}

function isFarmData(value: unknown): value is FarmData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FarmData>;
  return Boolean(
    candidate.profile &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.pens) &&
    Array.isArray(candidate.transactions) &&
    Array.isArray(candidate.debts) &&
    Array.isArray(candidate.debtPayments) &&
    Array.isArray(candidate.budgets),
  );
}
