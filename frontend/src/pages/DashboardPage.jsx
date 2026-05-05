import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Sparkles, Star, MessageCircle, AlertTriangle, TrendingUp, ArrowUpRight, Loader2, Calendar, Filter, Clock, Bot, Activity, RotateCcw, FileText, TrendingDown, BarChart3, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Tooltip as UITooltip } from '../components/common/Tooltip';
import apiService from '../services/apiService';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    newReviewsCount: 0,
    positivePercentage: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    pendingCount: 0,
    starDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    latestReviews: [],
    chartData: []
  });
  
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    rating: 'all'
  });

  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null); // Lỗi API cụ thể
  const context = useOutletContext();
  const selectedLocationId = context?.selectedLocationId;
  const navigate = useNavigate();

  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [spamAlerts, setSpamAlerts] = useState([]);
  const [selectedSpamAlert, setSelectedSpamAlert] = useState(null);
  const [disputeDraft, setDisputeDraft] = useState('');
  const [loadingDispute, setLoadingDispute] = useState(false);
  const pdfRef = useRef(null);
  const [errorToast, setErrorToast] = useState(null);
  
  const [performance, setPerformance] = useState(null);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(localStorage.getItem('google_quota_exceeded') === 'true');
  const [toastType, setToastType] = useState('error');
  const [monthlyComparison, setMonthlyComparison] = useState(null);

  const [auditData, setAuditData] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Auto hide toast sau 3s
  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  const fetchStats = async () => {
    if (!selectedLocationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setApiError(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('locationId', selectedLocationId);
      if (filters.startDate && filters.startDate !== 'invalid date') queryParams.append('startDate', filters.startDate);
      if (filters.endDate && filters.endDate !== 'invalid date') queryParams.append('endDate', filters.endDate);
      if (filters.rating !== 'all') queryParams.append('rating', filters.rating);

      const data = await apiService.get(`/reviews/stats?${queryParams.toString()}`);

      if (data.status === 429) {
        setIsQuotaExceeded(true);
        localStorage.setItem('google_quota_exceeded', 'true');
        setToastType('warning');
        setErrorToast('Hệ thống đang chờ Google xét duyệt hạn mức API. Vui lòng thử lại sau!');
      }

      if (data.success) {
        setStats(data.data);
        setApiError(null);
      } else {
        setApiError(data.message || 'Không thể tải dữ liệu. Vui lòng thử lại.');
      }
    } catch (error) {
      console.error('Lỗi khi fetch stats:', error);
      const msg = error.response?.data?.message || error.message || 'Lỗi kết nối máy chủ Backend';
      setApiError(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpamAlerts = async () => {
    if (!selectedLocationId) return;
    try {
      const data = await apiService.get(`/spam/alerts?locationId=${selectedLocationId}`);
      if (data.success) {
        setSpamAlerts(data.data);
      }
    } catch (e) { console.error('Error fetching spam alerts', e); }
  };

  const fetchPerformance = async () => {
    if (!selectedLocationId) return;
    setLoadingPerformance(true);
    try {
      const data = await apiService.get(`/locations/performance?locationId=${selectedLocationId}`);
      
      if (data.status === 429) {
        setIsQuotaExceeded(true);
        localStorage.setItem('google_quota_exceeded', 'true');
        setToastType('warning');
        setErrorToast('Hệ thống đang chờ Google xét duyệt hạn mức API. Vui lòng thử lại sau!');
      }

      if (data.success) {
        setPerformance(data.data);
      } else {
        setPerformance(null);
      }
    } catch (e) {
      console.error('Lỗi khi fetch performance:', e);
      setPerformance(null);
    } finally {
      setLoadingPerformance(false);
    }
  };

  const fetchAuditScore = async () => {
    if (!selectedLocationId) return;
    setLoadingAudit(true);
    try {
      const data = await apiService.get(`/analytics/audit?locationId=${selectedLocationId}`);
      if (data.success) {
        setAuditData(data.data);
      }
    } catch (e) {
      console.error('Lỗi lấy audit score', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchSpamAlerts();
    fetchPerformance();
    fetchAuditScore();
    // Fetch monthly comparison
    if (selectedLocationId) {
      apiService.get(`/analytics/monthly-comparison?locationId=${selectedLocationId}`)
        .then(d => { if (d.success) setMonthlyComparison(d.data); })
        .catch(e => console.error('monthly-comparison error:', e));
    }
  }, [filters, selectedLocationId]);

  const resolveSpamAlert = async (id) => {
    try {
      const data = await apiService.put(`/spam/alerts/${id}/resolve`);
      if (data.success) {
        setSpamAlerts(prev => prev.filter(a => a._id !== id));
        setSelectedSpamAlert(null);
        setDisputeDraft('');
      }
    } catch (e) { alert('Lỗi khi xử lý cảnh báo'); }
  };

  const handleReportViolation = async (review) => {
    setLoadingDispute(true);
    setDisputeDraft('');
    try {
      // 1. Soạn đơn bằng AI
      const data = await apiService.post(`/spam/dispute-draft`, {
        reviewText: review.reviewText,
        reviewerName: review.reviewerName
      });
      if (data.success) {
        setDisputeDraft(data.data);
      }

      // 2. Cập nhật trạng thái trong DB
      const reportId = review.reviewId || review._id;
      await apiService.put(`/spam/report-review/${reportId}`);
      
      // 3. Làm mới stats để cập nhật trạng thái review ở Latest Reviews
      fetchStats();
      
    } catch (e) {
      console.error('Error reporting violation:', e);
      alert('Không thể kết nối AI để soạn đơn.');
    } finally {
      setLoadingDispute(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleExport = () => {
    if (!selectedLocationId) {
      alert("Vui lòng đợi tải chi nhánh.");
      return;
    }
    const queryParams = new URLSearchParams();
    queryParams.append('locationId', selectedLocationId);
    if (filters.startDate && filters.startDate !== 'invalid date') queryParams.append('startDate', filters.startDate);
    if (filters.endDate && filters.endDate !== 'invalid date') queryParams.append('endDate', filters.endDate);
    if (filters.rating !== 'all') queryParams.append('rating', filters.rating);
    
    // Đính kèm User để Backend nhận qua Query params khi Export Excel
    const savedUserStr = localStorage.getItem('mapmanager_user');
    if (savedUserStr) {
      try { const savedUser = JSON.parse(savedUserStr); queryParams.append('userId', savedUser._id); } catch(e){}
    }

    window.open(`http://localhost:5000/api/reviews/export?${queryParams.toString()}`, '_blank');
  };

  const handleExportPdf = async () => {
    if (!selectedLocationId) {
      alert("Vui lòng đợi tải chi nhánh.");
      return;
    }
    
    setIsExportingPdf(true);
    
    try {
      // Đợi DOM cập nhật một chút nếu cần thiết
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const element = pdfRef.current;
      if (!element) return;

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Bao_Cao_AI_MapManager_${new Date().getTime()}.pdf`);
    } catch (error) {
       console.error('Lỗi khi xuất PDF:', error);
       alert('Không thể xuất báo cáo PDF.');
    } finally {
       setIsExportingPdf(false);
    }
  };

  const fetchInsights = async () => {
    if (!selectedLocationId) {
      setErrorToast("Vui lòng đợi tải chi nhánh.");
      return;
    }
    
    setLoadingInsights(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('locationId', selectedLocationId);
      if (filters.startDate && filters.startDate !== 'invalid date') queryParams.append('startDate', filters.startDate);
      if (filters.endDate && filters.endDate !== 'invalid date') queryParams.append('endDate', filters.endDate);
      if (filters.rating !== 'all') queryParams.append('rating', filters.rating);

      const data = await apiService.get(`/reviews/insights?${queryParams.toString()}`);
      
      if (data.status === 429) {
        setIsQuotaExceeded(true);
        localStorage.setItem('google_quota_exceeded', 'true');
        setToastType('warning');
        setErrorToast('Hệ thống đang chờ Google xét duyệt hạn mức API. Vui lòng thử lại sau!');
        return;
      }

      if (data.success && data.data) {
        setInsights(data.data);
      } else {
        setErrorToast('Lỗi phân tích: ' + data.message);
      }
    } catch (error) {
       console.error('Lỗi khi phân tích:', error);
       setErrorToast('Lỗi phân tích AI, vui lòng thử lại!');
    } finally {
       setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {/* Toast Notification Error */}
      {/* Toast Notification Error/Warning */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`${toastType === 'warning' ? 'bg-amber-500 shadow-amber-500/30 border-amber-400' : 'bg-rose-500 shadow-rose-500/30 border-rose-400'} text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border`}>
            <AlertTriangle size={18} />
            <span className="text-sm font-bold tracking-wide">{errorToast}</span>
          </div>
        </div>
      )}
      {/* API Error Banner - Hiển thị khi fetch lỗi thay vì spinner mãi */}
      {apiError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-700">Lỗi tải dữ liệu Dashboard</p>
            <p className="text-xs text-rose-600 mt-0.5">{apiError}</p>
          </div>
          <button
            onClick={fetchStats}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-100 hover:bg-rose-200 px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            Thử lại
          </button>
        </div>
      )}
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tổng quan hệ thống</h1>
          <p className="text-sm text-slate-500 mt-1">Phân tích dữ liệu & Tình trạng đánh giá 30 ngày qua</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={fetchStats}
            disabled={isQuotaExceeded}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 ${isQuotaExceeded ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'} text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xl shadow-slate-200 active:scale-95`}
          >
            <RotateCcw size={16} /> {isQuotaExceeded ? 'Đang chờ Quota...' : 'Làm mới'} 
            <UITooltip text={isQuotaExceeded ? "API Google đang hết hạn mức, vui lòng quay lại sau." : "Cập nhật số liệu mới nhất từ Google Business API"} />
          </button>
          
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-600 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <FileText size={16} /> Xuất Excel <UITooltip text="Tải toàn bộ danh sách đánh giá về file Excel (.xlsx)" />
          </button>

          <button 
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            {isExportingPdf ? 'Đang tổng hợp...' : '📄 Xuất Báo Cáo'}
            <UITooltip text="Tạo báo cáo PDF chuyên nghiệp (Executive Summary) cho cấp lãnh đạo" />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5 flex-1 min-w-[160px]">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
            <Calendar size={12} /> Từ ngày
          </label>
          <input 
            type="date" 
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-[160px]">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
            <Calendar size={12} /> Đến ngày
          </label>
          <input 
            type="date" 
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-[160px]">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
            <Filter size={12} /> Lọc theo sao
          </label>
          <select 
            name="rating"
            value={filters.rating}
            onChange={handleFilterChange}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
          >
            <option value="all">Tất cả đánh giá</option>
            <option value="5">⭐⭐⭐⭐⭐ 5 Sao</option>
            <option value="4">⭐⭐⭐⭐ 4 Sao</option>
            <option value="3">⭐⭐⭐ 3 Sao</option>
            <option value="2">⭐⭐ 2 Sao</option>
            <option value="1">⭐ 1 Sao</option>
          </select>
        </div>
        <button 
          onClick={() => setFilters({ startDate: '', endDate: '', rating: 'all' })}
          className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors h-[38px]"
        >
          Đặt lại
        </button>
      </div>

      {/* Anti-Sabotage Spam Alerts */}
      {spamAlerts.length > 0 && (
        <div className="mb-6 animate-pulse">
          <div className="bg-rose-600 text-white p-4 rounded-3xl shadow-xl shadow-rose-200 border-2 border-rose-400 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                   <AlertTriangle size={28} className="text-white animate-bounce" />
                </div>
                <div>
                   <h3 className="font-black text-lg tracking-tight">🚨 PHÁT HIỆN TẤN CÔNG SPAM 1 SAO!</h3>
                   <p className="text-sm font-bold opacity-90">Có {spamAlerts.reduce((sum, a) => sum + a.count, 0)} đánh giá nghi vấn vừa được AI lọc ra.</p>
                </div>
             </div>
             <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedSpamAlert(spamAlerts[0])}
                  className="bg-white text-rose-600 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                   Xem chi tiết & Xử lý
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { 
            title: 'Tổng Review', 
            value: loading ? <Loader2 className="animate-spin" /> : stats.totalReviews.toLocaleString(), 
            desc: 'Tổng số theo bộ lọc', 
            icon: <MessageCircle size={20} className="text-blue-600" />, 
            bg: 'bg-blue-50', 
            gradient: 'from-blue-500/10' 
          },
          { 
            title: 'Đánh Giá Trung Bình', 
            value: loading ? <Loader2 className="animate-spin" /> : stats.averageRating, 
            desc: `Điểm hài lòng khách hàng`, 
            icon: <Star size={20} className="text-amber-500" />, 
            bg: 'bg-amber-50', 
            gradient: 'from-amber-500/10' 
          },
          { 
            title: 'Review Tích Cực', 
            value: loading ? <Loader2 className="animate-spin" /> : stats.positiveCount, 
            desc: `${stats.positivePercentage}% đánh giá 4-5 sao`, 
            icon: <Sparkles size={20} className="text-emerald-600" />, 
            bg: 'bg-emerald-50', 
            gradient: 'from-emerald-500/10' 
          },
          { 
            title: 'Review Tiêu Cực', 
            value: loading ? <Loader2 className="animate-spin" /> : stats.negativeCount, 
            desc: `Cần phản hồi kịp thời`, 
            icon: <AlertTriangle size={20} className="text-rose-600" />, 
            bg: 'bg-rose-50', 
            gradient: 'from-rose-500/10' 
          },
          { 
            title: 'Cần Xử Lý', 
            value: loading ? <Loader2 className="animate-spin" /> : stats.pendingCount, 
            desc: `Review chưa phản hồi`, 
            icon: <Clock size={20} className="text-orange-600" />, 
            bg: 'bg-orange-50', 
            gradient: 'from-orange-500/10' 
          },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/50 flex flex-col gap-4 relative overflow-hidden group hover:border-indigo-100 hover:shadow-lg transition-all duration-300">
            <div className="flex justify-between items-start z-10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.title}</span>
              <div className={`p-2.5 rounded-2xl transition-transform group-hover:scale-110 duration-500 ${stat.bg}`}>{stat.icon}</div>
            </div>
            <div className="z-10">
              <span className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</span>
              <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" />
                {stat.desc}
              </p>
            </div>
            <div className={`absolute -right-4 -bottom-4 w-32 h-32 bg-gradient-to-br ${stat.gradient} to-transparent rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
          </div>
        ))}
      </div>

      {/* Audit Score Widget */}
      {auditData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
          {/* Circular Progress Score */}
          <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-6">
              <Activity className="text-indigo-600" size={18} /> Điểm Sức Khỏe SEO Local
            </h4>
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                {/* Background Circle */}
                <circle cx="80" cy="80" r="70" fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
                {/* Progress Circle */}
                <circle 
                  cx="80" cy="80" r="70" fill="transparent" 
                  stroke={auditData.score >= 80 ? '#10b981' : auditData.score >= 50 ? '#f59e0b' : '#ef4444'} 
                  strokeWidth="16" strokeLinecap="round" 
                  strokeDasharray={`${(auditData.score / 100) * 439.8} 439.8`} 
                  className="transition-all duration-1000 ease-out" 
                />
              </svg>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                <span className="text-4xl font-black text-slate-800">{auditData.score}</span>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">/ 100</p>
              </div>
            </div>
            <p className="mt-6 text-sm font-semibold text-slate-600">
              {auditData.score >= 80 ? 'Hồ sơ tối ưu rất tốt!' : auditData.score >= 50 ? 'Cần cải thiện thêm một vài tiêu chí.' : 'Cảnh báo! Hồ sơ cần tối ưu gấp.'}
            </p>
          </div>

          {/* Checklist */}
          <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
            <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 mb-6">
              <AlertTriangle className="text-amber-500" size={18} /> Checklist Tối Ưu GMB
            </h4>
            <div className="space-y-4">
              {auditData.checklist.map((item, idx) => (
                <div key={idx} className={`flex items-start gap-4 p-4 rounded-2xl border ${item.status === 'good' ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                  {item.status === 'good' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                       <CheckCircle2 size={14} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                       <span className="font-bold text-sm">!</span>
                    </div>
                  )}
                  <p className={`text-sm font-semibold leading-relaxed ${item.status === 'good' ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Comparison Widget */}
      {monthlyComparison && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
          {/* Tháng này vs tháng trước */}
          <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Tháng này vs Tháng trước</h4>
              <div className="p-2 bg-indigo-50 rounded-xl"><BarChart3 size={14} className="text-indigo-600" /></div>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-4xl font-black text-slate-900">{monthlyComparison.thisMonth}</p>
                <p className="text-xs text-slate-500 font-semibold mt-1">Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</p>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                {monthlyComparison.growthPercent >= 0
                  ? <TrendingUp size={16} className="text-emerald-600" />
                  : <TrendingDown size={16} className="text-rose-500" />
                }
                <span className={`text-sm font-black ${
                  monthlyComparison.growthPercent >= 0 ? 'text-emerald-600' : 'text-rose-500'
                }`}>
                  {monthlyComparison.growthPercent >= 0 ? '+' : ''}{monthlyComparison.growthPercent}%
                </span>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-semibold">
                Tháng trước: <span className="font-black text-slate-700">{monthlyComparison.lastMonth} review</span>
              </p>
            </div>
          </div>

          {/* Top 3 vấn đề phàn nàn */}
          <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Top 3 vấn đề phàn nàn nhiều nhất (60 ngày)</h4>
              <div className="p-2 bg-rose-50 rounded-xl"><AlertTriangle size={14} className="text-rose-500" /></div>
            </div>
            {monthlyComparison.topComplaints.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-bold text-emerald-600">🎉 Chưa có vấn đề nổi bật — dịch vụ đang rất tốt!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {monthlyComparison.topComplaints.map((item, idx) => {
                  const maxCount = monthlyComparison.topComplaints[0]?.count || 1;
                  const pct = Math.round((item.count / maxCount) * 100);
                  const colors = ['bg-rose-500', 'bg-orange-400', 'bg-amber-400'];
                  const bgColors = ['bg-rose-50', 'bg-orange-50', 'bg-amber-50'];
                  const textColors = ['text-rose-700', 'text-orange-700', 'text-amber-700'];
                  return (
                    <div key={idx} className={`p-3 rounded-2xl flex items-center gap-4 ${bgColors[idx]}`}>
                      <span className={`text-xs font-black w-5 text-center ${textColors[idx]}`}>#{idx + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1.5">
                          <span className={`text-sm font-bold ${textColors[idx]}`}>{item.category}</span>
                          <span className={`text-xs font-black ${textColors[idx]}`}>{item.count} lần</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${colors[idx]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Business Performance Section */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 mt-6">
        <h3 className="font-bold text-slate-800 mb-6 flex justify-between items-center text-lg border-b border-slate-100 pb-4">
          Hiệu suất Kinh doanh 30 Ngày (Từ Google)
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-full cursor-pointer hover:bg-indigo-100 transition-all">
            BUSINESS PROFILE PERFORMANCE API
          </span>
        </h3>
        
        {loadingPerformance ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
        ) : !performance ? (
          <div className="py-20 text-center space-y-3">
            <Activity className="mx-auto text-slate-200" size={40} />
            <p className="text-slate-400 text-sm font-bold">Đang chờ đồng bộ dữ liệu hiệu suất</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Summary Column */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Lượt hiển thị (Impressions)</p>
                <p className="text-2xl font-black text-slate-800">{performance.summary.impressions.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Lượt gọi (Calls)</p>
                <p className="text-2xl font-black text-emerald-600">{performance.summary.calls.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase">Chỉ đường (Directions)</p>
                <p className="text-2xl font-black text-blue-600">{performance.summary.directions.toLocaleString()}</p>
              </div>
            </div>
            
            {/* Chart Column */}
            <div className="lg:col-span-3 h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performance.timeSeries} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} minTickGap={20} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px' }}
                    itemStyle={{ fontWeight: 700, fontSize: '12px' }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px', fontWeight: 600, fontSize: '11px' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 600 }} />
                  <Bar dataKey="impressions" name="Lượt hiển thị" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={10} opacity={0.3} />
                  <Bar dataKey="calls" name="Cuộc gọi" fill="#10b981" radius={[4, 4, 0, 0]} barSize={6} />
                  <Bar dataKey="directions" name="Chỉ đường" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Charts & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 flex flex-col min-h-[400px]">
            <div className="w-full flex justify-between items-center mb-8">
              <h3 className="font-bold text-slate-800 text-lg">Xu hướng đánh giá</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
                <TrendingUp size={14} /> 7 ngày gần đây
              </div>
            </div>
            <div className="flex-1 w-full h-[300px]">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontWeight: 800, fontSize: '14px' }}
                      labelStyle={{ color: '#64748b', marginBottom: '6px', fontWeight: 700, fontSize: '11px' }}
                      cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px', fontWeight: 600 }} />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      name="Tổng Review" 
                      stroke="#6366f1" 
                      strokeWidth={4} 
                      dot={{ stroke: '#6366f1', strokeWidth: 3, r: 4, fill: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }} 
                      animationDuration={1500}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="positive" 
                      name="Tích cực (4-5★)" 
                      stroke="#10b981" 
                      strokeWidth={4} 
                      dot={{ stroke: '#10b981', strokeWidth: 3, r: 4, fill: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#059669' }} 
                      animationDuration={1500}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="negative" 
                      name="Tiêu cực (1-2★)" 
                      stroke="#ef4444" 
                      strokeWidth={4} 
                      dot={{ stroke: '#ef4444', strokeWidth: 3, r: 4, fill: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0, fill: '#dc2626' }} 
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        
        {/* Star Distribution */}
        <div className="lg:col-span-1 bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-5 flex justify-between items-center text-lg">
              Phân bổ Đánh giá
              <div className="p-1.5 bg-amber-50 rounded-lg"><Star size={16} className="text-amber-500 fill-amber-500" /></div>
            </h3>
            
            {loading ? (
               <div className="flex justify-center p-6"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : (
              <div className="space-y-3.5">
                {[5, 4, 3, 2, 1].map(star => {
                  const count = stats.starDistribution ? (stats.starDistribution[star] || 0) : 0;
                  const total = stats.totalReviews || 1;
                  const percentage = Math.round((count / total) * 100);
                  
                  // Color coding
                  let barColor = 'bg-emerald-500';
                  if (star === 3) barColor = 'bg-amber-400';
                  if (star <= 2) barColor = 'bg-rose-500';

                  return (
                    <div key={star} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-10 text-xs font-bold text-slate-600">
                        {star} <Star size={12} className="text-amber-400 fill-amber-400" />
                      </div>
                      <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${barColor}`} 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-12 text-right">
                        <span className="text-xs font-bold text-slate-700">{count}</span>
                        <span className="text-[10px] font-semibold text-slate-400 ml-1">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 mt-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-indigo-600"></div>
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl text-white shadow-md">
              <Bot size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                ✨ AI Phân tích Tiếng nói Khách hàng
              </h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">INSIGHTS EXTRACTION</p>
            </div>
          </div>
          <button 
            onClick={fetchInsights}
            disabled={loadingInsights}
            className="text-xs font-bold bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl transition-all hover:bg-indigo-100 flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed border border-indigo-100 shadow-sm"
          >
            {loadingInsights ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            Làm mới phân tích AI
            <UITooltip text="Sử dụng Gemini AI để trích xuất điểm mạnh và nỗi đau của khách hàng từ 100 review mới nhất" />
          </button>
        </div>

        {!insights && !loadingInsights ? (
          <div className="py-12 text-center flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Bot size={40} className="text-slate-300 mb-3" />
            <p className="text-slate-500 font-bold text-sm">Chưa có dữ liệu phân tích</p>
            <p className="text-slate-400 text-xs mt-1">Bấm "Làm mới phân tích AI" để bắt đầu tổng hợp thông tin.</p>
          </div>
        ) : loadingInsights && !insights ? (
          <div className="py-12 flex flex-col items-center justify-center">
             <Loader2 size={32} className="animate-spin text-indigo-600 mb-4" />
             <p className="text-slate-500 font-bold text-sm animate-pulse">AI đang phân tích và trích xuất dữ liệu, vui lòng chờ...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/30 p-2 rounded-2xl">
            {/* Cột Điểm Mạnh */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 px-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/60">
                  <Sparkles size={16} />
                </div>
                <h4 className="text-base font-bold text-emerald-700">Điểm sáng (Strengths)</h4>
              </div>
              
              {insights?.strengths?.length > 0 ? (
                <div className="space-y-3">
                  {insights.strengths.map((item, idx) => (
                    <div key={idx} className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-50 to-transparent -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-slate-800 text-sm">{item.topic}</h5>
                          <span className="text-[10px] font-black tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/50">
                            {item.percentage}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-sm font-medium bg-white">
                  Không tìm thấy điểm sáng nổi bật trong dữ liệu này.
                </div>
              )}
            </div>

            {/* Cột Vấn Đề */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 px-2">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shadow-sm border border-rose-200/60">
                  <Activity size={16} />
                </div>
                <h4 className="text-base font-bold text-rose-700">Vấn đề cần xử lý (Pain Points)</h4>
              </div>
              
              {insights?.painPoints?.length > 0 ? (
                <div className="space-y-3">
                  {insights.painPoints.map((item, idx) => (
                    <div key={idx} className="bg-white border border-rose-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-rose-50 to-transparent -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-slate-800 text-sm">{item.topic}</h5>
                          <span className="text-[10px] font-black tracking-wider text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100/50">
                            {item.percentage}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-sm font-medium bg-white">
                  Chưa phát hiện vấn đề cốt lõi nào. Dịch vụ đang rất tốt!
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Latest Reviews */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 mt-6">
        <h3 className="font-bold text-slate-800 mb-6 flex justify-between items-center text-lg border-b border-slate-100 pb-4">
          Review Mới Nhất
          <span 
            onClick={() => navigate('/reviews')}
            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-full cursor-pointer hover:bg-indigo-100 hover:underline transition-all"
          >
            QUẢN LÝ TẤT CẢ
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
            ) : stats.latestReviews.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <MessageCircle className="mx-auto text-slate-200" size={40} />
                <p className="text-slate-400 text-xs font-bold">Chưa có đánh giá nào.</p>
              </div>
            ) : stats.latestReviews.map((review, i) => {
              // Xử lý hiển thị ngày an toàn
              let displayDate = 'Vừa xong';
              try {
                const dateObj = new Date(review.createdAt || review.createTime);
                if (!isNaN(dateObj.getTime())) {
                  displayDate = dateObj.toLocaleDateString('vi-VN');
                }
              } catch (e) { console.error(e); }

                      return (
                <div key={review._id || i} className="flex gap-4 items-start p-5 border border-slate-100 hover:border-indigo-100 hover:shadow-md bg-slate-50/50 hover:bg-white rounded-2xl transition-all cursor-pointer group relative overflow-hidden">
                  <img 
                    src={`https://ui-avatars.com/api/?name=${(review.reviewerName || 'U').split(' ').join('+')}&background=f1f5f9&color=6366f1&bold=true`} 
                    alt="user" 
                    className="w-11 h-11 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-105" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="text-xs font-bold text-slate-900 truncate tracking-tight">{review.reviewerName || 'Khách hàng ẩn danh'}</h4>
                      <span className="text-[9px] text-slate-400 font-bold uppercase">{displayDate}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex text-amber-400 text-[9px] tracking-tighter">
                        {'★'.repeat(review.rating || 5)}{'☆'.repeat(5 - (review.rating || 5))}
                      </div>
                      
                      {/* Trạng thái RBAC/Spam tags */}
                      {review.status === 'Reporting' ? (
                        <span className="text-[8px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase border border-orange-200">Đã báo cáo</span>
                      ) : review.isSpamFlagged ? (
                        <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase border border-rose-200">Nghi vấn Spam</span>
                      ) : (
                        <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded uppercase border border-emerald-200">Bình thường</span>
                      )}
                    </div>
                    
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                      {review.reviewText || review.comment || '(Không có nội dung bình luận)'}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Hidden PDF Report Template */}
      <div className="absolute left-[9999px] top-[9999px]">
        <div ref={pdfRef} className="w-[800px] bg-white p-10 text-slate-800 font-sans" style={{ minHeight: '1120px' }}>
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-8">
             <div>
                <h1 className="text-3xl font-black text-indigo-900 tracking-tight">MAPMANAGER</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Intelligence System</p>
             </div>
             <div className="text-right">
                <h2 className="text-xl font-bold text-slate-800 uppercase">Báo cáo Tổng quan</h2>
                <h3 className="text-sm font-bold text-slate-500 uppercase">Đánh giá Khách hàng & AI</h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">Xuất ngày: {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN')}</p>
             </div>
          </div>
          
          {/* Section 1: Core Metrics */}
          <div className="mb-10 block">
             <div className="bg-slate-800 text-white px-4 py-2 text-sm font-bold uppercase tracking-wider mb-4 border-l-4 border-indigo-500">
                1. Chỉ số cốt lõi (Executive Summary)
             </div>
             <div className="grid grid-cols-4 gap-4">
               <div className="border border-slate-200 p-4 rounded-xl text-center bg-slate-50">
                  <p className="text-xs font-bold text-slate-500 uppercase">Tổng Review</p>
                  <p className="text-2xl font-black text-blue-600 mt-1">{stats.totalReviews}</p>
               </div>
               <div className="border border-slate-200 p-4 rounded-xl text-center bg-slate-50">
                  <p className="text-xs font-bold text-slate-500 uppercase">Điểm TB</p>
                  <p className="text-2xl font-black text-amber-500 mt-1">{stats.averageRating}★</p>
               </div>
               <div className="border border-slate-200 p-4 rounded-xl text-center bg-emerald-50/50">
                  <p className="text-xs font-bold text-slate-500 uppercase">Tích cực</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{stats.positivePercentage}%</p>
               </div>
               <div className="border border-slate-200 p-4 rounded-xl text-center bg-rose-50/50">
                  <p className="text-xs font-bold text-slate-500 uppercase">Tiêu cực</p>
                  <p className="text-2xl font-black text-rose-600 mt-1">{((stats.negativeCount / (stats.totalReviews || 1)) * 100).toFixed(0)}%</p>
               </div>
             </div>
          </div>
          
          {/* Section 2: AI Insights */}
          <div className="mb-10 block">
             <div className="bg-slate-800 text-white px-4 py-2 text-sm font-bold uppercase tracking-wider mb-4 border-l-4 border-indigo-500">
                2. Phân tích Tiếng nói Khách hàng (AI Insights)
             </div>
             
             {!insights ? (
                <div className="text-sm text-slate-500 italic p-4 border border-dashed border-slate-200 text-center rounded-xl bg-slate-50">
                   (Chưa có dữ liệu phân tích AI)
                </div>
             ) : (
                <div className="grid grid-cols-2 gap-6 w-full">
                  <div className="break-inside-avoid w-full">
                     <h4 className="font-bold text-emerald-700 mb-3 flex items-center gap-2 pb-2 border-b border-emerald-100">
                        🟢 Điểm Sáng
                     </h4>
                     {insights.strengths?.length > 0 ? (
                        <div className="space-y-3 w-full">
                           {insights.strengths.slice(0, 4).map((item, idx) => (
                             <div key={idx} className="bg-emerald-50/30 border border-emerald-100 p-3 rounded-lg w-full">
                                <div className="flex justify-between items-start mb-1 w-full">
                                   <strong className="text-sm text-slate-800 block leading-snug pr-2">{item.topic}</strong>
                                   <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded whitespace-nowrap">{item.percentage}</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed block w-full">{item.summary}</p>
                             </div>
                           ))}
                        </div>
                     ) : <p className="text-xs text-slate-500">Không có dữ liệu</p>}
                  </div>
                  <div className="break-inside-avoid w-full">
                     <h4 className="font-bold text-rose-700 mb-3 flex items-center gap-2 pb-2 border-b border-rose-100">
                        🔴 Vấn Đề Cần Xử Lý Cấp Bách
                     </h4>
                     {insights.painPoints?.length > 0 ? (
                        <div className="space-y-3 w-full">
                           {insights.painPoints.slice(0, 4).map((item, idx) => (
                             <div key={idx} className="bg-rose-50/30 border border-rose-100 p-3 rounded-lg w-full">
                                <div className="flex justify-between items-start mb-1 w-full">
                                   <strong className="text-sm text-slate-800 block leading-snug pr-2">{item.topic}</strong>
                                   <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded whitespace-nowrap">{item.percentage}</span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed block w-full">{item.summary}</p>
                             </div>
                           ))}
                        </div>
                     ) : <p className="text-xs text-slate-500">Không có dữ liệu</p>}
                  </div>
                </div>
             )}
          </div>
          
          {/* Section 3: Red Alerts */}
          <div className="mb-4 block">
             <div className="bg-slate-800 text-white px-4 py-2 text-sm font-bold uppercase tracking-wider mb-4 border-l-4 border-rose-500">
                3. Danh sách Báo động đỏ (1-2 Sao mới nhất)
             </div>
             
             <table className="w-full text-left border-collapse text-sm">
                <thead>
                   <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-3 py-2 font-bold w-[15%]">Ngày</th>
                      <th className="border border-slate-300 px-3 py-2 font-bold w-[12%]">Điểm</th>
                      <th className="border border-slate-300 px-3 py-2 font-bold">Nội dung phản hồi</th>
                   </tr>
                </thead>
                <tbody>
                   {stats.latestReviews && stats.latestReviews.filter(r => (r.rating || 5) <= 2).slice(0, 5).map((r, i) => {
                      let dateStr = 'N/A';
                      try { dateStr = new Date(r.createdAt || r.createTime).toLocaleDateString('vi-VN'); } catch(e){}
                      return (
                         <tr key={i} className="bg-white">
                            <td className="border border-slate-300 px-3 py-2 text-xs">{dateStr}</td>
                            <td className="border border-slate-300 px-3 py-2 text-xs text-rose-600 font-bold whitespace-nowrap">
                               {'★'.repeat(r.rating || 1)}
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-xs leading-relaxed max-w-[400px]">{(r.reviewText || r.comment)?.substring(0, 150) || '(Không có Text)'}{((r.reviewText || r.comment)?.length > 150) ? '...' : ''}</td>
                         </tr>
                      )
                   })}
                   {(!stats.latestReviews || stats.latestReviews.filter(r => (r.rating || 5) <= 2).length === 0) && (
                      <tr>
                         <td colSpan="3" className="border border-slate-300 px-3 py-4 text-center text-slate-500 italic text-xs bg-white">Không có đánh giá 1-2 sao nào gần đây.</td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
          
          {/* Footer */}
          <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
             Tài liệu lưu hành nội bộ - Trích xuất từ Hệ thống Quản trị MapManager
          </div>
        </div>
      </div>
      {/* Modal Chi tiết Spam */}
      {selectedSpamAlert && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
               <div className="bg-rose-50 p-6 border-b border-rose-100 flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className="p-2.5 bg-rose-600 rounded-xl text-white shadow-lg"><Activity size={20} /></div>
                     <div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">Review Nghi Vấn Đợt Tấn Công</h3>
                        <p className="text-[11px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">Anti-Sabotage System Detection</p>
                     </div>
                  </div>
                  <button onClick={() => setSelectedSpamAlert(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400"><X size={20} /></button>
               </div>
               
               <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6">
                     <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1">AI Phân tích lý do:</p>
                     <p className="text-sm font-medium text-amber-900 leading-relaxed italic">"{selectedSpamAlert.reason}"</p>
                  </div>
                  
                  <div className="space-y-3">
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">Danh sách Review ({selectedSpamAlert.reviews?.length})</p>
                     {selectedSpamAlert.reviews?.map((r, i) => (
                        <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-all hover:shadow-md group">
                           <div className="flex justify-between items-center mb-1">
                              <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{r.reviewerName}</span>
                              <div className="flex items-center gap-3">
                                <div className="flex text-amber-400 text-xs">
                                   {'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}
                                </div>
                                <button 
                                  onClick={() => handleReportViolation(r)}
                                  className="text-[10px] font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded-lg border border-rose-100 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                >
                                  🚨 Báo cáo vi phạm
                                </button>
                              </div>
                           </div>
                           <p className="text-[13px] text-slate-600 leading-relaxed italic">"{r.reviewText || '(Không có nội dung)'}"</p>
                           <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">{new Date(r.createTime).toLocaleString('vi-VN')}</p>
                           
                           {/* AI Dispute Draft Area locally for this specific review action */}
                           {loadingDispute && <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-indigo-600 animate-pulse"><Loader2 size={12} className="animate-spin" /> AI đang soạn đơn khiếu nại...</div>}
                        </div>
                     ))}
                  </div>

                  {disputeDraft && (
                    <div className="mt-6 bg-slate-900 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-5 duration-500 border border-indigo-500/30">
                       <div className="flex justify-between items-center mb-4">
                          <h4 className="text-indigo-400 text-[11px] font-black uppercase tracking-[0.2em]">GIẢI TRÌNH KHIẾU NẠI (Tiếng Anh - AI Draft)</h4>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(disputeDraft);
                              alert('Đã copy đơn khiếu nại vào Clipboard!');
                            }}
                            className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-xl hover:bg-indigo-500 transition-all flex items-center gap-1.5"
                          >
                             Copy & Report
                          </button>
                       </div>
                       <pre className="text-indigo-100 text-[13px] font-mono whitespace-pre-wrap leading-relaxed opacity-90 border-l-2 border-indigo-500/50 pl-4 py-1">
                          {disputeDraft}
                       </pre>
                       <div className="mt-6 pt-4 border-t border-white/10">
                          <p className="text-[11px] text-slate-400 italic mb-4">Dán nội dung trên vào form khiếu nại của Google tại link dưới đây:</p>
                          <a 
                            href={`https://business.google.com/locations/${selectedLocationId?.split('/').pop()}/reviews`} 
                            target="_blank" 
                            className="inline-flex items-center gap-2 text-xs font-bold bg-white/10 text-white px-5 py-2.5 rounded-xl hover:bg-white/20 transition-all"
                          >
                             Mở trang quản lý review trên Google →
                          </a>
                       </div>
                    </div>
                  )}
               </div>
               
               <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <p className="text-[11px] text-slate-400 font-medium italic">Chúng tôi khuyến nghị bạn báo cáo những review này là "Spam/Fake content" lên Google Business.</p>
                  <button 
                    onClick={() => resolveSpamAlert(selectedSpamAlert._id)}
                    className="w-full sm:w-auto bg-slate-900 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-xl hover:bg-slate-800 hover:-translate-y-0.5 transition-all"
                  >
                     Đã hiểu & Đóng cảnh báo
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

// Giả lập LUCIDE ICON bị thiếu nếu có
function X({size}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
}
