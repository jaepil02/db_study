import { notFound } from 'next/navigation';
import { MasterAdmin } from '../../../../../components/master/master-admin';
import { EntityIdParam } from '../../../../../lib/shared';

// ADM-MASTER 태그 딥링크 — 비활성이어도 200(과거 해석용 메타) · 정본 docs/08_screen/06_master_admin.md
export default async function MasterTagPage({ params }: { params: Promise<{ tagId: string }> }) {
  const parsed = EntityIdParam.safeParse((await params).tagId);
  if (!parsed.success) notFound();
  return <MasterAdmin key={parsed.data} tagId={parsed.data} />;
}
