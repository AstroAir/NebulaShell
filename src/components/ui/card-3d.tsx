'use client';

import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

export function Card3D({ children, className, intensity = 10 }: Card3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateXValue = ((y - centerY) / centerY) * -intensity;
    const rotateYValue = ((x - centerX) / centerX) * intensity;

    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative transition-transform duration-200 ease-out transform-gpu',
        'hover:scale-[1.02]',
        className
      )}
      style={{
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative z-10" style={{ transform: 'translateZ(50px)' }}>
        {children}
      </div>
      
      {/* Shadow effect */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 blur-xl -z-10"
        style={{
          transform: `translateZ(-50px) translateY(20px) scaleX(0.9)`,
        }}
      />
    </div>
  );
}

// Parallax Card Component
interface ParallaxCardProps {
  children: React.ReactNode;
  className?: string;
  layers?: React.ReactNode[];
}

export function ParallaxCard({ children, className, layers = [] }: ParallaxCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setMousePosition({ x, y });
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card transition-all duration-300',
        'hover:shadow-2xl hover:scale-[1.02]',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setMousePosition({ x: 0.5, y: 0.5 });
      }}
    >
      {/* Background layers with parallax effect */}
      {layers.map((layer, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-transform duration-200 ease-out"
          style={{
            transform: isHovered
              ? `translate(${(mousePosition.x - 0.5) * 20 * (index + 1)}px, ${
                  (mousePosition.y - 0.5) * 20 * (index + 1)
                }px)`
              : 'translate(0, 0)',
          }}
        >
          {layer}
        </div>
      ))}
      
      {/* Main content */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Shine effect */}
      <div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x * 100}% ${
            mousePosition.y * 100
          }%, rgba(255,255,255,0.1), transparent 40%)`,
        }}
      />
    </div>
  );
}

// Flip Card Component
interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  className?: string;
  trigger?: 'hover' | 'click';
}

export function FlipCard({ front, back, className, trigger = 'hover' }: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    if (trigger === 'click') {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <div
      className={cn(
        'relative w-full h-full preserve-3d transition-transform duration-700',
        isFlipped && 'rotate-y-180',
        className
      )}
      style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
      onClick={handleFlip}
      onMouseEnter={() => trigger === 'hover' && setIsFlipped(true)}
      onMouseLeave={() => trigger === 'hover' && setIsFlipped(false)}
    >
      {/* Front face */}
      <div
        className="absolute inset-0 w-full h-full backface-hidden rounded-xl"
        style={{ backfaceVisibility: 'hidden' }}
      >
        {front}
      </div>
      
      {/* Back face */}
      <div
        className="absolute inset-0 w-full h-full backface-hidden rounded-xl rotate-y-180"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        {back}
      </div>
    </div>
  );
}

// Magnetic Card Component
interface MagneticCardProps {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}

export function MagneticCard({ children, className, strength = 0.3 }: MagneticCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    const x = distanceX * strength;
    const y = distanceY * strength;

    setTransform({ x, y });
  };

  const handleMouseLeave = () => {
    setTransform({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative transition-transform duration-200 ease-out',
        className
      )}
      style={{
        transform: `translate(${transform.x}px, ${transform.y}px)`,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

// Glow Card Component
interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function GlowCard({ 
  children, 
  className,
  glowColor = 'rgba(59, 130, 246, 0.5)'
}: GlowCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300',
        'hover:shadow-xl hover:border-primary/50',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
        style={{
          opacity: isHovered ? 0.6 : 0,
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, ${glowColor}, transparent 40%)`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
