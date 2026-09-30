# 아니마룬 (AnimaRune) — 작업 규칙

## 구성
- 게임 전체가 `index.html` 한 파일에 있는 PWA이고, `sw.js`는 서비스 워커(오프라인 캐시)야.
- 문서는 `docs/`, 도구는 `tools/`에 있어.
- 다음 작업을 이어받을 때는 **`docs/인수인계.md`를 먼저 읽을 것.**

## 대화
- 채팅은 **한국어로만** 써(중간 보고 포함).
- 게임 안 문구는 간결체로 써(존댓말 금지).
- 중간중간 보고하지 말고, 마지막에 종합해서 정리해 줘.
- 확인 없이 "맞다/괜찮다"고 하지 말고 직접 검증한 뒤 답해. 확실하지 않은 건 "확인이 필요해요"라고 적어.
- 테스트나 문법 검사를 통과하기 전에는 "완성"이라고 하지 마.

## 버전
- `index.html`의 `APP_BUILD`와 `sw.js`의 `CACHE = 'animarune-vNNN'` 숫자는 항상 같아야 해.
- 보이는 버전은 `APP_VERSION`(index.html·sw.js 둘 다 같게)이고, 내부 번호 `APP_BUILD`와 따로야. (v2.76부터)
  - 새 콘텐츠를 낼 때: 앞자리 올림 (2.xx → 3.00)
  - 기존 콘텐츠를 크게 업데이트할 때: 둘째 자리 올림 (2.32 → 2.40)
  - 자잘한 업데이트: 끝자리 올림 (2.41 → 2.42)
  - `APP_BUILD`·CACHE 숫자는 버전 규칙과 상관없이 항상 1씩 올려 (업데이트 알림이 이 숫자를 비교함). `PATCH_NOTES`의 `v`에는 `APP_VERSION`을 적어.
- PR이 병합되면 다음 작업을 시작할 때 main을 브랜치에 병합하고(강제 푸시 금지) `APP_BUILD`를 +1, `APP_VERSION`은 위 규칙대로 올려.
- 새 버전을 올리면 `PATCH_NOTES` 맨 위에 새 항목을 추가해.
  - 업적은 "특정 업적의 조건 변경"처럼 흐리게 적어.
  - 스킬 수치나 보스 기믹은 자세히 적어.

## Git
- 작업 브랜치는 세션이 정해 준 브랜치를 써.
- 커밋 제목은 `[Feat]`, `[Fix]`, `[Style]`, `[Docs]`, `[Chore]` 중 하나 + 영어 Title Case로 써.
- PR이 열려 있는 동안에는 같은 브랜치에 푸시하고 PR 본문을 갱신해.
- **푸시하기 전에 PR이 이미 병합됐는지 먼저 확인해.** 병합됐다면 새 PR을 열어.

## 검증
- 문법 검사: `index.html`에서 가장 큰 `<script>` 블록을 뽑아 `node --check`로 확인해.
- 브라우저 테스트:
  - 저장소 루트에서 `python3 -m http.server 8765`로 서버를 띄워.
  - Playwright(`playwright-core`, `executablePath: '/opt/pw-browsers/chromium'`)로 페이지 에러가 0건인지 확인해.
- 보스 밸런스: 챕터 보스는 `tools/boss_winrate_sim.js`, 레이드는 `tools/raid_winrate_sim.js`를 써. 사용법은 파일 맨 위에 적혀 있어.
