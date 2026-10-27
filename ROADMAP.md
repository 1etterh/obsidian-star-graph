# SyncDev Roadmap

Calendar + Task planner 스타일의 task 관리 플러그인. 브랜치: `syncdev`

## 핵심 원칙

- task의 원본은 마크다운 체크박스, 플러그인은 인덱스와 뷰만 담당
- 날짜 표기는 Tasks 플러그인과 호환: `➕` 생성일, `⏳` 예정일(+시간), `📅` 마감일, `✅` 완료일
- task는 **데일리 노트**에 작성 (코어 Daily notes 설정을 따르고, 플러그인 설정으로 덮어쓰기 가능)
- 다른 플러그인 코드를 복사하지 않고 Obsidian API로 직접 구현

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | parser, TaskIndex, TaskWriter, Backlog 뷰 | ✅ 완료 |
| 1.1 | Backlog를 메인 영역 전용 탭으로 열기 | ✅ 완료 |
| 2 | Calendar 뷰 (월간 그리드, 날짜별 task 개수, 날짜 클릭 시 그날 task) | ⏳ 다음 |
| 3 | Timeline 뷰 + Backlog → Timeline 드래그로 `⏳ 날짜 시간` 기록 | 보류 (구체화할 때 구현) |
| 4 | 마감 지난 task 강조 강화, 단축키, 설정 검색 API(`getSettingDefinitions`) | 예정 |

### 1단계에 들어간 것

- `core/parser.ts`: task 줄 파싱, 체크 토글 (`✅ 날짜` 추가/제거)
- `core/taskIndex.ts`: `metadataCache` changed / vault delete·rename 이벤트로 파일 단위 증분 갱신, 폴더 포함/제외 필터
- `core/taskWriter.ts`: `vault.process`로 해당 줄만 수정, 인덱싱 후 줄이 바뀌었으면 쓰기 거부
- `core/dailyNotes.ts`: 코어 Daily notes 설정(폴더, 형식, 템플릿) 읽기, 데일리 노트 판별·생성
- `views/backlogView.ts`: 미완료 task 평평한 목록, 최신순/오래된순, Dated 토글, 출처 클릭 시 해당 줄로 이동, 오늘 노트에 task 추가 입력
- `views/addTaskModal.ts`: "Add task to today" 명령
- 정렬 기준: `➕` → 데일리 노트 날짜 → 파일 생성일

## 남은 이슈 / 메모

- 저장소: `obsidian-star-graph` fork 안에 `star`(star-graph)와 `syncdev`가 브랜치로 공존. 공개 배포 전에 별도 저장소로 분리 필요 (빈 저장소 생성 후 `git push <remote> syncdev:master`). 지금은 보류
- 폴더명(`obsidian-star-graph`)과 plugin id(`syncdev`)가 다름. 브랜치를 바꾸면 Obsidian에서 플러그인을 다시 활성화해야 함
- 패키지 매니저는 pnpm. 셸 PATH에 pnpm이 없으면 `corepack pnpm <cmd>`
- lint warning 4개: 설정 placeholder sentence case 3개(의도된 값), `getSettingDefinitions` 권고 1개
- Obsidian 안에서 실제 동작 검증은 아직 안 함 (빌드, lint, 파서 스모크 테스트만 통과)
- `MarkdownRenderer.render`에 뷰 자신을 component로 넘기고 있어 재렌더 시 자식 컴포넌트가 누적될 수 있음. 2단계에서 렌더 전용 Component로 분리 검토
