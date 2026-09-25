import { notFound } from 'next/navigation';
import { MasterAdmin } from '../../../../../components/master/master-admin';
import { EntityIdParam } from '../../../../../lib/shared';

// ADM-MASTER 설비 상세 — 정본 docs/08_screen/06_master_admin.md
export default async function MasterDevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const parsed = EntityIdParam.safeParse((await params).deviceId);
  if (!parsed.success) notFound();
  return <MasterAdmin key={parsed.data} deviceId={parsed.data} />;
}
