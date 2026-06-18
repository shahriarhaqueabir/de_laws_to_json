import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerClient } from "../../../../lib/supabase";
import { qdrant, COLLECTION } from "../../../../lib/qdrant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;

  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);

  // Get law metadata
  const { data: law, error } = await supabase
    .from("laws")
    .select("*")
    .eq("key", key)
    .single();

  if (error)
    return NextResponse.json({ error: "Law not found" }, { status: 404 });

  // Get norms from Qdrant by law_key filter (using scroll to get up to 1000)
  try {
    const norms = await qdrant.scroll(COLLECTION, {
      filter: {
        must: [{ key: "law_key", match: { value: key } }],
      },
      limit: 1000,
      with_payload: true,
    });

    return NextResponse.json({
      ...law,
      norms: norms.points.map((p: any) => p.payload),
    });
  } catch (err) {
    console.error("Qdrant scroll error:", err);
    return NextResponse.json({
      ...law,
      norms: [],
      warning: "Could not fetch norms from vector store",
    });
  }
}
