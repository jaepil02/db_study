import { HmiScreen } from '../../components/hmi/hmi-screen';

// ⑦ 설비 현황판 — 개요 1초(BFF /bff/plant/overview) · 고른 설비 최근 10분(api 직결 시계열 조회) · 정본 docs/08_screen/11_hmi_screen.md §HMI-PLANT
export default function HmiPage() {
  return <HmiScreen />;
}
