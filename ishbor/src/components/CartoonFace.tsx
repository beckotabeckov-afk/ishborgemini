import React from 'react';
import { motion } from 'motion/react';
import { FaceEmotion } from '../types';

interface CartoonFaceProps {
  emotion: FaceEmotion;
}

export const CartoonFace: React.FC<CartoonFaceProps> = ({ emotion }) => {
  const getVariants = () => {
    switch (emotion) {
      case 'LISTENING':
        return {
          eyes: { scaleY: [1, 0.2, 1], transition: { repeat: Infinity, duration: 1.5 } },
          mouth: { d: "M 35 70 Q 50 65 65 70", strokeWidth: 4 },
        };
      case 'THINKING':
        return {
          eyes: { x: [0, 8, -8, 0], y: -5, transition: { repeat: Infinity, duration: 2 } },
          mouth: { d: "M 40 70 Q 50 68 60 70", strokeWidth: 3 },
        };
      case 'HAPPY':
        return {
          eyes: { scaleY: [1, 0.5, 1], y: 0 },
          mouth: { d: "M 30 75 Q 50 85 70 75", strokeWidth: 5 },
        };
      case 'CONFUSED':
        return {
          leftEye: { y: -5 },
          rightEye: { y: 5 },
          mouth: { d: "M 35 70 Q 50 65 65 70", strokeWidth: 3 },
        };
      case 'CELEBRATING':
        return {
          eyes: { scale: [1, 1.2, 1], transition: { repeat: Infinity, duration: 0.5 } },
          mouth: { d: "M 30 80 Q 50 90 70 80", strokeWidth: 6 },
        };
      default:
        return {
          eyes: { scaleY: [1, 1, 0.2, 1, 1], transition: { repeat: Infinity, duration: 4 } },
          mouth: { d: "M 40 70 Q 50 70 60 70", strokeWidth: 3 },
        };
    }
  };

  const variants = getVariants();

  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      <motion.svg
        viewBox="0 0 100 100"
        className="w-full h-full"
      >
        {/* Robotic Head Shape - Rounded Rectangle */}
        <rect x="15" y="15" width="70" height="70" rx="15" ry="15" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="3" />
        
        {/* Robotic Eyes - Horizontal Slots */}
        <motion.rect
          initial={{ y: 35 }}
          x="30" y="35" width="12" height="4" rx="2"
          fill="#1e293b"
          animate={variants.leftEye || variants.eyes}
        />
        <motion.rect
          initial={{ y: 35 }}
          x="58" y="35" width="12" height="4" rx="2"
          fill="#1e293b"
          animate={variants.rightEye || variants.eyes}
        />

        {/* Robotic Mouth */}
        <motion.path
          d="M 40 70 Q 50 70 60 70"
          fill="transparent"
          stroke="#1e293b"
          strokeLinecap="round"
          strokeWidth="3"
          animate={variants.mouth}
        />
      </motion.svg>
    </div>
  );
};
