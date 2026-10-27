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
| 1.2 | Backlog를 Todo / In progress / Done 보드로, 드래그로 상태 변경 (3.5에서 Todo / Today / Done으로 변경) | ✅ 완료 |
| 2 | Calendar 뷰 (월간 그리드, 날짜별 task 개수, 날짜 클릭 시 그날 task) | ✅ 완료 |
| 2.1 | 하나의 SyncDev 뷰에 Kanban / Calendar / Roadmap 탭 | ✅ 완료 |
| 2.2 | 프로젝트(폴더 + 태그), 공용 프로젝트 필터, Roadmap 탭 | ✅ 완료 |
| 3 | 이벤트 스토밍(Canvas) 연동: 템플릿, 카드 분류·집계, 카드 → task | ✅ 완료 |
| 3.1 | 프로젝트 허브(`SyncDev/index.md`)와 공용 프로젝트 메뉴 | ✅ 완료 |
| 3.2 | 프로젝트 메뉴에 이름 변경·삭제 추가 | 보류 (구체화할 때 구현) |
| 3.3 | task 우클릭 "Assign to project…" (백로그 → 프로젝트) | ✅ 완료 |
| 3.4 | task 상태 변경 기록(월별 로그 파일) | ✅ 완료 |
| 3.5 | In progress 제거 → Todo / Today / Done 보드 | ✅ 완료 |
| 4 | Timeline 뷰 + Backlog → Timeline 드래그로 `⏳ 날짜 시간` 기록 | 보류 (구체화할 때 구현) |
| 5 | 마감 지난 task 강조 강화, 단축키, 설정 검색 API(`getSettingDefinitions`) | 예정 |

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

### 2.2단계에 들어간 것

- 프로젝트 = `SyncDev/projects/`(설정 가능, 처음엔 `SyncDev/`였음) 바로 아래 폴더. 소속: 프로젝트 폴더 안 노트의 task, 또는 줄에 프로젝트 태그가 있는 task
- 태그 = 폴더 이름(공백 → `-`, 태그에 못 쓰는 문자 제거), 대소문자 무시. 폴더 이름과 일치하는 태그만 프로젝트로 인정
- `core/projects.ts`: `ProjectRegistry`(폴더 목록 캐시, 소속 판정, 필터, 이름 해시 기반 색), 폴더 생성/삭제/이름 변경 시 갱신
- 폴더 이름 변경 시 확인 모달 후 task 줄의 태그 일괄 변경(`TaskWriter.renameTag`), 숨김 목록도 새 이름으로
- 탭 바 오른쪽 프로젝트 필터(드롭다운 + 체크박스, "No project" 포함): Kanban, Calendar, Roadmap 공용, 설정에 저장
- task 행: 프로젝트 태그를 본문에서 빼고 색 라벨로 표시. Calendar 칸: 프로젝트 색 점
- Roadmap 탭: 프로젝트 카드(진행률 바, todo/in progress/done 개수, 미완료 task 목록), New project 버튼과 명령
- `AddTaskModal` → 범용 `PromptModal`

### 3단계에 들어간 것

- 결정: 프로젝트 식별은 이름 태그 유지(B안), 스토밍 도구는 Canvas(JSON Canvas 공개 형식이라 연동 가능, 협업·확장 고려)
- `core/storming/model.ts`: 도구 독립 모델(StormBoard/StormCard, 카드 종류 8개와 hex 색 규칙)
- `core/storming/canvasAdapter.ts`: `.canvas` → 모델. 색(hex 또는 Obsidian 프리셋 1~6)으로 종류 판정, 가장 안쪽 그룹 = bounded context, `Legend` 그룹 제외
- New project 시 색 범례가 든 `event-storming.canvas` 생성
- 카드 → task: 오늘 데일리 노트에 `- [ ] 카드 첫 줄 #프로젝트 [[캔버스]] ➕ 날짜 ^sd-xxxxxx`, 카드에는 `→ [[데일리#^sd-xxxxxx|task]]` 추가. `^sd-` 링크가 있는 카드는 다시 만들지 않음
- 캔버스 카드 우클릭 / 다중 선택 우클릭 "Create task", 명령 "Create tasks from command cards in this canvas", Roadmap 카드의 일괄 버튼
- 열린 캔버스는 내부 node API(`setText`, `requestSave`)로 수정, 닫혀 있으면 파일 직접 수정
- Roadmap 카드: 캔버스 링크, 이벤트·커맨드·애그리게잇·컨텍스트 개수
- task 행의 내부 링크 클릭 시 새 탭에서 열기, task 텍스트에서 끝의 블록 id 숨김

### 3.1단계에 들어간 것

- 프로젝트 기본 위치를 `SyncDev/projects/`로 변경, 없는 상위 폴더는 단계별로 생성
- 허브 노트: 첫 프로젝트 생성 시 프로젝트 루트의 상위 폴더에 `index.md`(```` ```syncdev-projects``` ```` 코드 블록) 자동 생성. 코드 블록은 프로젝트 목록(색, 진행률, 미완료 개수, 캔버스 링크)과 New project 버튼으로 렌더링, task·폴더·캔버스 변경 시 갱신
- 공용 프로젝트 메뉴(`views/projectMenu.ts`): New event storming canvas(이름 검증), Create tasks from commands, Open index note, Show in roadmap, Hide/Show in filter
- 메뉴 진입점 3곳: 파일 탐색기 프로젝트 폴더 우클릭(`file-menu`, 공개 API), 허브 목록 행 우클릭, Roadmap 카드 우클릭
- task 출처와 데일리 노트 열기는 새 탭에서 (SyncDev 탭 유지)
- 진행률 계산을 `core/projectStats.ts`로 공유

### 3.3단계에 들어간 것

- 프로젝트 없이 단순 백로그로도 사용 가능(태그 없는 task = No project). 논의한 "프로젝트 0개일 때 UI 자동 축소"와 "Use projects 설정 스위치"는 이번에 하지 않음
- task 우클릭 "Assign to project…" → 프로젝트 검색 선택(`FuzzySuggestModal`, 공개 API에 submenu가 없어서). 현재 프로젝트 태그를 빼고 새 태그를 날짜 표기와 블록 id 앞에 삽입, "No project"로 태그 제거
- 프로젝트 폴더 안 노트의 task는 폴더가 소속을 정하므로 지정 불가 안내
- `TaskWriter`의 줄 수정(stale 검사 포함)을 `rewriteLine`으로 공통화
- Kanban 상단 입력창 제거 → Todo 열 제목 오른쪽 `+` 버튼, 누르면 Todo 열 맨 위에 입력줄(Enter 추가 후 유지, Esc·빈 채로 포커스 이탈 시 닫힘). 열은 한 번만 만들고 렌더 때 목록만 교체해 입력 중 포커스 유지
- Calendar 날짜 패널도 같은 방식(제목 줄 `+` → 목록 위 입력줄). 공용 `views/taskComposer.ts`

### 3.4단계에 들어간 것

- 목적: 기록 보관. 방식: 볼트 안 월별 로그 `SyncDev/log/YYYY-MM.md`에 덧붙이기만 함
  - 형식: `- 2026-10-27 14:32 · todo → in progress · [[노트#^sd-xxxx|task 내용]] (프로젝트)`
- 감지: 노트가 다시 인덱싱될 때 이전/이후 task를 비교(`core/statusDiff.ts`). 블록 id로 먼저 짝짓고, 없으면 파일 안에서 내용이 유일하게 같은 task끼리. SyncDev 화면 변경과 노트에서 직접 체크한 변경을 같은 경로로 잡음. 내용이 같은 task가 여럿이면 기록하지 않음
- SyncDev 화면에서 상태를 바꾸면 그 줄에 `^sd-` 블록 id를 함께 붙임. 노트에서 직접 바꾼 경우에는 편집 중인 줄을 건드리지 않으려고 붙이지 않음(로그는 노트 링크 + 내용)
- 버그 수정: 블록 id가 있는 task를 완료하면 `✅ 날짜`가 블록 id 뒤에 붙어 블록 링크(캔버스 카드 → task)가 깨지던 문제. 블록 id를 항상 줄 끝에 유지

### 3.5단계에 들어간 것

- 체크박스는 `[ ]` / `[x]` 두 상태만 사용. `[/]`(Tasks 플러그인의 진행 중)는 기본 Obsidian에서 체크된 것처럼 보여서 제외. 기존 `[/]`는 미완료로 읽고, 다음 변경 때 `[ ]`로 바뀜
- 보드 열(`core/board.ts`): Today = 미완료 + `⏳` 오늘 이하(지난 예정일은 이월), Todo = 그 외 미완료, Done = 완료
- 이동(`TaskWriter.moveTo`, 한 번의 쓰기): Today로 → `⏳ 오늘`, Todo로 → `⏳` 제거, Done으로 → 체크(`⏳` 유지)
- Dated 필터는 Todo 열에만 적용(Today·Done에서 예정일 있는 task가 사라지지 않게)
- Roadmap 카드: open / done 개수, 미완료 task는 Today 먼저

### 3.2단계 메모 (보류)

- 이름 변경: 폴더 이름 변경 + 기존 태그 일괄 수정 확인 창(`projectEvents.ts`)과 연결
- 삭제: 실수 방지 확인 필요. 폴더만 지울지, 태그가 붙은 task는 어떻게 할지 결정 필요

## 남은 이슈 / 메모

- 저장소: `obsidian-star-graph` fork 안에 `star`(star-graph)와 `syncdev`가 브랜치로 공존. 공개 배포 전에 별도 저장소로 분리 필요 (빈 저장소 생성 후 `git push <remote> syncdev:master`). 지금은 보류
- 폴더명(`obsidian-star-graph`)과 plugin id(`syncdev`)가 다름. 브랜치를 바꾸면 Obsidian에서 플러그인을 다시 활성화해야 함
- 패키지 매니저는 pnpm. 셸 PATH에 pnpm이 없으면 `corepack pnpm <cmd>`
- lint warning 8개: 설정 placeholder sentence case 4개, 'SyncDev' 이름 2개, 명령 이름의 도메인 용어 'command' 1개(의도된 값), `getSettingDefinitions` 권고 1개
- Obsidian 안에서 실제 동작 검증은 아직 안 함 (빌드, lint, 파서 스모크 테스트만 통과)
- 설정의 Include folders를 지정하면 프로젝트 폴더 안 task도 그 범위에 들어가야 인덱싱됨
- 캔버스 우클릭 메뉴(`canvas:node-menu`, `canvas:selection-menu`)와 node API는 비공개 API. Obsidian 업데이트 시 깨질 수 있음
