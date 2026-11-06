# 예전 아니마룬 코드 분리 도구 (1.0.0 다듬기, build 667)

index.html의 큰 스크립트를 서바이벌과 공통 코드(index.html에 남김)와 예전 게임 전용 코드(`legacy/legacy.js`)로 나눌 때 쓴 도구.
이미 나눈 뒤라 평소엔 쓸 일 없음. 다시 나눠야 할 때만 참고.

1. `npm i acorn acorn-walk` (아무 폴더)
2. `node an.js ../../index.html g.json` : 최상위 문장마다 선언 이름과 참조 이름을 뽑음
3. `node br2.js 40` : 서바이벌 선언과 모든 실행문에서 닿는 코드(core) 크기, 끊으면 많이 줄어드는 함수 목록
4. `stops.txt` : core에서 끊을 예전 화면 함수 (core엔 빈 함수만 남고 legacy가 덮어씀, 함수 선언만 가능)
5. `lexec.txt` : legacy로 옮길 실행문 번호 (예전 버튼 연결 등, legacy를 불러올 때 실행)
6. `node build.js ../../index.html out` : out/index.html과 out/legacy/legacy.js를 만듦 (core가 legacy의 함수 아닌 이름을 쓰면 멈춤)
