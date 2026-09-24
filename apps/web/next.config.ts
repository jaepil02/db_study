// 웹 = 호스트 프로세스 Next.js(127.0.0.1:3001) — 바인드 인자는 package.json 스크립트에 박는다(12_security/05)
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
};

export default config;
