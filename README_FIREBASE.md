# 천상흔 v59 · Firebase LIVE

Firebase Authentication + Firestore 연결값이 실제 프로젝트 `cheonsangheun`에 맞게 입력된 버전입니다.

## 현재 상태
- Firebase Web App 설정 연결 완료
- 공용 관리자 UID 연결 완료
- `site-mode.js` = `true` → 실제 Firestore CMS 사용
- STORY / CHARACTER / ARCHIVE는 관리자 로그인 상태에서 실제 홈페이지 안에서 편집
- 현재 공개 전 단계이므로 Firestore는 관리자 계정만 읽기/쓰기 허용
- 이미지/사운드 파일 저장은 아직 연결 전이며, 이후 Cloudflare R2 연결 예정

## GitHub Pages에 올릴 핵심 파일
- `index.html`
- `admin.html`
- `cms.js`
- `firebase-config.js`
- `site-mode.js`

같은 폴더에 유지해야 합니다.

## 처음 테스트하는 순서
1. GitHub Pages에 위 파일들을 올립니다.
2. `/admin.html`을 엽니다.
3. Firebase Authentication에 만든 공용 이메일/비밀번호로 로그인합니다.
4. 로그인 성공 시 `index.html?edit=1#story`로 이동합니다.
5. STORY 페이지에서 새 에피소드/장면을 하나 만들어 저장합니다.
6. 새로고침 후 그대로 남아 있으면 Firestore 저장 연결 성공입니다.

## Firestore Rules
Firebase Console > Firestore Database > 규칙에 이 폴더의 `firestore.rules`와 같은 규칙을 사용합니다.
현재는 공개 전이므로 관리자 UID만 읽고 쓸 수 있습니다.

## 주의
- 관리자 비밀번호를 코드나 GitHub에 넣지 마세요.
- `firebase-config.js`의 Web App configuration은 브라우저에서 사용되는 식별 정보입니다. 실제 데이터 보호는 Firebase Authentication과 Firestore Security Rules가 담당합니다.
- 공개 단계가 되면 Firestore Rules를 수정해 `public` 콘텐츠만 방문자가 읽을 수 있게 열 예정입니다.
