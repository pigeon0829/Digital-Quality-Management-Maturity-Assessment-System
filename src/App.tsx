/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  BarChart3, 
  Lightbulb, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  ShieldCheck,
  Zap,
  Target,
  Users,
  Database,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { EVALUATION_MODEL, MATURITY_LEVELS, LEVEL_MEDIANS, Dimension } from './constants';
import { MaturityRadarChart } from './components/MaturityRadarChart';
import { NormalCloudChart } from './components/NormalCloudChart';
import { IPAScatterChart } from './components/IPAScatterChart';
import { QualityCloud } from './components/QualityCloud';
import { generateImprovementSuggestions } from './services/gemini';
import { cn } from './lib/utils';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-4">应用运行出错</h1>
            <p className="text-slate-600 mb-6">
              很抱歉，应用程序遇到了一个意外错误。这通常是由于环境配置（如 API Key 缺失）或数据异常引起的。
            </p>
            <div className="bg-slate-50 p-4 rounded-xl text-left mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-500">{this.state.error?.message}</code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              刷新页面重试
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

type Step = 'intro' | 'evaluating' | 'results';

interface Evaluator {
  id: string;
  name: string;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [step, setStep] = useState<Step>('intro');
  const [currentDimensionIdx, setCurrentDimensionIdx] = useState(0);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([{ id: '1', name: '评价人 1' }]);
  const [currentEvaluatorIdx, setCurrentEvaluatorIdx] = useState(0);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({}); // evaluatorId -> indicatorId -> score
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string>('');

  const currentDimension = EVALUATION_MODEL[currentDimensionIdx];
  const currentEvaluator = evaluators[currentEvaluatorIdx];

  // Scroll to top when dimension or evaluator changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentDimensionIdx, currentEvaluatorIdx, step]);

  const handleScoreChange = (indicatorId: string, score: number) => {
    setScores(prev => ({
      ...prev,
      [currentEvaluator.id]: {
        ...(prev[currentEvaluator.id] || {}),
        [indicatorId]: score
      }
    }));
  };

  const addEvaluator = () => {
    const newId = (evaluators.length + 1).toString();
    setEvaluators([...evaluators, { id: newId, name: `评价人 ${newId}` }]);
  };

  const removeEvaluator = (id: string) => {
    if (evaluators.length <= 1) return;
    const newEvaluators = evaluators.filter(e => e.id !== id);
    setEvaluators(newEvaluators);
    const newScores = { ...scores };
    delete newScores[id];
    setScores(newScores);
    setCurrentEvaluatorIdx(0);
  };

  const updateEvaluatorName = (id: string, name: string) => {
    setEvaluators(evaluators.map(e => e.id === id ? { ...e, name } : e));
  };

  const isDimensionCompleteForCurrent = useMemo(() => {
    const currentScores = scores[currentEvaluator.id] || {};
    return currentDimension.subDimensions.every(sd => 
      sd.indicators.every(i => currentScores[i.id] !== undefined)
    );
  }, [currentDimension, scores, currentEvaluator]);

  const allEvaluatorsComplete = useMemo(() => {
    return evaluators.every(evaluator => {
      const evalScores = scores[evaluator.id] || {};
      return EVALUATION_MODEL.every(dim => 
        dim.subDimensions.every(sd => 
          sd.indicators.every(i => evalScores[i.id] !== undefined)
        )
      );
    });
  }, [evaluators, scores]);

  const calculateResults = () => {
    let totalScore = 0;
    const dimensionScores: { subject: string; A: number; fullMark: number }[] = [];
    const cloudWords: { text: string; value: number }[] = [];

    // Calculate average score for each indicator across all evaluators
    const averageScores: Record<string, number> = {};
    EVALUATION_MODEL.forEach(dim => {
      dim.subDimensions.forEach(sd => {
        sd.indicators.forEach(ind => {
          let sum = 0;
          evaluators.forEach(e => {
            const level = (scores[e.id] || {})[ind.id] || 0;
            sum += LEVEL_MEDIANS[level] || 0;
          });
          averageScores[ind.id] = sum / evaluators.length;
        });
      });
    });

    EVALUATION_MODEL.forEach(dim => {
      let dimScore = 0;
      dim.subDimensions.forEach(sd => {
        let sdScore = 0;
        sd.indicators.forEach(ind => {
          const score = averageScores[ind.id];
          sdScore += score * ind.weight;
          cloudWords.push({ text: ind.name, value: score });
        });
        dimScore += sdScore * sd.weight;
      });
      totalScore += dimScore * dim.weight;
      dimensionScores.push({ subject: dim.name, A: Number(dimScore.toFixed(1)), fullMark: 100 });
    });

    const level = MATURITY_LEVELS.find(l => 
      totalScore >= l.minScore && totalScore <= l.maxScore
    ) || MATURITY_LEVELS[0];

    return { totalScore, dimensionScores, level, cloudWords };
  };

  const results = useMemo(() => calculateResults(), [scores]);

  const indicatorData = useMemo(() => {
    const data: { id: string; name: string; score: number; weight: number }[] = [];
    EVALUATION_MODEL.forEach(dim => {
      dim.subDimensions.forEach(sd => {
        sd.indicators.forEach(ind => {
          let sum = 0;
          evaluators.forEach(e => {
            const level = (scores[e.id] || {})[ind.id] || 0;
            sum += LEVEL_MEDIANS[level] || 0;
          });
          const avgScore = sum / evaluators.length;
          const globalWeight = dim.weight * sd.weight * ind.weight;
          data.push({
            id: ind.id,
            name: ind.name,
            score: avgScore,
            weight: globalWeight
          });
        });
      });
    });
    return data;
  }, [scores, evaluators]);

  const handleFinish = async () => {
    setStep('results');
    setIsGenerating(true);
    
    const aiSuggestions = await generateImprovementSuggestions(
      indicatorData, 
      results.level.name, 
      results.totalScore,
      results.dimensionScores // Passing radar data context
    );
    setSuggestions(aiSuggestions || '');
    setIsGenerating(false);
  };

  const reset = () => {
    setScores({});
    setCurrentDimensionIdx(0);
    setStep('intro');
    setSuggestions('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-bottom border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">数字化质量管理成熟度评价</h1>
          </div>
          {step === 'evaluating' && (
            <div className="hidden md:flex items-center gap-6">
              <div className="flex flex-col items-end">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">当前评价人</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{currentEvaluator.name}</span>
                  <span className="text-[10px] font-medium text-slate-400">({currentEvaluatorIdx + 1} / {evaluators.length})</span>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="flex flex-col">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">个人进度</div>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${((currentDimensionIdx + 1) / EVALUATION_MODEL.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
                  洞察您的质量管理 <span className="text-blue-600">数字化水平</span>
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  基于行业领先的评价模型，通过多维度指标分析，为您提供精准的成熟度定位及针对性的改进路径。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { icon: Target, title: "三级指标体系", desc: "涵盖战略、过程、技术、人力的全方位评价" },
                  { icon: BarChart3, title: "多维可视化", desc: "雷达图与特征云图直观展现优劣势" },
                  { icon: Lightbulb, title: "AI 改进建议", desc: "基于 Gemini AI 的专业化转型指导" }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <item.icon className="w-10 h-10 text-blue-500 mb-4" />
                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-500" />
                    设置评价团队
                  </h3>
                  <button 
                    onClick={addEvaluator}
                    className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    + 添加评价人
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {evaluators.map((evaluator, index) => (
                    <div key={evaluator.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-slate-400 border border-slate-200">
                        {index + 1}
                      </div>
                      <input 
                        type="text" 
                        value={evaluator.name}
                        onChange={(e) => updateEvaluatorName(evaluator.id, e.target.value)}
                        className="bg-transparent font-bold text-slate-700 focus:outline-none flex-1"
                      />
                      {evaluators.length > 1 && (
                        <button 
                          onClick={() => removeEvaluator(evaluator.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => setStep('evaluating')}
                  className="group bg-slate-900 text-white px-8 py-4 rounded-full font-bold text-lg flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  开始评价
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'evaluating' && (
            <motion.div 
              key="evaluating"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-slate-900 p-8 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">维度 {currentDimensionIdx + 1}</span>
                      <h2 className="text-2xl font-bold">{currentDimension.name}</h2>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-bold">{currentEvaluator.name} 正在评价</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${((currentDimensionIdx + 1) / EVALUATION_MODEL.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      维度进度: {currentDimensionIdx + 1} / {EVALUATION_MODEL.length}
                    </span>
                  </div>
                </div>

                <div className="p-8 space-y-10">
                  {currentDimension.subDimensions.map(sd => (
                    <div key={sd.id} className="space-y-6">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                        {sd.name}
                      </h3>
                      <div className="space-y-8">
                        {sd.indicators.map(ind => (
                          <div key={ind.id} className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 group hover:border-blue-100 transition-colors">
                            <div className="space-y-6">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">{ind.id}</span>
                                  <h4 className="font-bold text-slate-800">{ind.name}</h4>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">{ind.description}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-3 w-full">
                                {[1, 2, 3, 4, 5].map(val => (
                                  <button
                                    key={val}
                                    onClick={() => handleScoreChange(ind.id, val)}
                                    className={cn(
                                      "flex items-start gap-4 p-4 rounded-2xl border-2 transition-all text-left group/btn",
                                      (scores[currentEvaluator.id] || {})[ind.id] === val 
                                        ? "bg-blue-50 border-blue-600 shadow-sm" 
                                        : "bg-white border-slate-100 hover:border-blue-200"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 transition-colors",
                                      (scores[currentEvaluator.id] || {})[ind.id] === val 
                                        ? "bg-blue-600 text-white" 
                                        : "bg-slate-100 text-slate-500 group-hover/btn:bg-blue-100 group-hover/btn:text-blue-600"
                                    )}>
                                      {val}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                        L{val} 等级
                                        {(scores[currentEvaluator.id] || {})[ind.id] === val && (
                                          <motion.div layoutId={`check-${ind.id}-${currentEvaluator.id}`} className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                            <ShieldCheck className="text-white w-3 h-3" />
                                          </motion.div>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500 leading-relaxed">
                                        {ind.criteria[val as keyof typeof ind.criteria]}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 p-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        if (currentDimensionIdx > 0) {
                          setCurrentDimensionIdx(prev => prev - 1);
                        } else if (currentEvaluatorIdx > 0) {
                          setCurrentEvaluatorIdx(prev => prev - 1);
                          setCurrentDimensionIdx(EVALUATION_MODEL.length - 1);
                        }
                      }}
                      disabled={currentDimensionIdx === 0 && currentEvaluatorIdx === 0}
                      className="flex items-center gap-2 text-slate-600 font-bold px-4 py-2 rounded-lg hover:bg-white transition-colors disabled:opacity-30"
                    >
                      <ChevronLeft className="w-5 h-5" /> 上一步
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {currentDimensionIdx === EVALUATION_MODEL.length - 1 && currentEvaluatorIdx === evaluators.length - 1 ? (
                      <button 
                        onClick={handleFinish}
                        disabled={!allEvaluatorsComplete}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        提交最终评估 <ClipboardCheck className="w-5 h-5" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          if (currentDimensionIdx < EVALUATION_MODEL.length - 1) {
                            setCurrentDimensionIdx(prev => prev + 1);
                          } else if (currentEvaluatorIdx < evaluators.length - 1) {
                            setCurrentEvaluatorIdx(prev => prev + 1);
                            setCurrentDimensionIdx(0);
                          }
                        }}
                        disabled={!isDimensionCompleteForCurrent}
                        className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {currentDimensionIdx === EVALUATION_MODEL.length - 1 ? "下一位评价人" : "下一步"} 
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-white text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[100px]"></div>
                  </div>
                  
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="inline-block mb-6"
                  >
                    <div className="w-24 h-24 bg-blue-500 rounded-3xl flex items-center justify-center shadow-2xl mx-auto rotate-12">
                      <Zap className="text-white w-12 h-12 -rotate-12" />
                    </div>
                  </motion.div>
                  
                  <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-blue-400 mb-2">评价结果报告</h2>
                  <div className="text-6xl font-black mb-4 tracking-tighter">
                    {results.totalScore.toFixed(1)} <span className="text-2xl text-slate-500">/ 100</span>
                  </div>
                  <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                    <span className="text-blue-300 font-bold">当前等级：</span>
                    <span className="font-bold text-lg">{results.level.name}</span>
                  </div>
                  <p className="mt-6 text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
                    {results.level.description}
                  </p>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <MaturityRadarChart data={results.dimensionScores} />
                  <NormalCloudChart score={results.totalScore} />
                </div>

                <div className="px-8 pb-8">
                  <IPAScatterChart data={indicatorData.map(d => ({
                    id: d.id,
                    name: d.name,
                    performance: d.score,
                    importance: d.weight
                  }))} />
                </div>

                <div className="p-8 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Lightbulb className="text-blue-600 w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">数字化转型改进建议 (IPA 分析法)</h3>
                      <p className="text-xs text-slate-500">基于重要性-绩效分析 (IPA) 与 Gemini AI 生成的专业化指导方案</p>
                    </div>
                  </div>

                  {isGenerating ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-slate-500 font-medium animate-pulse">正在深度分析您的质量管理数据...</p>
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                        {suggestions}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-white border-t border-slate-100 flex justify-center">
                  <button 
                    onClick={reset}
                    className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                  >
                    <RotateCcw className="w-5 h-5" /> 重新开始评估
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-slate-200 text-center">
        <p className="text-slate-400 text-sm">© 2026 数字化质量管理成熟度评价系统 · 专业版</p>
      </footer>
      <Analytics />
    </div>
  );
}
