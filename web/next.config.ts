import type { NextConfig } from "next";

// Política de segurança de conteúdo (CSP).
// 'unsafe-inline'/'unsafe-eval' em script-src são exigidos pelo runtime do
// Next.js (hydration/RSC e dev). style-src inline é exigido pelas fontes/temas.
// connect-src 'self' basta — chamadas externas (Upstash etc.) são server-side.
// frame-ancestors 'none' reforça o X-Frame-Options contra clickjacking.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// IMPORTANTE: o CSP entra em modo REPORT-ONLY de propósito. Ele NÃO bloqueia
// nada — apenas reportaria violações — para não quebrar login, Kanban, gráficos
// (recharts injeta estilos inline), importações/uploads ou chamadas internas
// enquanto observamos o comportamento real. Depois de validar em staging que não
// há violações legítimas, troque o key para "Content-Security-Policy" (bloqueante)
// num commit separado. Os demais headers já vão bloqueantes (são seguros).
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
