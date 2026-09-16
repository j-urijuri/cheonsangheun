# 천상흔 v63 · Firebase + R2 업로드 준비형

현재 Firebase Authentication / Firestore는 실제 프로젝트 `cheonsangheun-e6e8a`에 연결되어 있습니다.
이번 v63은 CHARACTER 10페어 편집을 유지하면서 Cloudflare R2 파일 업로드 버튼을 추가한 버전입니다.

## 현재 가능한 편집

### CHARACTER · 10페어 / 20명
- 페어 카드 대표 이미지
- 좌측 인물 전신 이미지
- 우측 인물 전신 이미지
- 이름 / 대표 대사 / 캐치프레이즈
- 성별 / 키 / 나이 / 종족 / 소속 계
- 외형 / 성격 / 능력 / 천명 또는 목표 / 중요한 인연 / 기타
- Firestore `characterPairs/pair01 ... pair10`에 저장

### STORY · Visual Novel
- 배경 이미지
- 왼쪽 / 오른쪽 스탠딩 이미지(모두 선택 사항)
- CG
- 에피소드 BGM
- 장면 BGM / 환경음 / 효과음
- 대사 / 서술 / 화자 / 장면 순서
- ARCHIVE 다시보기 연결

### ARCHIVE
- 대표 이미지
- 기록 본문
- STORY 장면 스냅샷 다시보기

## v63의 파일 업로드 방식
모든 URL 입력칸은 그대로 남아 있습니다.
R2 연결 후에는 옆의 `파일 업로드` 버튼을 눌러 로컬 파일을 올리면 URL이 자동 입력됩니다.
`삭제` 버튼은 해당 URL이 이 사이트의 R2 Worker 주소라면 R2 저장소에서도 파일을 삭제합니다.

현재 `r2-config.js`는 연결 전 상태입니다.

```js
window.CHEONSANGHEUN_R2 = {
  enabled: false,
  endpoint: "PASTE_R2_WORKER_URL_HERE"
};
```

Cloudflare Worker를 배포한 뒤 예를 들어 Worker 주소가
`https://cheonsangheun-media.example.workers.dev` 라면 다음처럼 바꿉니다.

```js
window.CHEONSANGHEUN_R2 = {
  enabled: true,
  endpoint: "https://cheonsangheun-media.example.workers.dev"
};
```

## Cloudflare에 필요한 것
1. R2 bucket 하나를 생성합니다. 권장 이름: `cheonsangheun-media`
2. Worker 하나를 생성하고 이 폴더의 `cloudflare-r2-worker.js` 내용을 붙여넣습니다.
3. Worker 설정에서 R2 binding을 추가합니다.
   - Binding name: `MEDIA`
   - Bucket: 방금 만든 `cheonsangheun-media`
4. Worker를 배포합니다.
5. Worker URL 뒤에 `/health`를 붙여 열었을 때 `{ "ok": true ... }`가 나오면 정상입니다.
6. 그 Worker URL을 `r2-config.js`에 넣고 `enabled: true`로 바꿉니다.
7. GitHub Pages에 업데이트된 파일을 올립니다.

CLI를 사용하는 경우 `wrangler.toml.example`도 참고할 수 있습니다.

## 보안 구조
- 업로드 / 삭제는 Firebase 관리자 로그인 토큰을 Worker로 보내 인증한 뒤에만 허용됩니다.
- Worker는 Firebase Auth REST API로 토큰을 확인하고 관리자 UID가 일치하는지 검사합니다.
- R2 API 키나 secret을 브라우저 코드에 넣지 않습니다. Worker의 R2 binding을 사용합니다.
- 업로드된 파일은 추측하기 어려운 view token이 포함된 URL로 반환됩니다.
- 현재 Firestore가 관리자 전용이므로 미공개 콘텐츠의 파일 URL도 일반 방문자에게 전달되지 않습니다.

## 파일 크기 제한
- 이미지: 20MB 이하
- 오디오: 50MB 이하

천상흔의 일반적인 캐릭터 일러스트, 배경, CG, BGM, 효과음 용도에는 충분하도록 잡은 제한입니다.

## GitHub Pages 핵심 파일
- `index.html`
- `admin.html`
- `cms.js`
- `firebase-config.js`
- `firestore.rules`
- `site-mode.js`
- `r2-config.js`

Cloudflare 설정용 파일은 GitHub Pages에서 실행되는 파일이 아닙니다.
- `cloudflare-r2-worker.js`
- `wrangler.toml.example`

## 현재 연결 정보
- Firebase projectId: `cheonsangheun-e6e8a`
- authDomain: `cheonsangheun-e6e8a.firebaseapp.com`
- GitHub Pages authorized domain: `j-urijuri.github.io`
- 관리자 로그인: Firebase Authentication에 만든 공용 계정 1개

관리자 비밀번호는 절대 코드나 GitHub에 넣지 마세요.


## v63.3 ARCHIVE 자동 기록
- STORY 에피소드 저장 시 같은 장면 묶음이 ARCHIVE 다시보기 기록으로 자동 생성됩니다.
- STORY 수정 시 같은 ARCHIVE 기록이 자동 업데이트됩니다.
- STORY 삭제 시 해당 자동 기록도 함께 삭제됩니다.
- 장면별 수동 기록 연결 기능은 그대로 유지됩니다.


## v63.4 페어 저장 수정
- Firestore가 지원하지 않는 중첩 배열을 제거했습니다.
- 상세 프로필 rows는 `{label, value}` 객체 배열로 저장합니다.
- 기존 배열형 기본 데이터와 새 객체형 Firestore 데이터를 모두 화면에서 읽을 수 있습니다.
- 페어 저장 실패 시 Firebase 오류 코드가 화면에 표시됩니다.


## v63.5 CHARACTER UI 수정
- `현재 페어 편집`은 열린 페어 상세 `<dialog>` 안에서 하단 편집 시트로 열립니다.
- 긴 대사/캐치프레이즈/메타/상세정보는 자동 줄바꿈됩니다.
- 좌우 상세보기 패널은 세로 스크롤 가능하며 스크롤바는 표시하지 않습니다.
- 편집 시트 자체도 스크롤 가능하지만 스크롤바는 숨깁니다.
- 저장 후 현재 열린 프로필 화면에 즉시 반영됩니다.


## v63.6
- CHARACTER 좌우 상세보기 탭 복구
- 상세 패널 내부 세로 스크롤 유지, 스크롤바 숨김
- 긴 대사/캐치프레이즈/상세정보 자동 줄바꿈 유지
- 프로필 인라인 편집 중에도 좌우 상세보기 탭 사용 가능
