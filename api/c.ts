// /c?l=7&t=14200&n=준서&m=2 -> 카톡/SNS 크롤러용 메타를 채운 HTML. 사람은 /challenge/ 로 바로 넘어간다.
import { cleanQuery, parseParams, tauntOf } from './_shared';

export const config = { runtime: 'edge' };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export default function handler(req: Request): Response {
  const url = new URL(req.url);
  const origin = url.origin;
  const p = parseParams(url.searchParams);
  const q = cleanQuery(p);

  const title = `${p.n}의 도전장 · 레벨 ${p.l}`;
  const desc = tauntOf(p);
  const image = `${origin}/api/og?${q}`;
  const pageUrl = `${origin}/c?${q}`;
  const target = `/challenge/?${q}`;
  const jsTarget = JSON.stringify(target).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Catch The Jebi">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<script>location.replace(${jsTarget});</script>
</head>
<body>
<p>제비가 도전장을 물고 가는 중…</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=86400',
    },
  });
}
