# 천상흔 v65.4 · Cloudinary 업로드 연결

이 버전은 기존 Firebase 로그인/Firestore, STORY 비주얼 노벨, CHARACTER 10페어, ARCHIVE 다시보기 기능을 유지하면서 관리자 파일 업로드를 Cloudinary에 연결한 버전입니다.

## 연결 구조

- GitHub Pages: 사이트
- Firebase Authentication: 관리자 로그인
- Firestore: 이야기/인물/기록 데이터
- Cloudinary: 이미지와 음원 저장
- Cloudflare Worker: Firebase 관리자 확인 + Cloudinary 업로드 서명/삭제

사이트의 `media-config.js`는 다음 Worker를 사용합니다.

`https://cheonsangheun-upload.dosilag535.workers.dev`

Cloudinary API Secret은 GitHub 파일에 들어 있지 않으며 Worker의 비밀 환경 변수에만 저장해야 합니다.

## 업로드

관리자 편집 모드에서 기존 `파일 업로드`, `이미지 업로드`, `배경음악 업로드` 버튼을 누르면:

1. Firebase 관리자 로그인 토큰을 Worker가 확인합니다.
2. Worker가 짧은 업로드 서명을 발급합니다.
3. 브라우저가 파일을 Cloudinary로 직접 업로드합니다.
4. 반환된 HTTPS 주소가 해당 URL 입력칸에 자동으로 들어갑니다.

이미지와 오디오 모두 동일한 흐름을 사용합니다.

## 삭제

URL 입력칸 옆 `삭제`를 누르면 해당 주소가 이 Cloudinary 계정의 자산인 경우 Cloudinary에서도 삭제를 요청합니다. 직접 입력한 외부 URL은 저장소에서 삭제하지 않고 입력칸만 비웁니다.

## Worker 환경 변수

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET` — 반드시 Secret
- `FIREBASE_API_KEY`
- `FIREBASE_ADMIN_UID`

Worker 코드 백업은 `cloudflare-cloudinary-worker.js`에 있습니다. 비밀키 값은 포함하지 않습니다.


## v66 · 공지 페이지
- 메인과 이야기 사이에 `공지` 메뉴가 추가되었습니다.
- 분류: 세계관 공지 / 이야기 공지 / 인물 설정 / 러닝 공지
- 관리자 편집 모드에서 공지 작성·수정·삭제가 가능합니다.
- 본문 편집기에서 큰 제목, 작은 제목, 굵게, 기울임, 밑줄, 취소선, 강조, 목록, 정렬, 구분선을 사용할 수 있습니다.
- 공지 페이지 자체도 페이지 편집에서 공개/잠금을 선택할 수 있습니다. 기본값은 공개입니다.
- **중요:** `firestore.rules`도 v66 파일로 Firebase 콘솔에 다시 게시해야 일반 방문자가 공개 공지를 읽을 수 있습니다.
