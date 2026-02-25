import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, api_key, authtoken } = body as {
      url?: string;
      api_key?: string;
      authtoken?: string;
    };

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid url" },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (api_key) headers["api_key"] = api_key;
    if (authtoken) headers["authtoken"] = authtoken;

    const res = await fetch(url, { headers });

    // Copy all response headers (server-side has full access; no CORS)
    const headersRecord: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headersRecord[key.toLowerCase()] = value;
    });

    let responseBody: unknown = {};
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        responseBody = await res.json();
      } catch {
        responseBody = {};
      }
    }

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      headers: headersRecord,
      body: responseBody,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "FAIL",
        ok: false,
        headers: {} as Record<string, string>,
        body: {},
      },
      { status: 200 }
    );
  }
}
