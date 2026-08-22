import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, blobConfigured } from "@/lib/files";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!blobConfigured()) {
    return NextResponse.json(
      {
        error: "File uploads need BLOB_READ_WRITE_TOKEN. Paste an https file URL instead.",
      },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [...ALLOWED_FILE_TYPES],
        maximumSizeInBytes: MAX_FILE_BYTES,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // Client already POSTs the blob URL onto the short-link document.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not start";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
