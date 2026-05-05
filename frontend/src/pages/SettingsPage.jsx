import { useState, useEffect } from 'react';
import { Settings, Shield, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    // Kiểm tra localStorage trước
    const connectedStatus = localStorage.getItem('isGoogleConnected');
    if (connectedStatus === 'true') {
      setIsGoogleConnected(true);
    }

    // Check nếu URL params có chứa auth=success (callback từ Backend)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setIsGoogleConnected(true);
      localStorage.setItem('isGoogleConnected', 'true');
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectGoogle = () => {
    // Redirect thẳng ra cổng 5000 Backend để chạy luồng OAuth
    window.location.href = 'http://localhost:5000/api/auth/google';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cài đặt hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Kết nối các dịch vụ bên ngoài và cấu hình tài khoản.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Connection Card */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Globe size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Google Business Profile</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">Kết nối với tài khoản Google để tự động đồng bộ đánh giá và trả lời trực tiếp từ hệ thống.</p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            {isGoogleConnected ? (
              <div className="flex items-center gap-3 text-emerald-600 font-medium">
                <CheckCircle2 size={20} />
                <span>Hoạt động bình thường</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-600 font-medium">
                <Shield size={20} className="text-slate-400" />
                <span>Chưa có kết nối nào</span>
              </div>
            )}

            {isGoogleConnected ? (
              <button 
                onClick={() => {
                  setIsGoogleConnected(false);
                  localStorage.removeItem('isGoogleConnected');
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                Ngắt kết nối
              </button>
            ) : (
              <button 
                onClick={handleConnectGoogle}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2"
              >
                Cấp quyền truy cập 
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
