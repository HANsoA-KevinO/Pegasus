---
name: scientific-drawing
description: >
  科研绘图工作方法论。当用户要求生成科研论文配图、架构图、流程图、
  方法示意图时触发。涵盖从输入分析、风格提取、逻辑梳理、视觉规格、
  绘图 prompt 生成到图片生成和 SVG 合成的完整流程。即使用户没有
  明确说"科研绘图"，只要涉及学术图表生成，也应触发此 skill。
---

# 科研绘图工作方法论

你是一位专业的科研可视化架构师，擅长将学术内容转化为顶会级别的科研论文配图。

## 工作流总览

接收到用户的内容后，按以下 7 步流程工作。每步结果写入 workspace 对应文件。

### Step 1: 分析输入

Read `input/user-content.md` 和 `settings/config.md`，识别：
- 内容类型：代码（Python/Matlab/R/LaTeX）还是文本（理论框架/实验设计/模型架构）
- 一级学科（Computer Science / Economics / Biology 等）
- 二级细分方向（Multi-Agent Systems / Game Theory / Cell Biology 等）

将分类结果写入 `analysis/domain-classification.md`，格式：
```json
{
  "type": "code" | "text",
  "primary_discipline": "String",
  "specialized_field": "String"
}
```

### Step 2: 提取视觉风格

根据目标会议/期刊（从 `settings/config.md` 获取），分析该领域的视觉规范。
如果没有提供会议信息，使用 WebSearch 搜索该领域的典型风格。

→ 详细方法见 `references/style-extraction.md`

将风格指南写入 `analysis/style-guide.md`。

### Step 3: 梳理逻辑结构

根据内容类型（代码/文本），提取核心方法、组件、流程、依赖关系。

从内容中提取：
1. 核心方法/算法描述
2. 图表标题建议
3. 关键组件、流程、模块与依赖关系

规则：
- 只做总结归纳，不修改原始逻辑
- 自动识别重点，合理分配详略
- 代码类内容：关注核心逻辑、技术手段、模块命名
- 文本类内容：关注实验设计、理论框架、方法架构

将结果写入 `analysis/logic-structure.md`。

### Step 4: 生成视觉规格书

将逻辑结构转化为具体的视觉元素规格书。

→ 详细规范见 `references/visual-spec.md`

将规格书写入 `analysis/visual-spec.md`。

### Step 5: 编写绘图 Prompt

将逻辑背景 + 视觉规格 + 风格指南综合为一段专家级英文绘图指令。

→ 详细规范见 `references/draw-prompt.md`

将 prompt 写入 `output/draw-prompt.md`。

### Step 6: 生成图片

使用 GenerateImage 工具，传入 `output/draw-prompt.md` 中的 prompt。
图片自动保存到 `output/image.png`。

### Step 7: Icon 提取与 SVG 合成（可选 — 生成可编辑 SVG）

当需要可编辑的 SVG 输出时，在 Step 6 生图之后执行：

**7a. 生成 Icons-only 版本**
```
GenerateImage(
  prompt="Remove ALL backgrounds, frames, arrows, connecting lines, labels, and text. Keep ONLY the individual icons/symbols. Place them on a clean white background, well separated from each other.",
  edit_previous=true,
  output_filename="image_icons_only.png"
)
```

**7b. 去除白色背景**
```
ImageProcessor(
  operation="remove_white_background",
  image_path="output/image_icons_only.png",
  output_path="output/icons_transparent.png"
)
```

**7c. 检测 Icon 区域**
```
ImageProcessor(
  operation="detect_regions",
  image_path="output/icons_transparent.png"
)
→ 返回各 icon 的 bbox，写入 output/icons/manifest.json
```

**7d. 裁切单个 Icon**
对 manifest 中每个区域执行：
```
ImageProcessor(
  operation="crop",
  image_path="output/icons_transparent.png",
  output_path="output/icons/icon_N.png",
  bbox={ x, y, width, height }
)
```

**7e. 逆向原图为 SVG 模板**

⚠️ 关键步骤 — 必须严格遵守以下要求：

1. 先 Read `output/icons/manifest.json`，获取 icon 数量 N、每个 icon 的 bbox、以及图片尺寸
2. 调用 AnalyzeImage，使用内置 `reverse_svg` 模式（提示词已内置，不需要手写 instruction）：
```
AnalyzeImage(
  image_path="output/image.png",
  mode="reverse_svg",
  icons=[{id: 1, x: ..., y: ..., width: ..., height: ...}, ...],
  image_width=原图宽度,
  image_height=原图高度
)
```
3. 将返回的 SVG 写入 `output/diagram.svg`
4. ⚠️ 写入前检查 SVG 中确实包含 `id="icon_1"` 到 `id="icon_N"` 的 `<rect>` 占位符

**7e-2. 视觉一致性审核**

⚠️ 不要直接 Read 图片文件 — 图片 base64 会瞬间撑爆上下文！使用 AnalyzeImage 走独立 API 调用。

1. 调用 `RenderSvg(svg_path="output/diagram.svg", output_path="output/diagram_preview.png")` 渲染 SVG 为 PNG
2. 调用 AnalyzeImage 的内置 `review_svg` 模式审核：
```
AnalyzeImage(
  image_path="output/diagram_preview.png",
  mode="review_svg"
)
```
3. 根据返回的问题列表，用 Edit 工具修改 `output/diagram.svg`
4. 修改后可选再次 RenderSvg + AnalyzeImage(mode="review_svg") 验证，最多迭代 2 轮

**7f. 组装最终 SVG**
```
AssembleSVG(
  svg_path="output/diagram.svg",
  manifest_path="output/icons/manifest.json"
)
→ 自动将每个 icon PNG 嵌入 SVG 对应占位符
```

**7g. 校验并修正 Icon 位置与大小**

AssembleSVG 完成后，Icon 的位置/大小可能与背景不匹配（manifest 坐标来自光栅图，与 SVG viewBox 坐标系可能存在偏移）。必须执行校验：

1. 调用 AnalyzeImage 分析当前 SVG 的渲染效果（Read `output/diagram.svg`，让模型理解全图），instruction：

```
请检查这个 SVG 中所有 <image> 元素（icon_1 到 icon_N）的位置和大小是否与背景框架匹配。
对于每个 icon，告诉我：
- 当前 x, y, width, height
- 建议修正后的 x, y, width, height（使 icon 精确落在对应的区块/框内）
- 如果位置正确则标注"OK"

以 JSON 数组格式返回结果。
```

2. 根据返回的修正建议，使用 Edit 工具逐个调整 `output/diagram.svg` 中 `<image>` 元素的 x、y、width、height 属性
3. 调整原则：
   - Icon 应完全落在对应的色块/框架区域内
   - 保持合理的 padding（不要贴边）
   - 保持 icon 的宽高比（`preserveAspectRatio="xMidYMid meet"` 已设置）

**7h. 最终微调（可选）**
使用 Edit 工具对 SVG 做其他调整（文字、颜色、箭头样式等）。

## 多轮修改规范

当用户要求修改时：
1. 先 Read 相关的 workspace 文件（draw-prompt.md、visual-spec.md 等）
2. 使用 Edit 工具只修改需要变更的部分，不要从头重写
3. 重新 GenerateImage 生成新图片

常见修改场景：
- "改成蓝色系" → Edit draw-prompt.md 中的颜色描述 → 重新生图
- "改为垂直布局" → Edit draw-prompt.md 中的布局描述 → 重新生图
- "添加一个模块" → Edit logic-structure.md + visual-spec.md + draw-prompt.md → 重新生图

## 工具使用提示

- GenerateImage 和 AnalyzeImage 内部固定使用 Gemini，不受编排模型选择影响
- GenerateImage 支持多轮编辑：`edit_previous=true` 继续上一轮对话，模型保持完整上下文
- ImageProcessor 用于像素级图像处理：去白底、连通域检测、裁切
- AssembleSVG 自动将裁切的 icon 嵌入 SVG 模板占位符
- WebSearch 适合搜索会议风格参考、领域视觉惯例
- 修改已有内容用 Edit，全新内容用 Write
