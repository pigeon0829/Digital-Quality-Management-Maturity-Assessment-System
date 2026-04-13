import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface RadarData {
  subject: string;
  A: number;
  fullMark: number;
}

interface Props {
  data: RadarData[];
}

export const MaturityRadarChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="w-full h-[400px] bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <h3 className="text-lg font-semibold mb-4 text-slate-800">成熟度维度分析</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#cbd5e1" gridType="polygon" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Radar
            name="得分"
            dataKey="A"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.5}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
