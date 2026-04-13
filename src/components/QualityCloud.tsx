import React from 'react';
import { motion } from 'motion/react';

interface Props {
  words: { text: string; value: number }[];
}

export const QualityCloud: React.FC<Props> = ({ words }) => {
  return (
    <div className="w-full min-h-[300px] bg-slate-900 rounded-xl p-8 shadow-inner flex flex-wrap items-center justify-center gap-4 overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 via-transparent to-transparent"></div>
      <h3 className="absolute top-4 left-4 text-slate-400 text-sm font-mono uppercase tracking-widest">关键质量特征云图</h3>
      {words.map((word, idx) => {
        const size = 12 + word.value * 8;
        const opacity = 0.3 + (word.value / 5) * 0.7;
        return (
          <motion.span
            key={idx}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity }}
            transition={{ delay: idx * 0.05, type: "spring" }}
            className="cursor-default hover:text-blue-400 transition-colors"
            style={{
              fontSize: `${size}px`,
              fontWeight: word.value > 3 ? 700 : 400,
              color: word.value > 4 ? '#60a5fa' : word.value > 2 ? '#94a3b8' : '#475569'
            }}
          >
            {word.text}
          </motion.span>
        );
      })}
    </div>
  );
};
