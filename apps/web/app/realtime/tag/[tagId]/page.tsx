import { notFound } from 'next/navigation';
import { TagDeepLink } from '../../../../components/realtime/tag-deep-link';
import { DeviceIdParam } from '../../../../lib/shared';

// DSH-REALTIME 태그 딥링크 /realtime/tag/{tag_id} — 정본 docs/08_screen/03_realtime_dashboard.md §진입
// 경로 식별자는 설비와 같은 정수 ID 규약(07_api/01 §표면 계층과 경로)이라 같은 스키마로 가른다
export default async function RealtimeTagPage({ params }: { params: Promise<{ tagId: string }> }) {
  const { tagId } = await params;
  const parsed = DeviceIdParam.safeParse(tagId);
  if (!parsed.success) notFound();
  return <TagDeepLink key={parsed.data} tagId={parsed.data} />;
}
