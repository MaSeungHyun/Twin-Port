# 스타일_코드 관련 안내 문서입니다.

에디터 우측 상단에 `Preview`와 `Markdown`이 있습니다 `Preview`를 클릭하시면 문서를 좀 더 편하게 보실 수 있습니다. ↗↗↗↗↗

## 1. 색상 토큰

`--color-이름`으로 정의하면 Tailwind에서 `bg-이름`, `text-이름`, `border-이름`, `stroke-이름`, `fill-이름`으로 바로 쓸 수 있습니다.


| 토큰                                      | 값                     | 사용 예                                     |
| --------------------------------------- | --------------------- | ---------------------------------------- |
| `--color-background`                    | `#042938`             | `bg-background`                          |
| `--color-text-primary`                  | `#04DBBA`             | `text-text-primary`                      |
| `--color-side-up` / `--color-side-down` | `#042938` / `#061317` | `from-side-up to-side-down` (사이드바 그라데이션) |


- 투명도는 `/숫자`로 붙입니다: `bg-cyber/15` = cyber 색 15%.
- 토큰 이름이 `text-primary`라서 글자색 클래스는 `text-text-primary`처럼 두 번 겹쳐 보이는 게 정상입니다.



## 2. 아이콘

- 채워진 모양이 필요할 때만 `fill-*`.
- 선 두께: `stroke-1`, `stroke-2` (`strokeWidth` 속성도 가능).

---


## 3. 버튼 상태 작성법 ⭐
### 핵심 규칙

> 버튼 안의 아이콘은 같은 이름에 `group-`을 붙인다 → `group-hover:` `group-aria-pressed:` `group-disabled:`
> → 그래야 버튼의 상태를 아이콘이 알 수 있어 버튼에 마우스를 올리면 같이 작동합니다.


| 상태                      | 버튼 스타일                          | 안쪽 아이콘 스타일                              |
| ----------------------- | ------------------------------- | --------------------------------------- |
| 기본                      |                                 | `bg-transparent`                        |
| 마우스 올림 (hover)          | `hover`:bg-cyber/10             | `group-hover`:stroke-icon-hover`        |
| 누르는 순간 (pressed)        | `active`:scale-95`              | `group-active`:stroke-icon-active       |
| 선택됨 (active / 켜짐)       | `aria-pressed`:bg-cyber/15      | `group-aria-pressed`:stroke-icon-active |
| 비활성 (disabled)          | `disabled`:opacity-40           | `group-disabled`:stroke-icon-disabled   |
| 키보드 포커스 (Tab 포커스 되는 상황) | `focus-visible`:outline-primary | –                                       |


### 예시 (사이드 카테고리 버튼)

```tsx
<Button
  aria-label={label}
  aria-pressed={active}          // 개발자가 선택 여부만 넘겨줌
  className={cn(
    "group flex aspect-square w-full items-center justify-center",   // group 필수
    "hover:bg-cyber/10",
    "aria-pressed:border aria-pressed:border-cyber/40 aria-pressed:bg-cyber/15",
    "aria-pressed:shadow-[0_0_12px_rgba(0,232,255,0.25)]",
    "disabled:cursor-not-allowed disabled:opacity-40",
  )}
>
  <Icon
    icon={icon}
    className={cn(
      "stroke-icon-default",
      "group-hover:stroke-icon-hover",
      "group-aria-pressed:stroke-icon-active",
      "group-disabled:stroke-icon-disabled",
    )}
  />
</Button>
```

## 오브젝트 Hover시 Outline 색상

`📄src/constants/hoverOutline.ts` 에서 정의

```typescript
// 📄src/constants/hoverOutline.ts
/** 선박·크레인 hover — TSL inverted-hull 외곽선 색 */
export const HOVER_OUTLINE_COLOR = "#ff8c00";
/** 외곽선 두께 (메시 로컬 단위, 노멀 방향 extrude — 구 drei Outlines 기본 모드와 동일) */
export const HOVER_OUTLINE_THICKNESS = 0.5;

// ⚠️ 위 색상 변경해주시면 적용되나 그래픽카드에 다시 그려달라 전달해서 살짝 멈출 수 있습니다!
```
---

## Font

font는 index.css에 정의되어 있습니다.

```css
@theme
// 한글은 Pretendard, 영문은 Noto Sans가 적용
--font-sans: font-font-sans를 사용하시면 Noto Sans 적용됩니다.
--font-display: Pretendard를 사용하고 있으며 안될경우 "Noto Sans KR"로 대체
```

---

## 초기 관제시작 버튼

📄IntroOverlay.tsx

1. 배경은 61번째 의 className을 수정
2. 의 className 수정해주시면 됩니다





## 📂 아이콘 파일명

| 파일명              | 설명                                 |
| ---------------- | ---------------------------------- |
| Content          | 왼쪽 사이드바의 아이콘을 뿌립니다.                |
| Status           | 화면 헤더 중앙의 항만 상태를 나타내는 값들입니다.       |
| header/index.tsx | 우측에 Monitoring, 오큐펀시, 보기옵션, 알람 아이콘 |

전체 아이콘은  📄IconButton.tsx를 수정해주시면 됩니다.

개별적으로 스타일을 다르게 적용할 경우 아이콘은 파일을 찾아 `className`에 값을 넣어주시면 됩니다.

```typescript
//⚠️ 사이드바를 기준으로 아이콘 버튼(IconButton.tsx)을 만들어 상단을 통일해 놓았습니다.
// 개별적인 상태가 필요한 경우 아래 처럼 작성해주시면 위 친구만 배경이 빨간색이 적용됩니다.
<IconButton className={"bg-red-500"}/>
```


## 📂 컨텐츠 패널들의 파일명

좌측 컨텐츠가 활성화되어 나오는 패널

📄 CyberHeading.tsx
(BlockContent.tsx / ContainerContent.tsx )

각 패널의 상단 타이틀

📄 BlockAccordion.tsx가 Block 내용물
📄 ContainerAccordion.tsx가 Container 내용물

---

📄 ShipContentPanel.tsx
배 리스트

📄 CraneContentPanel.tsx
크레인 리스트

📄 ContentDetailLayout.tsx
배/크레인 상세 리스트