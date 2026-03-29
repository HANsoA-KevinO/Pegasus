import { ToolResult } from '../types'
import { WorkspaceInstance } from '../workspace/types'

interface AnalyzeImageInput {
  image_path: string
  instruction?: string
  /** Built-in mode: 'reverse_svg' embeds the full SVG reverse-engineering prompt */
  mode?: 'reverse_svg' | 'review_svg'
  /** For reverse_svg mode: icon placeholder info from manifest */
  icons?: Array<{ id: number; x: number; y: number; width: number; height: number }>
  /** For reverse_svg mode: original image dimensions */
  image_width?: number
  image_height?: number
}

const VISION_MODEL = 'google/gemini-3.1-pro-preview'

/**
 * Build the SVG reverse-engineering prompt with icon info baked in.
 */
function buildReverseSvgPrompt(
  icons: Array<{ id: number; x: number; y: number; width: number; height: number }>,
  width: number,
  height: number,
): string {
  const iconList = icons
    .map(i => `  - id="icon_${i.id}" x="${i.x}" y="${i.y}" width="${i.width}" height="${i.height}"`)
    .join('\n')

  return `请根据此科研图表生成一个高保真 SVG 文件，要求像素级别的精确复现。

尺寸要求（必须严格遵守）：
- 原图尺寸为 ${width} x ${height} 像素
- SVG 必须设置 viewBox="0 0 ${width} ${height}"
- SVG 必须设置 width="${width}" height="${height}"
- 不要缩放或调整尺寸

矢量元素精确还原：
1. 用纯 SVG 矢量元素重建图中的所有视觉元素
2. 箭头和连线：必须精确还原原图中的形态（直线、曲线、折线等）、头部形状、粗细、颜色、起止位置，使用任何合适的 SVG 元素实现即可
3. 文字：保持原图中的字体大小、颜色、字重（粗体/常规）、对齐方式，位置精确匹配
4. 线条/边框：保持原图中的线条样式（实线/虚线）、颜色、粗细
5. 背景色块：保持颜色、圆角、渐变等视觉效果

Icon 占位符（共 ${icons.length} 个）：
- 每个 icon 用 <rect> 占位符表示，样式为虚线空框：
  <rect id="icon_N" x="..." y="..." width="..." height="..." fill="none" stroke="#cccccc" stroke-dasharray="4"/>
- ⚠️ 文字标签和其他元素必须避让 icon 占位符区域，不要与占位符重叠
- 不要嵌入任何光栅/位图图像

以下是每个 icon 的精确位置（来自 manifest）：
${iconList}

请确保输出以 <svg 开头，以 </svg> 结尾，不要包含 markdown 格式。`
}

/**
 * Build the SVG review prompt for visual consistency checking.
 */
function buildReviewSvgPrompt(): string {
  return `请仔细检查这张 SVG 渲染图，对比原始科研图表，列出所有视觉不一致之处：

1. 箭头：样式、粗细、颜色、起止位置、曲线弧度是否一致
2. 文字：内容、位置、大小、颜色是否一致，是否有文字被裁切或溢出
3. 线条/边框：样式、颜色、粗细是否一致
4. 背景色块：颜色、形状、圆角是否一致
5. 整体布局比例是否匹配
6. 占位符（虚线框）位置是否与原图中图标区域对应

对于每个问题，说明：
- 问题描述
- 涉及的 SVG 元素（尽量给出具体的元素标签或属性，方便定位修改）
- 建议的修改方向

如果一切正确，回复"审核通过"。`
}

/**
 * Analyze an image using multimodal vision via OpenRouter.
 * Supports built-in modes for SVG reverse-engineering and review.
 */
export async function executeAnalyzeImage(
  input: AnalyzeImageInput,
  workspace: WorkspaceInstance
): Promise<ToolResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { content: 'OPENROUTER_API_KEY is not set', is_error: true }
  }

  // Determine the instruction text
  let instruction: string
  if (input.mode === 'reverse_svg') {
    if (!input.icons || !input.image_width || !input.image_height) {
      return {
        content: 'reverse_svg mode requires icons, image_width, and image_height parameters',
        is_error: true,
      }
    }
    instruction = buildReverseSvgPrompt(input.icons, input.image_width, input.image_height)
  } else if (input.mode === 'review_svg') {
    instruction = buildReviewSvgPrompt()
  } else if (input.instruction) {
    instruction = input.instruction
  } else {
    return { content: 'Either instruction or mode must be provided', is_error: true }
  }

  // Read the image from workspace (stored as base64)
  const imageBase64 = await workspace.read(input.image_path)
  if (!imageBase64) {
    return { content: `Image not found: ${input.image_path}`, is_error: true }
  }

  console.log(`[analyze-image] Analyzing ${input.image_path} with ${VISION_MODEL} (mode=${input.mode ?? 'custom'})`)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://pegasus.local',
        'X-Title': 'Pegasus',
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${imageBase64}` },
              },
              {
                type: 'text',
                text: instruction,
              },
            ],
          },
        ],
        temperature: 1,
        max_tokens: 20000,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter API error ${res.status}: ${errText}`)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content

    if (!text) {
      return { content: 'No analysis result returned', is_error: true }
    }

    console.log(`[analyze-image] Result: ${text.length} chars`)
    return { content: text }
  } catch (err) {
    const errMsg = (err as Error).message
    console.error('[analyze-image] Error:', errMsg)
    return {
      content: `Image analysis error: ${errMsg}`,
      is_error: true,
    }
  }
}
