import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export const Tooltip = ({ text, children }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block group ml-1">
      <div 
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help text-slate-400 hover:text-indigo-500 transition-colors"
      >
        {children || <HelpCircle size={14} />}
      </div>
      
      {show && (
        <div className="absolute z-[110] bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg shadow-xl animate-in fade-in zoom-in duration-200 uppercase tracking-wider text-center border border-indigo-500/30">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
        </div>
      )}
    </div>
  );
};
