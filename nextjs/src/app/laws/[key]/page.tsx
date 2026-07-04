import { notFound } from "next/navigation";
import { getLawDetail } from "../../../lib/law-detail";
import { LawContent } from "./law-content";

export default async function LawDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  const data = await getLawDetail(key);

  if (!data) {
    notFound();
  }

  return <LawContent law={data} />;
}
