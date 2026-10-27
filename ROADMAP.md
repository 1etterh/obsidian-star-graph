# SyncDev Roadmap

데일리 노트의 task를 모아 보는 백로그 플러그인(Kanban + Calendar, 상태 변경 기록). 브랜치: `syncdev`

## 핵심 원칙

- **최대한 간단하게**: 필요한 기능만, 새 설정·저장 형식·의존성은 꼭 필요할 때만 추가
- **Obsidian 내장 기능 우선**: 직접 만들기 전에 코어 기능(Daily notes, Canvas, 태그, 폴더, 블록 링크, Bases 등)과 공개 API로 해결할 수 있는지 먼저 확인
- task의 원본은 마크다운 체크박스, 플러그인은 인덱스와 뷰만 담당
- 날짜 표기는 Tasks 플러그인과 호환: `➕` 생성일, `⏳` 예정일(+시간), `📅` 마감일, `✅` 완료일(설정으로 선택, 기본 꺼짐)
- task는 **데일리 노트**에 작성 (코어 Daily notes 설정을 따르고, 플러그인 설정으로 덮어쓰기 가능)
- 다른 플러그인 코드를 복사하지 않고 Obsidian API로 직접 구현

## 진행 상황

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | parser, TaskIndex, TaskWriter, Backlog 뷰 | ✅ 완료 |
| 1.1 | Backlog를 메인 영역 전용 탭으로 열기 | ✅ 완료 |
| 1.2 | Backlog를 Todo / In progress / Done 보드로, 드래그로 상태 변경 (3.5에서 Todo / Today / Done으로 변경) | ✅ 완료 |
| 2 | Calendar 뷰 (월간 그리드, 날짜별 task 개수, 날짜 클릭 시 그날 task) | ✅ 완료 |
| 2.1 | 하나의 SyncDev 뷰에 Kanban / Calendar / Roadmap 탭 (3.7에서 Roadmap 제거) | ✅ 완료 |
| 2.2 | 프로젝트(폴더 + 태그), 공용 프로젝트 필터, Roadmap 탭 | ❌ 제거 (3.7) |
| 3 | 이벤트 스토밍(Canvas) 연동: 템플릿, 카드 분류·집계, 카드 → task | ❌ 제거 (3.7) |
| 3.1 | 프로젝트 허브(`SyncDev/index.md`)와 공용 프로젝트 메뉴 | ❌ 제거 (3.7) |
| 3.2 | 프로젝트 메뉴에 이름 변경·삭제 추가 | ❌ 제거 (3.7) |
| 3.3 | task 우클릭 "Assign to project…" (백로그 → 프로젝트) | ❌ 제거 (3.7) |
| 3.4 | task 상태 변경 기록(월별 로그 파일) | ✅ 완료 |
| 3.5 | In progress 제거 → Todo / Today / Done 보드 | ✅ 완료 |
| 3.6 | 완료 날짜 표기 선택화, 상태 로그 표 형식 | ✅ 완료 |
| 3.7 | 단순화: 프로젝트·DDD(이벤트 스토밍) 기능 제거, 백로그 추적만 유지 | ✅ 완료 |
| 4 | Timeline 뷰 + Backlog → Timeline 드래그로 `⏳ 날짜 시간` 기록 | 보류 (구체화할 때 구현) |
| 5 | 마감 지난 task 강조 강화, 단축키, 설정 검색 API(`getSettingDefinitions`) | 예정 |
| 6 | Obsidian Bases 연동: 프로젝트 index.md에 진행 상황 속성 기록 | ❌ 제거 (프로젝트 기능과 함께) |
| 7 | todo에 폴더 경로를 태그해서 묶어 보기 (예: `#work/syncdev`) | 아이디어 (구체화할 때 설계) |

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
- 리본 아이콘 하나(Open SyncDev), 명령 ID `open-backlog`/`open-calendar` 유지(이름만 Open kanban)
- 이전 view type(`syncdev-backlog`, `syncdev-calendar`)으로 저장된 탭은 열리지 않으니 닫고 다시 열기

### 3.4단계에 들어간 것

- 목적: 기록 보관. 방식: 볼트 안 월별 로그 `SyncDev/log/YYYY-MM.md`에 덧붙이기만 함
  - 형식: 3.6에서 표로 변경
- 감지: 노트가 다시 인덱싱될 때 이전/이후 task를 비교(`core/statusDiff.ts`). 블록 id로 먼저 짝짓고, 없으면 파일 안에서 내용이 유일하게 같은 task끼리. SyncDev 화면 변경과 노트에서 직접 체크한 변경을 같은 경로로 잡음. 내용이 같은 task가 여럿이면 기록하지 않음
- SyncDev 화면에서 상태를 바꾸면 그 줄에 `^sd-` 블록 id를 함께 붙임. 노트에서 직접 바꾼 경우에는 편집 중인 줄을 건드리지 않으려고 붙이지 않음(로그는 노트 링크 + 내용)
- 버그 수정: 블록 id가 있는 task를 완료하면 `✅ 날짜`가 블록 id 뒤에 붙어 블록 링크가 깨지던 문제. 블록 id를 항상 줄 끝에 유지

### 3.5단계에 들어간 것

- 체크박스는 `[ ]` / `[x]` 두 상태만 사용. `[/]`(Tasks 플러그인의 진행 중)는 기본 Obsidian에서 체크된 것처럼 보여서 제외. 기존 `[/]`는 미완료로 읽고, 다음 변경 때 `[ ]`로 바뀜
- 보드 열(`core/board.ts`): Today = 미완료 + `⏳` 오늘 이하(지난 예정일은 이월), Todo = 그 외 미완료, Done = 완료
- 이동(`TaskWriter.moveTo`, 한 번의 쓰기): Today로 → `⏳ 오늘`, Todo로 → `⏳` 제거, Done으로 → 체크(`⏳` 유지)
- Dated 필터는 Todo 열에만 적용(Today·Done에서 예정일 있는 task가 사라지지 않게)

### 3.6단계에 들어간 것

- 완료 시 `✅ 날짜`를 기본으로 붙이지 않음(설정 "Add done date", 기본 꺼짐). 기존 `✅`는 읽고, 다시 열면 제거. 완료 시점은 상태 로그에 남음
  - 영향: ✅ 없는 완료 task는 Calendar에서 예정일/마감일/데일리 노트 날짜에 놓임. Done 열은 ✅가 없으면 생성일 기준으로 정렬
- 상태 로그를 표로 기록: `| updatedAt | taskId | content | status |`(3.7에서 project 열 제거). 파일 끝이 표가 아니면 헤더부터 새로 시작, 셀 안의 `|`는 `\|`로 이스케이프

### 3.7단계: 단순화

- 프로젝트 관리와 DDD(이벤트 스토밍) 기능은 일단 빼고, 데일리 노트 task의 백로그 추적만 남김
- 제거: 프로젝트(폴더·태그·필터·허브 노트·메뉴·Assign to project), Roadmap 탭, 이벤트 스토밍 Canvas 연동, 관련 설정·스타일
- 유지: Kanban(Todo / Today / Done) + Calendar 탭, 툴바 필터(Dated, Done, 정렬)와 설정의 폴더 포함·제외, 상태 변경 로그(`SyncDev/log/YYYY-MM.md`)
- 이후 아이디어(7): 프로젝트 대신 todo에 폴더 경로를 태그로 붙여 묶어 보기. 제거한 태그 파싱·필터 코드(`ad5cb7b`)를 참고할 수 있음
- 제거한 코드는 `ad5cb7b` 커밋에 남아 있으니 다시 필요하면 거기서 가져오기. 볼트에 이미 만든 `SyncDev/projects/`, 캔버스, 허브 노트는 그대로 둠

## 남은 이슈 / 메모

- 리본 아이콘: `icons/E-window-code.svg`(창 + `</>`). `icons/`에 다른 시안(원형 로고, 달력 + 로고, sync 화살표)도 보관

- 저장소: `obsidian-star-graph` fork 안에 `star`(star-graph)와 `syncdev`가 브랜치로 공존. 공개 배포 전에 별도 저장소로 분리 필요 (빈 저장소 생성 후 `git push <remote> syncdev:master`). 지금은 보류
- 폴더명(`obsidian-star-graph`)과 plugin id(`syncdev`)가 다름. 브랜치를 바꾸면 Obsidian에서 플러그인을 다시 활성화해야 함
- 패키지 매니저는 pnpm. 셸 PATH에 pnpm이 없으면 `corepack pnpm <cmd>`
- lint warning 6개: 설정 placeholder sentence case 3개, 'SyncDev' 이름 2개(의도된 값), `getSettingDefinitions` 권고 1개
- Obsidian 안에서 실제 동작 검증은 아직 안 함 (빌드, lint, 파서 스모크 테스트만 통과)
