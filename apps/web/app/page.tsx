import { redirect } from 'next/navigation';
import { HOME_HREF } from '../lib/nav';

// 루트 — 첫 화면(직접 비교 실험)으로 넘긴다(docs/08_screen/01_standards.md §요청 경로와 공통 셸)
export default function Home() {
  redirect(HOME_HREF);
}
