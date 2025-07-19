# MagicUI 组件库

MagicUI 是一个包含多种动画效果组件的库，用于增强 React 应用的用户界面体验。

## 可用组件

- `BlurFade`: 模糊淡入效果组件
- `TextAnimate`: 文本动画组件
- `TypingAnimation`: 打字动画组件
- `DotPattern`: 点图案背景组件

## 组件用法示例

### BlurFade

```tsx
import { BlurFade } from "@/components/magicui/blur-fade";

// 基本用法
<BlurFade animation="blurInUp" by="line" as="p">
  <Main />
</BlurFade>

// 其他可用动画
<BlurFade animation="slideLeft">...</BlurFade>
<BlurFade animation="fadeIn" by="line" as="p">...</BlurFade>
<BlurFade animation="scaleUp" by="text">...</BlurFade>
<BlurFade animation="slideUp" by="word">...</BlurFade>
```

### TextAnimate

```tsx
import { TextAnimate } from "@/components/magicui/text-animate";

<TextAnimate animation="blurInUp" by="character" duration={5}>
  Blur in by character
</TextAnimate>
```

### TypingAnimation

```tsx
import { TypingAnimation } from "@/components/magicui/typing-animation";

<TypingAnimation>
  Typing Animation
</TypingAnimation>
```

### DotPattern

```tsx
import { DotPattern } from "@/components/magicui/dot-pattern";

<div className="relative h-[500px] w-full overflow-hidden">
  <DotPattern />
</div>
```

## 导入所有组件

```tsx
import { BlurFade } from "@/components/magicui/blur-fade";
import { TextAnimate } from "@/components/magicui/text-animate";
import { TypingAnimation } from "@/components/magicui/typing-animation";
import { DotPattern } from "@/components/magicui/dot-pattern";
```

## 注意事项

1. 确保在使用这些组件前已经安装了必要的依赖
2. 部分动画效果可能需要根据具体项目进行样式调整
3. 对于性能敏感的应用，建议适当调整动画的持续时间和复杂度