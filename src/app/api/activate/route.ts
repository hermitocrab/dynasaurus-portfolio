import { NextRequest, NextResponse } from "next/server";
import {
  validateSharedKey,
  validateActivationCode,
} from "@/lib/activation";

const ALLOWED_ORIGINS = new Set([
  "https://dynasaurus.rkrk.io",
  "https://rkrk.io",
  "https://www.rkrk.io",
]);

function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.append("Vary", "Origin");
  return response;
}

function jsonResponse(request: NextRequest, body: unknown, status = 200): NextResponse {
  return withCors(request, NextResponse.json(body, { status }));
}

export function OPTIONS(request: NextRequest) {
  return withCors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse(request, { error: "Origin not allowed" }, 403);
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse(request, { error: "Invalid JSON body" }, 400);
    }
    if (!rawBody || typeof rawBody !== "object") {
      return jsonResponse(request, { error: "Invalid JSON body" }, 400);
    }

    const body = rawBody as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    // Shared Kee keys: reusable, valid forever, any device.
    const sharedKey = await validateSharedKey(code);
    if (sharedKey) {
      return jsonResponse(request, {
        success: true,
        tier: "basic",
        isStudent: true,
        sharedKey: true,
      });
    }

    const candidate = await validateActivationCode(code);
    if (!candidate) {
      return jsonResponse(request, { error: "Invalid, expired, or already used activation code." }, 409);
    }

    return jsonResponse(request, {
      success: true,
      tier: candidate.tier,
      isStudent: candidate.is_student,
    });
  } catch (error) {
    console.error("Activation API error:", error);
    return jsonResponse(request, { error: "Activation service is temporarily unavailable." }, 503);
  }
}
