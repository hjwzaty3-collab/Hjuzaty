import React from 'react';

interface DoctorAvatarProps {
  name: string;
  className?: string;
}

export function DoctorAvatar({ name, className = "w-full h-full" }: DoctorAvatarProps) {
  // Extract initial (handling "د. أحمد" -> "أ")
  const cleanName = name ? name.replace(/^(د\.|الدكتور|الدكتورة)\s+/, '') : '';
  const initial = cleanName ? cleanName.charAt(0) : 'ط';

  // Generate consistent color based on name string
  const colors = [
    { bg: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', text: '#ffffff', stroke: '#c7d2fe' },
    { bg: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)', text: '#ffffff', stroke: '#99f6e4' },
    { bg: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', text: '#ffffff', stroke: '#ddd6fe' },
    { bg: 'linear-gradient(135deg, #0284c7 0%, #0c4a6e 100%)', text: '#ffffff', stroke: '#bae6fd' },
    { bg: 'linear-gradient(135deg, #db2777 0%, #831843 100%)', text: '#ffffff', stroke: '#fbcfe8' }
  ];

  const charCodeSum = name ? name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
  const pair = colors[charCodeSum % colors.length];

  return (
    <div className={`relative flex items-center justify-center select-none overflow-hidden ${className}`} style={{ background: pair.bg }}>
      {/* Dynamic vector pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none scale-125" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="2" strokeDasharray="5 5" />
        <path d="M10 50h20l10-25 10 50 10-25h30" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
        {/* Stylized Medical Shield Logo */}
        <svg className="w-12 h-12 mb-2" viewBox="0 0 24 24" fill="none" stroke={pair.stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v8" />
          <path d="M9 12h6" />
        </svg>
        {/* Doctor Initial Letter */}
        <span className="text-3xl font-black text-white leading-none tracking-wide" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
          {initial}
        </span>
      </div>
    </div>
  );
}
