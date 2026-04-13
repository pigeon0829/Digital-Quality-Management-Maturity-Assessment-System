import React, { useEffect, useRef } from 'react';
import { MATURITY_LEVELS } from '../constants';

interface NormalCloudChartProps {
  score: number;
}

export const NormalCloudChart: React.FC<NormalCloudChartProps> = ({ score }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const generateCloudPoints = (ex: number, en: number, he: number, count: number) => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      const enPrime = en + z0 * he;
      
      const u3 = Math.random();
      const u4 = Math.random();
      const z1 = Math.sqrt(-2.0 * Math.log(u3)) * Math.cos(2.0 * Math.PI * u4);
      
      const x = ex + z1 * enPrime;
      const y = Math.exp(-Math.pow(x - ex, 2) / (2 * Math.pow(enPrime, 2)));
      
      points.push({ x, y });
    }
    return points;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    ctx.clearRect(0, 0, width, height);

    // Draw Axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw standard clouds
    MATURITY_LEVELS.forEach(level => {
      const { ex, en, he, color } = level.cloudParams;
      const points = generateCloudPoints(ex, en, he, 600);

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.4;
      points.forEach(p => {
        const px = padding + (p.x / 100) * (width - 2 * padding);
        const py = height - padding - p.y * (height - 2 * padding);
        if (px >= padding && px <= width - padding) {
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // Draw result cloud (The user's specific evaluation result as a cloud)
    // We use a slightly higher He (entropy) to represent the uncertainty of a single evaluation
    const resultEx = score;
    const resultEn = 2.0; 
    const resultHe = 0.3;
    const resultPoints = generateCloudPoints(resultEx, resultEn, resultHe, 800);

    ctx.fillStyle = '#ef4444'; // Red for the result
    ctx.globalAlpha = 0.6;
    resultPoints.forEach(p => {
      const px = padding + (p.x / 100) * (width - 2 * padding);
      const py = height - padding - p.y * (height - 2 * padding);
      if (px >= padding && px <= width - padding) {
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw labels
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 100; i += 20) {
      const x = padding + (i / 100) * (width - 2 * padding);
      ctx.fillText(i.toString(), x, height - padding + 15);
    }

    // Draw current score indicator line
    const resultX = padding + (score / 100) * (width - 2 * padding);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(resultX, padding);
    ctx.lineTo(resultX, height - padding);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`评估结果云: ${score.toFixed(1)}`, resultX, padding - 10);

  }, [score]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800">正态云模型分析</h3>
        <div className="flex gap-3">
          {MATURITY_LEVELS.map(l => (
            <div key={l.level} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.cloudParams.color }}></div>
              <span className="text-[10px] text-slate-500">{l.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative w-full aspect-[2/1]">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400} 
          className="w-full h-full"
        />
      </div>
      <p className="mt-4 text-xs text-slate-400 leading-relaxed">
        注：云图展示了企业得分在标准成熟度云模型中的分布位置。云滴的凝聚程度反映了该等级定义的确定性，离散程度反映了模糊性。
      </p>
    </div>
  );
};
