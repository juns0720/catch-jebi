// 닉네임 금칙어. 운영하면서 추가한다.
// 비교 전에 normalize() 로 공백/특수문자를 제거하고 소문자로 만든다.

/** 부분 문자열로 검사 (정규화된 닉네임 안에 포함되면 거부). */
export const BAD_SUBSTRINGS: string[] = [
  // 한글 욕설 / 비하
  '시발', '씨발', '씨바', '시바', '시팔', '씨팔', '쉬발', '쒸발', '씌발', '시벌', '씨벌',
  '시이발', '씨이발', '십새', '씹새', '씹년', '씹놈', '씹물', '씹창', '좆', '좃같', '존나', '존니',
  '병신', '븅신', '빙신', '지랄', '염병', '옘병', '엿먹', '개새끼', '개색기', '개세끼', '개새키',
  '미친놈', '미친년', '미친새', '쌍놈', '쌍년', '호로새끼', '호로자식', '후레자식', '창녀', '창년', '걸레년',
  '느금마', '느금', '니애미', '니에미', '니미럴', '애미', '엠창', '패드립',
  '섹스', '야동', '딸딸이', '자위', '한남충', '김치녀', '된장녀', '맘충', '틀딱', '급식충', '일베', '메갈',
  '꺼저라', '뒤져라', '디져라', '죽어라',
  // 자모 분리형 초성
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅄ', 'ㅈㄹ', 'ㅅㅂㄹㅁ', 'ㅆㅂㄹㅁ', 'ㅈㄴ', 'ㄲㅈ', 'ㄷㅊ', 'ㅁㅊ',
  'ㅅㄲ', 'ㄱㅅㄲ', 'ㅂㅈ', 'ㅅㅍ',
  // 영문 변형
  'fuck', 'fuk', 'fck', 'shit', 'sh1t', 'bitch', 'btch', 'cunt', 'dick', 'pussy', 'whore', 'slut',
  'nigger', 'nigga', 'faggot', 'bastard', 'asshole', 'retard', 'porn', 'wtf', 'stfu',
  'sibal', 'ssibal', 'tlqkf', 'qudtls', 'wlfkf',
];

/** 정규화 후 전체가 일치할 때만 거부 (짧아서 부분 일치하면 오탐이 많은 단어). */
export const BAD_EXACT: string[] = [
  '보지', '자지', '좆', '년', '놈', '씹', 'ㅗ', 'ass', 'sex', 'gay', 'nazi', 'jot', 'zot',
];

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' };

/** 공백/특수문자 제거 + 소문자. */
export function normalize(s: string): string {
  // NFKC 는 호환 자모(ㅅㅂ)를 결합 자모로 바꿔 버리므로, 자모 범위 밖의 글자만 NFKC 한다.
  return s.replace(/[^ㄱ-ㅣ]+/g, (m) => m.normalize('NFKC')).toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
}

function variants(raw: string): string[] {
  const base = normalize(raw);
  const noDigits = base.replace(/[0-9]/g, '');
  const leet = base.replace(/[0-9]/g, (d) => LEET[d] ?? d);
  const collapsed = base.replace(/(.)\1+/g, '$1');
  return [base, noDigits, leet, collapsed];
}

export function hasBadWord(raw: string): boolean {
  for (const v of variants(raw)) {
    if (!v) continue;
    if (BAD_EXACT.includes(v)) return true;
    for (const w of BAD_SUBSTRINGS) if (v.includes(w)) return true;
  }
  return false;
}
