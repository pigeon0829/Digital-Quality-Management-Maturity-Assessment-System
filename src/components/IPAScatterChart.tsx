import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label, ReferenceLine } from 'recharts';

interface IPAData {
  id: string;
  name: string;
  performance: number; // Score (0-100)
  importance: number;  // Weight
}

interface Props {
  data: IPAData[];
  thresholds?: {
    performance: number;
    importance: number;
  };
}

export const IPAScatterChart: React.FC<Props> = ({ data, thresholds }) => {
  // Use provided thresholds or calculate means
  const meanPerformance = thresholds?.performance ?? (data.reduce((acc, curr) => acc + curr.performance, 0) / data.length);
  const meanImportance = thresholds?.importance ?? (data.reduce((acc, curr) => acc + curr.importance, 0) / data.length);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg">
          <p className="font-bold text-slate-800 text-sm mb-1">{item.name}</p>
          <p className="text-xs text-slate-500">绩效 (得分): <span className="font-mono font-bold text-blue-600">{item.performance.toFixed(1)}</span></p>
          <p className="text-xs text-slate-500">重要性 (权重): <span className="font-mono font-bold text-amber-600">{item.importance.toFixed(3)}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[500px] bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">IPA (重要性-绩效) 分析矩阵</h3>
          <p className="text-xs text-slate-400 mt-1">横轴代表绩效(得分)，纵轴代表重要性(权重)</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[10px] font-bold">
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded"></div> 优势区 (高重要性-高绩效)</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded"></div> 改进区 (高重要性-低绩效)</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-400 rounded"></div> 维持区 (低重要性-低绩效)</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded"></div> 调整区 (低重要性-高绩效)</div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="85%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            type="number" 
            dataKey="performance" 
            name="绩效" 
            domain={[0, 100]} 
            stroke="#94a3b8"
            fontSize={12}
            ticks={[0, 20, 40, 60, 80, 100]}
          >
            <Label value="绩效 (得分)" position="bottom" offset={20} fill="#64748b" fontSize={12} fontWeight="bold" />
          </XAxis>
          <YAxis 
            type="number" 
            dataKey="importance" 
            name="重要性" 
            domain={[0, 'auto']} 
            stroke="#94a3b8"
            fontSize={12}
          >
            <Label value="重要性 (权重)" angle={-90} position="left" offset={0} fill="#64748b" fontSize={12} fontWeight="bold" />
          </YAxis>
          <ZAxis type="number" range={[60, 400]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          
          {/* Quadrant Reference Lines */}
          <ReferenceLine x={meanPerformance} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
          <ReferenceLine y={meanImportance} stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" />
          
          <Scatter name="指标" data={data} fill="#3b82f6" fillOpacity={0.6} stroke="#2563eb" />
          
          {/* Quadrant Text Annotations - Positioned relative to thresholds */}
          <text x="85%" y="10%" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="bold" opacity={0.6}>优势区 (保持)</text>
          <text x="15%" y="10%" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold" opacity={0.6}>改进区 (重点)</text>
          <text x="15%" y="90%" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold" opacity={0.6}>维持区 (低优)</text>
          <text x="85%" y="90%" textAnchor="middle" fill="#f59e0b" fontSize="11" fontWeight="bold" opacity={0.6}>调整区 (过度)</text>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
