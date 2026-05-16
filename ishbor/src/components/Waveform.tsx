import React from 'react';
import { motion } from 'motion/react';

interface WaveformProps {
  isListening: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-12" id="waveform">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-yellow-500 rounded-full"
          initial={{ height: 4 }}
          animate={{
            height: isListening ? [4, Math.random() * 32 + 8, 4] : 4,
          }}
          transition={{
            repeat: Infinity,
            duration: 0.5 + Math.random() * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
