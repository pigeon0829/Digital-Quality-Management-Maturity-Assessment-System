import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    // Try both standard and Vite-prefixed environment variables
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    
    console.log("API Key Check:", {
      hasKey: !!apiKey,
      isUndefinedString: apiKey === 'undefined',
      isEmpty: apiKey === '',
      prefix: apiKey ? apiKey.substring(0, 3) + "..." : "none"
    });

    if (!apiKey || apiKey === 'undefined' || apiKey === '') {
      return null; // Return null to trigger Demo Mode
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function generateImprovementSuggestions(
  evaluations: { id: string; name: string; score: number; weight: number }[], 
  maturityLevel: string, 
  totalScore: number,
  radarData: { subject: string; A: number; fullMark: number }[]
) {
  const prompt = `
    你是一个数字化质量管理专家。请根据以下多维评价数据，结合 **雷达图、正态云图、IPA (重要性-绩效分析) 矩阵** 给出深度分析与改进建议。
    
    【数据背景】
    1. 综合成熟度：${maturityLevel} (得分: ${totalScore.toFixed(1)}/100)
    2. 维度表现 (雷达图数据):
       ${radarData.map(d => `- ${d.subject}: ${d.A}分`).join("\n")}
    3. 细分指标数据 (IPA 矩阵基础):
       ${evaluations.map(e => `- [${e.id}] ${e.name}: 绩效 ${e.score.toFixed(1)}, 重要性权重 ${e.weight.toFixed(3)}`).join("\n")}
    
    【任务要求】
    请按以下结构输出分析报告：
    
    ### 一、 综合现状诊断 (结合雷达图与云图)
    - 分析企业在数字化质量管理各维度的均衡性（雷达图形状分析）。
    - 结合正态云图，评价结果的凝聚度（确定性）与离散度（模糊性），说明企业目前所处等级的稳固程度。
    
    ### 二、 关键驱动因素分析 (IPA 矩阵分析)
    - **优势区 (Keep up the good work)**: 识别高重要性且表现优秀的指标，说明如何固化这些优势。
    - **改进区 (Concentrate here)**: 识别高重要性但表现欠佳的“短板”指标。这是改进的重重之重，请给出针对性的突破建议。
    - **维持/调整区**: 简要说明低优先级或资源可能过度投入的领域。
    
    ### 三、 针对性改进建议
    - 针对 IPA 改进区中的核心指标，给出具体的数字化技术手段或管理流程优化建议。
    
    ### 四、 数字化转型路线图
    - 短期（3-6个月）：补齐关键短板。
    - 中长期（1-2年）：实现跨等级跨越。
    
    请使用专业、客观、具有洞察力的语气，并以 Markdown 格式输出。
  `;

  try {
    const ai = getGenAI();
    
    if (!ai) {
      console.warn("Gemini API Key not found. Falling back to Demo Mode.");
      return `> **[演示模式]** 由于未检测到有效的 API Key，系统已为您生成模拟分析报告。
      
### 一、 综合现状诊断
根据雷达图显示，贵司在 **${radarData.sort((a,b) => b.A - a.A)[0].subject}** 领域表现突出，但在 **${radarData.sort((a,b) => a.A - b.A)[0].subject}** 方面存在明显短板。整体均衡性有待提高。正态云图显示当前处于 **${maturityLevel}** 阶段，结果具有较高的可信度。

### 二、 关键驱动因素分析 (IPA)
- **优势区**: ${evaluations.filter(e => e.score > 80 && e.weight > 0.05).slice(0, 2).map(e => e.name).join('、') || '现有核心业务流程'}。
- **改进区**: ${evaluations.filter(e => e.score < 60 && e.weight > 0.05).slice(0, 2).map(e => e.name).join('、') || '数字化质量追溯、实时监控系统'}。

### 三、 针对性改进建议
建议优先投入资源补齐 **${radarData.sort((a,b) => a.A - b.A)[0].subject}** 相关的数字化工具。引入自动化数据采集终端，减少人工干预，提升数据实时性。

### 四、 数字化转型路线图
- **短期**: 完成关键工序的数字化改造。
- **长期**: 构建全价值链的质量大数据平台。`;
    }

    console.log("Generating suggestions with Gemini...");
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });
    
    if (!response.text) {
      console.error("Gemini returned empty response");
      return "无法生成建议：AI 返回了空内容。";
    }
    
    return response.text;
  } catch (error) {
    console.error("Gemini API Error Details:", error);
    if (error instanceof Error) {
      return `生成建议时出错: ${error.message}。请检查网络连接或 API Key 有效性。`;
    }
    return "无法生成建议，请稍后重试。";
  }
}
