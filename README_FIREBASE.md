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
