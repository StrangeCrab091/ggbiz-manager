import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell 
} from 'recharts';
import { 
  TrendingUp, BarChart3, Calendar, Loader2, AlertCircle, Download, 
  MapPin, RotateCcw, ChevronRight, Star, X, CheckCircle2,
  Lightbulb, Zap, TrendingDown, Minus, Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const selectedLocationId = context?.selectedLocationId;
  const setSelectedLocationId = context?.setSelectedLocationId;
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [topComplaints, setTopComplaints] = useState([]);
  const [locationNames, setLocationNames] = useState([]);
  const [branchRanking, setBranchRanking] = useState([]);
  const [overallStats, setOverallStats] = useState({
    topBranch: { name: 'Đang tải...', percentage: 0 },
    topIssue: 'Đang tải...',
    growthPercent: 0
  });

  const [aiSolution, setAiSolution] = useState(null);
  const [showSolutionModal, setShowSolutionModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        locationId: selectedLocationId || 'all'
      });
      
      const fetchApi = async (path) => {
        return await apiService.get(`/analytics/${path}?${queryParams.toString()}`);
      };

      const [trendData, complaintsData, statsData, rankingData] = await Promise.all([
        fetchApi('monthly-trends'),
        fetchApi('top-complaints'),
        fetchApi('overall-stats'),
        fetchApi('branch-ranking')
      ]);

      if (trendData?.success) {
        setMonthlyTrends(trendData.data || []);
        setLocationNames(trendData.locationNames || []);
      }
      if (complaintsData?.success) setTopComplaints(complaintsData.data || []);
      if (statsData?.success) setOverallStats(prev => ({ ...prev, ...(statsData.data || {}) }));
      if (rankingData?.success) setBranchRanking(rankingData.data || []);

    } catch (error) {
      console.error('Lỗi khi fetch analytics:', error);
      const msg = error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ';
      setApiError(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGetSolution = async () => {
    setShowSolutionModal(true);
    setAiSolution(null);
    setSolutionLoading(true);
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        locationId: selectedLocationId || 'all'
      });
      const data = await apiService.get(`/analytics/ai-solution?${queryParams.toString()}`);
      if (data.success) {
        setAiSolution(data.data);
      }
    } catch (error) {
      console.error('Lỗi khi fetch AI solution:', error);
    } finally {
      setSolutionLoading(false);
    }
  };

  const navigateToLocation = (id) => {
    if (id && setSelectedLocationId) {
       setSelectedLocationId(id);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, selectedLocationId]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header & Export */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Báo cáo Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {selectedLocationId === 'all' ? 'Phân tích TOÀN HỆ THỐNG chi nhánh' : 'Phân tích chi nhánh riêng lẻ'}
          </p>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xl shadow-indigo-100 active:scale-95"
        >
          <Download size={16} /> Xuất Báo Cáo PDF
        </button>
      </div>

      {/* API Error Banner */}
      {apiError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
          <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-700">Lỗi tải Analytics</p>
            <p className="text-xs text-rose-600 mt-0.5">{apiError}</p>
          </div>
          <button
            onClick={fetchData}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-1">
            <Calendar size={12} /> Từ ngày
          </label>
          <input 
            type="date" 
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
          />
        </div>
        <div className="space-y-2 flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-1">
            <Calendar size={12} /> Đến ngày
          </label>
          <input 
            type="date" 
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
          />
        </div>
        <button 
          onClick={fetchData}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white h-[44px] px-6 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
          Cập nhật
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Line Chart: Monthly Trends */}
        <div className="bg-white border border-slate-200/60 rounded-[32px] shadow-sm p-8 flex flex-col min-h-[450px] group transition-all hover:shadow-xl hover:shadow-indigo-500/5">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-600" />
                Xu hướng biến động
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {selectedLocationId === 'all' ? 'So sánh số lượng Đánh giá theo từng chi nhánh' : 'Số lượng Đánh giá nhận được theo từng tháng'}
              </p>
            </div>
          </div>
          
          <div className="flex-1 w-full h-[320px]">
             {loading ? (
                <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
             ) : monthlyTrends.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                   <AlertCircle size={40} className="opacity-20" />
                   <p className="text-sm font-bold">Chưa có dữ liệu cho thời gian này</p>
                </div>
             ) : (
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={monthlyTrends} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} dy={12} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} itemStyle={{ fontWeight: 800, fontSize: '13px' }} labelStyle={{ color: '#64748b', marginBottom: '6px', fontWeight: 700, fontSize: '11px' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '30px', fontWeight: 600 }} />
                      {locationNames.map((name, idx) => (
                         <Line key={name} type="monotone" dataKey={name} name={name} stroke={COLORS[idx % COLORS.length]} strokeWidth={4} dot={{ stroke: COLORS[idx % COLORS.length], strokeWidth: 3, r: 4, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0, fill: COLORS[idx % COLORS.length] }} animationDuration={1000} />
                      ))}
                   </LineChart>
                </ResponsiveContainer>
             )}
          </div>
        </div>

        {/* Branch Leaderboard OR Top Complaints based on View */}
        {selectedLocationId === 'all' ? (
          <div className="bg-white border border-slate-200/60 rounded-[32px] shadow-sm p-8 flex flex-col min-h-[450px] relative overflow-hidden group hover:shadow-xl transition-all">
             <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 blur-3xl -z-10 rounded-full mix-blend-multiply"></div>
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Award size={20} className="text-yellow-500" />
                    Bảng Xếp Hạng Chi Nhánh
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Đánh giá Hiệu suất dựa trên SAO, Độ phản hồi & AI Sentiment</p>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-yellow-500" /></div>
                ) : branchRanking.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                     <AlertCircle size={40} className="opacity-20" />
                     <p className="text-sm font-bold">Chưa có đánh giá nào</p>
                  </div>
                ) : (
                  branchRanking.map((branch) => (
                    <div 
                      key={branch.locationId}
                      onClick={() => navigateToLocation(branch.locationId)}
                      className={`relative flex items-center justify-between p-4 rounded-2xl border cursor-pointer hover:border-indigo-300 transition-all ${branch.bg || 'bg-white border-slate-100'} hover:shadow-md`}
                    >
                       <div className="flex items-center gap-4">
                          <div className={`text-2xl font-black w-8 text-center ${branch.color}`}>
                             {branch.icon || `#${branch.rank}`}
                          </div>
                          <div>
                             <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{branch.locationName}</h4>
                             <div className="flex items-center gap-3 mt-1 text-[11px] font-semibold text-slate-500">
                                <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400 fill-yellow-400" /> {(branch.avgRating ?? 0).toFixed(1)}</span>
                                <span className="flex items-center gap-1">Phản hồi: <span className="text-slate-700">{Math.round(branch.responseRate ?? 0)}%</span></span>
                             </div>
                          </div>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="text-lg font-black text-slate-900">{branch.score}</span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center">
                             {branch.trend === 1 ? <><TrendingUp size={10} className="text-emerald-500 mr-1"/> Tăng</> : 
                              branch.trend === -1 ? <><TrendingDown size={10} className="text-rose-500 mr-1"/> Giảm</> : 
                              <><Minus size={10} className="mr-1"/> Giữ</>}
                          </span>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200/60 rounded-[32px] shadow-sm p-8 flex flex-col min-h-[450px] group transition-all hover:shadow-xl hover:shadow-orange-500/5">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                     <BarChart3 size={20} className="text-orange-600" />
                     Phân tích phản hồi tiêu cực
                   </h3>
                   <p className="text-xs text-slate-500 font-medium mt-1">Các vấn đề khách hàng hay phàn nàn tại chi nhánh này</p>
                </div>
             </div>
             
             <div className="flex-1 w-full h-[320px]">
                {loading ? (
                   <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-orange-600" /></div>
                ) : topComplaints.length === 0 ? (
                   <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Star size={40} className="opacity-20" />
                      <p className="text-sm font-bold">Quá tuyệt vời! Chi nhánh không có phàn nàn nào</p>
                   </div>
                ) : (
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topComplaints} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                         <XAxis type="number" hide />
                         <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{ fill: '#1e293b', fontSize: 12, fontWeight: 700 }} width={120} />
                         <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ fontWeight: 800, fontSize: '13px' }} labelStyle={{ color: '#64748b', marginBottom: '6px', fontWeight: 700, fontSize: '11px' }} />
                         <Bar dataKey="count" name="Số lượng" radius={[0, 8, 8, 0]} barSize={24}>
                            {topComplaints.map((entry, index) => <Cell key={`cell-${index}`} fill={['#f87171', '#fb923c', '#fbbf24', '#fcd34d', '#fde68a'][index % 5]} /> )}
                         </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                )}
             </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-200 flex flex-col justify-between overflow-hidden relative group">
           <div className="relative z-10">
              <h4 className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-2">
                 Tăng trưởng Đánh giá
              </h4>
              <p className="text-4xl font-black">{overallStats?.growthPercent > 0 ? '+' : ''}{overallStats?.growthPercent ?? 0}%</p>
              <p className="text-indigo-100/80 text-xs mt-3 font-medium">So với chu kỳ cùng kỳ trước đó</p>
           </div>
           <TrendingUp size={120} className="absolute -right-8 -bottom-8 text-white/10 group-hover:scale-110 transition-transform duration-700" />
        </div>
        
        <div className="bg-white border border-slate-200/60 p-8 rounded-[32px] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
           <div>
              <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                 {selectedLocationId === 'all' ? 'Chi nhánh sôi động nhất' : 'Số lượng Đánh giá Tích lũy'}
              </h4>
              <div className="flex items-center gap-2 mb-1">
                 <MapPin size={18} className="text-indigo-600" />
                  <p className="text-xl font-bold text-slate-900 truncate">
                     {selectedLocationId === 'all' ? (overallStats?.topBranch?.name || 'N/A') : `${overallStats?.totalReviews || 0} Reviews`}
                  </p>
              </div>
               {selectedLocationId === 'all' && (
                  <p className="text-slate-500 text-xs font-medium">Chiếm {overallStats?.topBranch?.percentage ?? 0}% tổng đánh giá toàn chuỗi</p>
              )}
           </div>
           {selectedLocationId === 'all' && (
               <button onClick={() => navigateToLocation(overallStats?.topBranch?.id)} className="mt-4 flex items-center text-indigo-600 text-[11px] font-bold cursor-pointer group w-fit">
                 Xem chi tiết <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
           )}
        </div>

        <div className="bg-white border border-slate-200/60 p-8 rounded-[32px] flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
           <div>
              <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">
                 Phân tích Hành động với AI
              </h4>
              <div className="flex items-center gap-2 mb-1">
                 <AlertCircle size={18} className="text-rose-500" />
                 <p className="text-xl font-bold text-slate-900 truncate w-full" title={overallStats.topIssue}>{overallStats.topIssue}</p>
              </div>
              <p className="text-slate-500 text-xs font-medium">
                 {selectedLocationId === 'all' ? 'Dựa trên tập dữ liệu Toàn hệ thống' : 'Dựa riêng biệt trên dữ liệu Quán này'}
              </p>
           </div>
           <button onClick={handleGetSolution} className="mt-4 flex items-center text-rose-600 hover:text-rose-700 text-[11px] font-bold cursor-pointer group w-fit transition-colors">
              Nhận Đề xuất AI Cải thiện <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
           </button>
        </div>
      </div>

      {/* AI Solution Modal */}
      {showSolutionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden relative border border-slate-100">
              <button onClick={() => setShowSolutionModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors z-10">
                <X size={20} />
              </button>

              <div className="p-8 md:p-12">
                 <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                       <Lightbulb size={28} />
                    </div>
                    <div>
                       <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                          AI Đề xuất Giải pháp <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-full text-slate-500 tracking-widest">{selectedLocationId === 'all' ? 'GLOBAL' : 'LOCAL'}</span>
                       </h2>
                       <p className="text-sm text-slate-500 font-medium">Báo cáo dựa trên hành vi và phân tích cảm xúc khách hàng</p>
                    </div>
                 </div>

                 {solutionLoading ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4">
                       <Zap size={48} className="text-indigo-400 animate-pulse" />
                       <p className="text-slate-400 font-bold text-lg animate-pulse">🤖 Trí tuệ nhân tạo đang phân tích...</p>
                    </div>
                 ) : aiSolution ? (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-8 max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                       <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50 shadow-inner">
                          <p className="text-slate-700 font-bold italic text-lg leading-relaxed">
                             "{aiSolution.summary}"
                          </p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                             <h4 className="text-rose-600 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle size={14} /> 3 Vấn đề cốt lõi
                             </h4>
                             <ul className="space-y-3">
                                {(aiSolution?.problems || []).map((p, i) => (
                                   <li key={i} className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-rose-50 hover:border-rose-200 transition-colors">
                                      <span className="w-6 h-6 bg-white border shadow-sm text-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</span>
                                      <span className="text-sm text-slate-700 font-bold leading-snug">{p}</span>
                                   </li>
                                ))}
                             </ul>
                          </div>

                          <div className="space-y-4">
                             <h4 className="text-emerald-600 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={14} /> Kế hoạch hành động
                             </h4>
                             <ul className="space-y-3">
                                {(aiSolution?.actions || []).map((a, i) => (
                                   <li key={i} className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-emerald-50 hover:border-emerald-200 transition-colors">
                                      <span className="w-6 h-6 bg-white border shadow-sm text-emerald-500 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</span>
                                      <span className="text-sm text-slate-700 font-bold leading-snug">{a}</span>
                                   </li>
                                ))}
                             </ul>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="py-10 text-center text-slate-400">
                       <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                       <p>Lỗi kết nối AI. Vui lòng thử lại sau.</p>
                    </div>
                 )}
                 {(!solutionLoading && aiSolution) && (
                    <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end">
                       <button onClick={() => setShowSolutionModal(false)} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-2xl text-sm font-bold transition-all shadow-xl hover:shadow-2xl active:scale-95">
                          Tôi đã hiểu, cảm ơn AI
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
