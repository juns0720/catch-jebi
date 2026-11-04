// 도전장 OG 이미지 (1200x630). JSX 없이 satori 객체 트리로 그린다.
import { ImageResponse } from '@vercel/og';
import { parseParams, secondsText, tauntOf, tierName } from './_shared';

export const config = { runtime: 'edge' };

const PAPER = '#f3ead3';
const INK = '#2b2317';
const SEAL = '#c0392b';

// 폰트 파일(합쳐서 ~9MB)을 함수 번들에 넣으면 Edge 크기 제한(1~2MB)을 넘으므로,
// 정적 자산(/fonts/*)으로 서빙하고 같은 origin 에서 가져와 모듈 수준에서 캐시한다.
const fontCache = new Map<string, Promise<ArrayBuffer>>();
function loadFont(origin: string, file: string): Promise<ArrayBuffer> {
  let p = fontCache.get(file);
  if (!p) {
    p = fetch(new URL('/fonts/' + file, origin)).then((r) => {
      if (!r.ok) throw new Error('font ' + file + ' ' + r.status);
      return r.arrayBuffer();
    });
    p.catch(() => fontCache.delete(file));
    fontCache.set(file, p);
  }
  return p;
}

type Style = Record<string, string | number>;
type Child = string | number | null | Node;
interface Node { type: string; props: { style: Style; children?: Child | Child[] } }

function el(style: Style, children?: Child | Child[]): Node {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children } };
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const p = parseParams(url.searchParams);
    const [song, gowun] = await Promise.all([
      loadFont(url.origin, 'SongMyung-Regular.ttf'),
      loadFont(url.origin, 'GowunDodum-Regular.ttf'),
    ]);

    const song_ = 'SongMyung';
    const gowun_ = 'GowunDodum';
    const fonts = [
      { name: song_, data: song, weight: 400 as const, style: 'normal' as const },
      { name: gowun_, data: gowun, weight: 400 as const, style: 'normal' as const },
    ];

    // ?site=1 : 랜딩(제비뽑기) 공용 카드. 도전장 파라미터 없이 사이트 소개만 그린다.
    if (url.searchParams.get('site')) {
      const winStamp = el({
        position: 'absolute', bottom: 56, right: 72,
        width: 190, height: 190, borderRadius: 95,
        border: `8px solid ${SEAL}`, color: SEAL,
        alignItems: 'center', justifyContent: 'center',
        transform: 'rotate(-12deg)', opacity: 0.88,
      }, el({
        width: 158, height: 158, borderRadius: 79, border: `3px solid ${SEAL}`,
        alignItems: 'center', justifyContent: 'center',
        fontFamily: song_, fontSize: 72, letterSpacing: 2,
      }, '당첨'));
      const siteTree = el({
        width: 1200, height: 630, backgroundColor: '#d9cba6', padding: 28,
      }, el({
        position: 'relative', flexDirection: 'column', width: '100%', height: '100%',
        backgroundColor: PAPER, color: INK, border: `3px solid ${INK}`,
        padding: '56px 64px 40px 64px',
      }, [
        el({ fontFamily: gowun_, fontSize: 40, opacity: 0.8 }, '살아있는 제비뽑기'),
        el({ fontFamily: song_, fontSize: 124, lineHeight: 1.05, marginTop: 8 }, 'Catch The Jebi'),
        el({ flexDirection: 'column', fontFamily: gowun_, fontSize: 42, marginTop: 28, lineHeight: 1.45, maxWidth: 780 }, [
          el({}, '강남 갔던 제비들이 쪽지를 물고 돌아왔어요.'),
          el({}, '날아다니는 제비를 잡아 쪽지를 뽑아 보세요.'),
        ]),
        el({ flexGrow: 1 }),
        el({ fontFamily: gowun_, fontSize: 30, opacity: 0.7 }, 'catch-jebi.vercel.app'),
        winStamp,
      ]));
      return new ImageResponse(siteTree as never, {
        width: 1200, height: 630, fonts,
        headers: { 'Cache-Control': 'public, max-age=604800' },
      });
    }

    const stamp = el({
      position: 'absolute', top: 64, right: 72,
      width: 210, height: 210, borderRadius: 105,
      border: `8px solid ${SEAL}`, color: SEAL,
      alignItems: 'center', justifyContent: 'center',
      transform: 'rotate(-12deg)', opacity: 0.88,
    }, el({
      width: 178, height: 178, borderRadius: 89, border: `3px solid ${SEAL}`,
      alignItems: 'center', justifyContent: 'center',
      fontFamily: song_, fontSize: 64, letterSpacing: 2,
    }, '도전장'));

    const tree = el({
      width: 1200, height: 630, backgroundColor: '#d9cba6', padding: 28,
    }, el({
      position: 'relative', flexDirection: 'column', width: '100%', height: '100%',
      backgroundColor: PAPER, color: INK, border: `3px solid ${INK}`,
      padding: '44px 64px 36px 64px',
    }, [
      el({ fontFamily: song_, fontSize: 68, lineHeight: 1.15 }, `${p.n}의 도전장`),
      el({ fontFamily: gowun_, fontSize: 38, marginTop: 8, opacity: 0.85 }, `레벨 ${p.l} · ${tierName(p.l)}`),
      el({ alignItems: 'baseline', marginTop: 10 }, [
        el({ fontFamily: song_, fontSize: 210, lineHeight: 1.05, color: INK }, secondsText(p.t)),
        el({ fontFamily: song_, fontSize: 84, marginLeft: 12 }, '초'),
      ]),
      el({ fontFamily: gowun_, fontSize: 44, marginTop: 6 }, `“${tauntOf(p)}”`),
      el({ flexGrow: 1 }),
      el({ justifyContent: 'space-between', alignItems: 'flex-end' }, [
        el({ fontFamily: gowun_, fontSize: 28, opacity: 0.7 }, p.r !== null ? `명중률 ${p.r}%` : null),
        el({ fontFamily: song_, fontSize: 36, letterSpacing: 1 }, 'Catch The Jebi'),
      ]),
      stamp,
    ]));

    return new ImageResponse(tree as never, {
      width: 1200,
      height: 630,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (e) {
    return new Response('og error: ' + (e as Error).message, { status: 500 });
  }
}
