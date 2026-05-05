import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { MapPin, KeyRound, Loader2, Navigation, Map } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Auth request
    const result = await login(formData.username, formData.password);
    
    if (result.success) {
      navigate('/'); // Chuyển hướng Dashboard
    } else {
      setError(result.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Cột trái: Form Đăng Nhập */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 md:px-16 lg:px-24 z-10 relative bg-white shadow-2xl shadow-slate-200/50">
        <div className="max-w-md w-full mx-auto">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xl shadow-indigo-600/20">
              <MapPin className="text-white" size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">MapManager</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Workspace</p>
            </div>
          </div>

          <div className="mb-10 animate-in fade-in slide-in-from-left-4 duration-700 delay-150">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Chào mừng quay lại!</h2>
            <p className="text-slate-500 text-sm">Vui lòng nhập thông tin để truy cập hệ thống quản trị không gian bản đồ mạnh mẽ nhất.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-700 delay-300">
             
            {error && (
              <div className="bg-rose-50 text-rose-600 text-sm font-semibold p-4 rounded-2xl border border-rose-100/50 flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></div>
                 {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Tài khoản</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="VD: admin hoặc manager1"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                 <label className="text-sm font-bold text-slate-700">Mật khẩu</label>
              </div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white h-14 rounded-2xl font-bold transition-all shadow-xl hover:shadow-2xl active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <KeyRound size={20} />}
              Đăng nhập hệ thống
            </button>
          </form>

          <p className="mt-10 text-center text-xs font-semibold text-slate-400">
            Powered by GenSeo AI Platform 2026
          </p>
        </div>
      </div>

      {/* Cột phải: Visual/Branding (Dành cho bản Desktop) */}
      <div className="hidden lg:flex lg:w-[55%] relative p-8">
        <div className="absolute inset-8 bg-indigo-600 rounded-[48px] overflow-hidden flex flex-col justify-end p-16 shadow-[0_0_100px_rgba(79,70,229,0.2)]">
           {/* Abstract Decorative Graphics */}
           <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 150%, #fff 10%, transparent 60%), radial-gradient(circle at 80% 0%, #fff 5%, transparent 40%)'}}></div>
           <Map className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] text-white opacity-5" strokeWidth={0.2} />
           
           <div className="relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full text-xs font-bold mb-6 tracking-wide">
                 <Navigation size={14} className="animate-pulse" /> MAPMANAGER v4.0
              </div>
              <h2 className="text-white text-5xl font-black leading-tight mb-6">
                 Quản lý hàng trăm cơ sở,<br />Chỉ từ một điểm chạm.
              </h2>
              <p className="text-indigo-100 text-lg font-medium opacity-90 max-w-xl">
                 Tích hợp AI phân tích dữ liệu đa chiều, theo dõi và phản hồi đánh giá tự động. Tiết kiệm 90% thời gian xử lý khiếu nại.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
