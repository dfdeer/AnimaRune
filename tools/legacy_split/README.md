# 예전 아니마룬 코드 분리 도구 (1.0.0 다듬기, build 667)

index.html의 큰 스크립트를 서바이벌과 공통 코드(index.html에 남김)와 예전 게임 전용 코드(`legacy/legacy.js`)로 나눌 때 쓴 도구.
이미 나눈 뒤라 평소엔 쓸 일 없음. 다시 나눠야 할 때만 참고.

1. `npm i acorn acorn-walk` (아무 폴더)
2. `node an.js ../../index.html g.json` : 최상위 문장마다 선언 이름과 참조 이름을 뽑음
3. `node br2.js 40` : 서바이벌 선언과 모든 실행문에서 닿는 코드(core) 크기, 끊으면 많이 줄어드는 함수 목록
4. `stops.txt` : core에서 끊을 예전 화면 함수 (core엔 빈 함수만 남고 legacy가 덮어씀, 함수 선언만 가능)
5. `lexec.txt` : legacy로 옮길 실행문 번호 (예전 버튼 연결 등, legacy를 불러올 때 실행)
6. `node build.js ../../index.html out` : out/index.html과 out/legacy/legacy.js를 만듦 (core가 legacy의 함수 아닌 이름을 쓰면 멈춤)

## 스타일 나누기 (build 668)

`npm i postcss postcss-selector-parser` 후 `node css.js <index.html> <legacy/legacy.js> out`
1. 규칙마다 선택자 안의 class, id, 속성 이름이 index.html(스타일 빼고)에 다 나오면 core로 남김
2. 아니면 legacy.js에 나오는지 봄 (조금이라도 나오면 예전 쪽), 어디에도 없으면 버림
3. `out/legacy/legacy.css`는 예전 게임을 열 때 쓰는 **전체 스타일**(원래 순서, 버린 것만 뺌). loadLegacy()가 index.html의 `#coreCss`를 끄고 이걸 넣음 (예전 규칙이 서바이벌 규칙 사이에 섞여 있어서 뒤에 몰아 붙이면 덮어쓰는 순서가 바뀜)
4. legacy.css는 `<link>`가 아니라 글을 읽어 `<style>`로 넣음 (파일로 붙이면 안의 `url(assets/...)`가 legacy/ 기준이 됨)
