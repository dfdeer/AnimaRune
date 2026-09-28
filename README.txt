아니마룬 — 홈 화면 앱 올리기 (GitHub Pages)

[올릴 파일 6개]  index.html · manifest.webmanifest · sw.js · icon-180.png · icon-192.png · icon-512.png
  (이 README.txt는 안 올려도 됩니다)

1) github.com 에서 New repository → 이름 예: AnimaRune → Public → Create
2) 저장소 화면에서 "uploading an existing file"(또는 Add file → Upload files) → 위 6개 파일을 모두 올리고 Commit changes
3) Settings → Pages → Build and deployment 의 Source를 "Deploy from a branch", Branch를 main / (root)로 → Save
4) 1~2분 뒤 Pages 화면 위쪽에 주소가 나옵니다:  https://내아이디.github.io/AnimaRune/
5) 폰 Safari로 그 주소를 열고 → 공유 버튼 → "홈 화면에 추가"

[주의]
- 홈 화면 앱의 저장소는 Safari 탭과 따로입니다. Safari에서 하던 진행은 자동으로 옮겨지지 않으니
  (설정 → 세이브 내보내기)로 코드를 복사해서, 홈 화면 앱에서 (불러오기)로 붙여넣으세요.
- 게임 파일을 새 버전으로 바꿀 때: index.html만 다시 올리면 됩니다(sw.js의 CACHE 숫자를 올리면 더 확실).
