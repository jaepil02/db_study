import { notFound } from 'next/navigation';
import { RealtimeDashboard } from '../../../components/realtime/dashboard';
import { DeviceIdParam } from '../../../lib/shared';

// DSH-REALTIME — 정본 docs/08_screen/03_realtime_dashboard.md
export default async function RealtimeDevicePage({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const parsed = DeviceIdParam.safeParse(deviceId);
  if (!parsed.success) notFound();
  return <RealtimeDashboard key={parsed.data} deviceId={parsed.data} />;
}
