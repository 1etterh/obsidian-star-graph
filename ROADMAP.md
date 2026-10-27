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
| 1.2 | Backlog를 Todo / In progress / Done 보드로, 드래그로 상태 변경 | ✅ 완료 |
| 2 | Calendar 뷰 (월간 그리드, 날짜별 task 개수, 날짜 클릭 시 그날 task) | ✅ 완료 |
| 2.1 | 하나의 SyncDev 뷰에 Kanban / Calendar / Roadmap 탭 | ✅ 완료 (Roadmap 내용 미정) |
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

### 1.2단계에 들어간 것

- 상태는 체크박스 문자로 저장 (Tasks 플러그인 호환): `[ ]` Todo, `[/]` In progress, `[x]` Done. 그 외 문자(`-` 등)는 Done으로 취급
- `parser.setTaskStatus`: 상태 변경 시 Done이면 `✅ 오늘` 추가, 아니면 `✅` 제거
- `views/taskRow.ts`: task 행 렌더링을 분리, HTML5 drag and drop + 우클릭(모바일 길게 누르기) "Move to …" 메뉴
- Done 열은 완료일 최신순으로 최근 30개만 표시 (헤더 숫자는 전체 개수)
- 툴바 "Done" 토글(설정 "Show done column"과 동일 값, 저장됨)로 Done 열 숨기기. 보드·열 스크롤바는 4px
- 컬럼 안 순서 변경(수동 정렬)은 없음. 순서는 정렬 기준(생성일)으로만 결정
- 렌더마다 전용 `Component`를 만들어 이전 보드의 마크다운 자식 컴포넌트를 해제

### 2단계에 들어간 것

- `views/calendarView.ts`: 메인 영역 탭, 6주 고정 월간 그리드(locale 주 시작일), 이전/다음/Today
- task가 놓이는 날짜: 완료 task는 `✅` 날짜, 미완료는 `⏳` → `📅` → 데일리 노트 날짜 순
- 칸마다 미완료 개수 배지 + 완료 `✓N` 배지, 다른 달 날짜 클릭 시 그 달로 이동
- 아래 패널: 선택한 날짜의 task(미완료 먼저), 그날 데일리 노트 열기, 그날 데일리 노트에 task 추가
- `TaskWriter.addToToday` → `addToDaily(text, date)`로 일반화, `openTask`를 taskRow로 공유
- 명령 `open-calendar`, 리본 아이콘 추가

### 2.1단계에 들어간 것

- `views/syncdevView.ts`: 메인 영역 탭 하나(`syncdev` view type), 위쪽 탭 바로 패널 전환. 선택한 탭은 view state로 workspace에 저장
- Backlog/Calendar 뷰를 `Component` 기반 패널(`kanbanPanel.ts`, `calendarPanel.ts`)로 전환, 탭 전환 시 이전 패널 unload
- 정렬 함수는 `core/sort.ts`로 이동
- 리본 아이콘 하나(Open SyncDev), 명령 ID `open-backlog`/`open-calendar` 유지(이름만 Open kanban), `open-roadmap` 추가
- 이전 view type(`syncdev-backlog`, `syncdev-calendar`)으로 저장된 탭은 열리지 않으니 닫고 다시 열기

## 남은 이슈 / 메모

- 저장소: `obsidian-star-graph` fork 안에 `star`(star-graph)와 `syncdev`가 브랜치로 공존. 공개 배포 전에 별도 저장소로 분리 필요 (빈 저장소 생성 후 `git push <remote> syncdev:master`). 지금은 보류
- 폴더명(`obsidian-star-graph`)과 plugin id(`syncdev`)가 다름. 브랜치를 바꾸면 Obsidian에서 플러그인을 다시 활성화해야 함
- 패키지 매니저는 pnpm. 셸 PATH에 pnpm이 없으면 `corepack pnpm <cmd>`
- lint warning 6개: 설정 placeholder sentence case 3개와 'SyncDev' 이름 2개(의도된 값), `getSettingDefinitions` 권고 1개
- Obsidian 안에서 실제 동작 검증은 아직 안 함 (빌드, lint, 파서 스모크 테스트만 통과)
