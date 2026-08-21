# SimpleVTT 주사위 Tauri 물리 샌드박스

이 폴더는 SimpleVTT 본체와 분리된 **주사위 연출 전용 실험 앱**이다.

기준 문서:

- `docs/design/ui-ux/DICE-PRESENTATION.md`

## 이번 테스트가 검증하는 것

- 화면 전체가 별도 트레이가 아닌 하나의 테이블처럼 느껴지는지;
- d4 / d6 / d8 / d10 / d12 / d20이 실제 rigid-body로 던져지는지;
- 바닥 충돌, 바운스, 구름, 마찰, 감속이 자연스러운지;
- 여러 주사위가 같은 물리 월드에서 자연스럽게 공존하고 닿을 때 충돌하는지;
- 주사위가 화면 밖으로 유실되지 않도록 하는 보이지 않는 경계가 거슬리지 않는지;
- 결과 면을 강제로 돌려 맞추지 않은 상태에서 실제 물리 손맛이 어떤지;
- 목표 리듬인 약 1~1.5초에 가까운 자연 정지가 가능한지.

이 앱은 Session, Actor, Command Center, 게임 규칙, Host-authoritative result를 테스트하지 않는다.

## Windows 실행

저장소를 최신으로 받은 뒤 PowerShell에서:

```powershell
cd SimpleVTT\experiments\dice-tauri-sandbox
npm install
npm run tauri:dev
```

Tauri 개발 환경이 처음이라면 Rust와 Windows C++ Build Tools가 필요하다. SimpleVTT 본체의 Tauri 개발 환경이 이미 실행되는 컴퓨터라면 별도 추가 설정은 보통 필요 없다.

## 조작

```text
Space  선택한 주사위 던지기
M      d4/d6/d8/d10/d12/d20 한 개씩 혼합 투척
R      테이블 정리
H      컨트롤 패널 숨기기/열기
```

기본적으로 주사위끼리 충돌은 켜져 있다. 충돌을 일부러 유도하지 않으며, 실제 궤적상 닿았을 때만 반응한다.

`경계 보기`를 켜면 화면 밖 유실을 막는 invisible collider의 내부 안전 영역을 확인할 수 있다. 제품에서는 이 경계선이 보이지 않는다.

## 프리셋

- `기본`: 첫 비교 기준;
- `묵직`: 중력/마찰/감쇠를 높여 무게감 강조;
- `탄성`: 바운스와 이동을 더 오래 관찰;
- `빠름`: 1~1.5초 리듬을 강하게 노리는 비교값.

프리셋은 최종 제품 값이 아니다. 세부 물리값 슬라이더를 움직여 체감이 좋은 범위를 찾기 위한 출발점이다.

## 중요한 차이: 현재 SimpleVTT 주사위와 이 샌드박스

기존 `src/PhysicsDice3D.tsx`는 연결된 결과 표시를 위해 일정 시점 뒤 목표 결과 면으로 시각 quaternion을 보정하는 경로가 있다.

이 샌드박스는 첫 물리 손맛 검증을 위해 **결과 면 강제 보정을 하지 않는다.** Cannon의 실제 접촉/마찰/감쇠/sleep 결과만 관찰한다.

물리감이 승인된 뒤에만 이 테스트에서 확정한 geometry/camera/throw/contact 값을 authoritative-result convergence 계층과 다시 결합한다.

## 현재 실험상의 주의점

- d10은 첫 물리 비교를 위해 현재 SimpleVTT와 동일 계열의 10면 convex geometry를 사용한다. 외형을 최종 승인하는 단계는 아니다.
- 숫자 배치는 면 식별을 위한 테스트용이며 공식 주사위의 opposite-face numbering 규칙을 아직 고정하지 않는다.
- `자연 정지 N초`는 모든 활성 body가 Cannon sleep 상태에 들어간 첫 시점을 측정한다.
