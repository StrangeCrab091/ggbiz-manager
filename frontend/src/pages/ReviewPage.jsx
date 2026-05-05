import { Sparkles, CheckCircle2, Loader2, RotateCcw, ArrowUpRight, Search, Calendar, Filter, Clock, AlertTriangle, MessageSquare, Send, ShieldAlert, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useOutletContext, useLocation } from 'react-router-dom';
import apiService from '../services/apiService';
import { useUser } from '../contexts/UserContext';
import QaTab from '../components/qa/QaTab';

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState('reviews'); // 'reviews' | 'qa'
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });
  
  const [filterRating, setFilterRating] = useState('all');
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCooldown, setSyncCooldown] = useState(0); // 30s debounce timer
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(localStorage.getItem('google_quota_exceeded') === 'true');
  const [quotaMessage, setQuotaMessage] = useState('');
  const [noLocationWarning, setNoLocationWarning] = useState(false);
  
  const [reportingFor, setReportingFor] = useState(null);
  const [disputeDrafts, setDisputeDrafts] = useState({});

  const [apiError, setApiError] = useState(null);
  const context = useOutletContext() || {};
  const selectedLocationId = context?.selectedLocationId;
  const setSelectedLocationId = context?.setSelectedLocationId;
  const { user } = useUser();

  // Auto-select chi nhánh đầu tiên nếu chưa chọn (cho Manager/Admin mới đăng nhập)
  useEffect(() => {
    if (selectedLocationId) return; // Đã có rồi thì không cần
    if (!user) return;
    
    const autoSelectBranch = async () => {
      try {
        const data = await apiService.get('/locations');
        if (data?.success && data?.data?.length > 0) {
          let availableLocations = data.data;
          
          // Nếu là MANAGER, lọc theo managedLocations
          if (user?.role?.toUpperCase() === 'MANAGER' && user?.managedLocations?.length > 0) {
            availableLocations = data.data.filter(l => user.managedLocations.includes(l.locationId));
          }
          
          if (availableLocations.length > 0 && setSelectedLocationId) {
            const firstId = availableLocations[0].locationId;
            console.log('🔄 [ReviewPage] Auto-select chi nhánh đầu tiên:', firstId);
            setSelectedLocationId(firstId);
            localStorage.setItem('selectedLocationId', firstId);
          } else if (user?.role?.toUpperCase() === 'MANAGER' && availableLocations.length === 0) {
            setNoLocationWarning(true);
          }
        }
      } catch (err) {
        console.error('Lỗi auto-select branch:', err);
      }
    };
    
    autoSelectBranch();
  }, [selectedLocationId, user, setSelectedLocationId]);

  // Countdown effect for sync debounce
  useEffect(() => {
    let timer;
    if (syncCooldown > 0) {
      timer = setTimeout(() => {
        setSyncCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [syncCooldown]);

  // Xử lý Deep Link từ Analytics (URL params)
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlStartDate = queryParams.get('startDate');
    const urlEndDate = queryParams.get('endDate');
    
    if (urlStartDate) setStartDate(urlStartDate);
    if (urlEndDate) setEndDate(urlEndDate);
  }, []);

  // Reset page khi location hoặc bộ lọc thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLocationId, filterRating, filterSentiment, filterStatus, startDate, endDate]);



  useEffect(() => {
    if (!selectedLocationId) return;

    const fetchReviews = async () => {
      setLoading(true);
      setApiError(null);
      try {
        const queryParams = new URLSearchParams();
        if (selectedLocationId) queryParams.append('locationId', selectedLocationId);
        queryParams.append('page', currentPage);
        queryParams.append('limit', 10);
        
        if (filterRating !== 'all') queryParams.append('rating', filterRating);
        if (filterSentiment !== 'all') queryParams.append('sentiment', filterSentiment);
        if (filterStatus !== 'all') queryParams.append('status', filterStatus);
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);

        const data = await apiService.get(`/reviews?${queryParams.toString()}`);
        
        if (data?.success && data?.data) {
          const formattedReviews = data.data.map(r => ({
             id: r.reviewId || r._id,
             _id: r._id,
             name: r.reviewerName || (r.reviewer && r.reviewer.displayName) || 'Khách hàng',
             date: new Date(r.createdAt || r.createTime).toLocaleDateString('vi-VN'),
             stars: r.rating || r.starRating || 5,
             sentiment: (r.rating || r.starRating || 5) >= 4 ? 'Tích cực' : ((r.rating || r.starRating || 5) <= 2 ? 'Tiêu cực' : 'Trung lập'),
             content: r.reviewText || r.comment || '(Chỉ đánh giá sao, không có bình luận)',
             aiReply: r.replyText || r.aiReply || null,
             reply_content: r.reply_content || null,
             replied_at: r.replied_at || null,
             profilePhotoUrl: r.reviewer?.profilePhotoUrl,
             isAutoReplied: r.status === 'Auto-Replied',
             status: r.status,
             isSpamFlagged: r.isSpamFlagged,
             category_tag: r.category_tag || null,
          }));
          setReviews(formattedReviews);
          if (data.pagination) {
            setPagination(data.pagination);
          } else {
            setPagination({ totalPages: 1, total: 0 });
          }
        } else {
          setReviews([]);
          setPagination({ totalPages: 1, total: 0 });
          setApiError('API trả về rỗng hoặc success=false');
        }
      } catch (error) {
        console.error('Lỗi khi lấy danh sách reviews:', error);
        setApiError(`Lỗi kết nối API: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [selectedLocationId, currentPage, filterRating, filterSentiment, filterStatus, startDate, endDate]);

  const [generatingFor, setGeneratingFor] = useState(null);
  const [submittingFor, setSubmittingFor] = useState(null);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editText, setEditText] = useState('');

  const handleStartEdit = (review) => {
    setEditingReviewId(review.id);
    setEditText(review.aiReply || review.reply_content || '');
  };

  const handleSaveEdit = (reviewId) => {
    setReviews(prev => prev.map(r => 
      r.id === reviewId ? { ...r, aiReply: editText } : r
    ));
    setEditingReviewId(null);
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
    setEditText('');
  };

  const handleGenerateReply = async (reviewId, comment, rating, reviewerName) => {
    try {
      setGeneratingFor(reviewId);
      
      const data = await apiService.post('/reviews/generate-reply', { comment, rating, reviewerName });
      
      if (data.success) {
        console.log("🤖 KẾT QUẢ AI TRẢ VỀ (GỢI Ý):", data.data.reply);
        setReviews(prevReviews => prevReviews.map(r => 
          r.id === reviewId ? { ...r, aiReply: data.data.reply } : r
        ));
      } else {
        alert('Lỗi khi tạo phản hồi: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi khi gọi API:', error);
      alert('Không thể kết nối đến server để tạo phản hồi.');
    } finally {
      setGeneratingFor(null);
    }
  };

  // Xác nhận gửi phản hồi: Lưu DB + Đẩy lên Google Maps
  const handleSubmitReply = async (review) => {
    if (!review.aiReply) return;
    
    try {
      setSubmittingFor(review.id);
      
      const data = await apiService.post('/reviews/submit-reply', {
        reviewId: review._id,
        replyText: review.aiReply
      });
      
      if (data.success) {
        // Cập nhật UI: đánh dấu đã gửi thành công
        setReviews(prevReviews => prevReviews.map(r => 
          r.id === review.id ? { 
            ...r, 
            reply_content: review.aiReply, 
            replied_at: new Date().toISOString(),
            status: 'AI-Replied'
          } : r
        ));
        alert(data.message);
      } else {
        alert('❌ Lỗi: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi khi submit reply:', error);
      alert('Không thể kết nối đến server.');
    } finally {
      setSubmittingFor(null);
    }
  };

  const handleReportViolation = async (review) => {
    setReportingFor(review.id);
    try {
      // 1. Soạn đơn bằng AI
      const data = await apiService.post(`/spam/dispute-draft`, {
        reviewText: review.content,
        reviewerName: review.name
      });
      if (data.success) {
        setDisputeDrafts(prev => ({ ...prev, [review.id]: data.data }));
      }
      // 2. Cập nhật trạng thái trong DB
      await apiService.put(`/spam/report-review/${review.id}`);
      
      // 3. Cập nhật UI
      setReviews(prevReviews => prevReviews.map(r => 
        r.id === review.id ? { ...r, status: 'Reporting' } : r
      ));
    } catch (e) {
      console.error('Error reporting: ', e);
      alert('Không thể kết nối API AI.');
    } finally {
      setReportingFor(null);
    }
  };

  const handleSimulate = async (type = 'negative') => {
    try {
      const data = await apiService.post('/reviews/simulate', { 
        locationId: selectedLocationId || 'demo-id',
        type: type
      });
      
      if (data.success) {
        const isAutoReplied = data.data.status === 'Auto-Replied';
        const newReview = {
          id: data.data.reviewId || data.data._id,
          name: data.data.reviewerName || data.data.reviewer?.displayName,
          date: new Date(data.data.createdAt || data.data.createTime).toLocaleDateString('vi-VN'),
          stars: data.data.rating || data.data.starRating,
          sentiment: (data.data.rating || data.data.starRating) >= 4 ? 'Tích cực' : 'Tiêu cực',
          content: data.data.reviewText || data.data.comment || '(Không có bình luận)',
          aiReply: data.data.replyText || data.data.aiReply || null,
          reply_content: data.data.reply_content || null,
          replied_at: data.data.replied_at || null,
          profilePhotoUrl: data.data.reviewer?.profilePhotoUrl,
          isAutoReplied: isAutoReplied
        };
        
        if (currentPage === 1) {
          setCurrentPage(0);
          setTimeout(() => setCurrentPage(1), 10);
        } else {
          setCurrentPage(1);
        }
        
        if (type === '5star_empty') {
          alert('✨ Hệ thống đã nhận đánh giá 5 sao và TỰ ĐỘNG PHẢN HỒI thành công!');
        } else {
          alert('🚨 Đã nhận 1 đánh giá tiêu cực! Vui lòng kiểm tra Telegram của bạn ngay.');
        }
      } else {
        alert('❌ Lỗi từ Server: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi giả lập:', error);
      alert('❌ Không thể kết nối đến server để giả lập. Hãy đảm bảo Backend đang chạy.');
    }
  };

  const handleSyncReviews = async () => {
    // Nếu locationId bị thiếu, thử fetch lại từ API
    let syncLocationId = selectedLocationId;
    if (!syncLocationId) {
      try {
        const locData = await apiService.get('/locations');
        if (locData?.success && locData?.data?.length > 0) {
          syncLocationId = locData.data[0].locationId;
          if (setSelectedLocationId) {
            setSelectedLocationId(syncLocationId);
            localStorage.setItem('selectedLocationId', syncLocationId);
          }
          console.log('🔄 [Sync] Auto-select chi nhánh:', syncLocationId);
        } else {
          alert('⚠️ Không tìm thấy chi nhánh nào trong hệ thống. Vui lòng liên hệ Admin để được gán chi nhánh.');
          return;
        }
      } catch (err) {
        alert('❌ Không thể tải danh sách chi nhánh. Vui lòng thử lại.');
        return;
      }
    }

    if (syncCooldown > 0) {
      alert(`Vui lòng đợi ${syncCooldown}s trước khi đồng bộ lại.`);
      return;
    }

    setIsSyncing(true);
    try {
      const data = await apiService.post('/reviews/sync', { locationId: syncLocationId });
      
      if (data.status === 429) {
        setIsQuotaExceeded(true);
        localStorage.setItem('google_quota_exceeded', 'true');
        setQuotaMessage('Hệ thống đang chờ Google xét duyệt hạn mức API. Vui lòng thử lại sau!');
        return;
      }

      if (data.success) {
        alert(data.message);
        
        // Trigger fetch data again (resetting currentPage forces an effect trigger)
        if (currentPage === 1) {
           setCurrentPage(0);
           setTimeout(() => setCurrentPage(1), 50);
        } else {
           setCurrentPage(1);
        }
      } else {
        alert('❌ Lỗi Đồng Bộ: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi khi đồng bộ review:', error);
      alert('Không thể bắt kết nối với máy chủ Backend để đồng bộ. Chi tiết lỗi: ' + error.message + ' | ' + error.stack);
    } finally {
      setIsSyncing(false);
      setSyncCooldown(30); // Khóa nút 30 giây
    }
  };

  const handleExport = () => {
    try {
      if (!selectedLocationId) {
        alert("Vui lòng đợi tải chi nhánh.");
        return;
      }
      const queryParams = new URLSearchParams();
      queryParams.append('locationId', selectedLocationId);
      if (filterRating !== 'all') queryParams.append('rating', filterRating);
      if (filterSentiment !== 'all') queryParams.append('sentiment', filterSentiment);
      if (filterStatus !== 'all') queryParams.append('status', filterStatus);
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);

      window.open(`http://localhost:5000/api/reviews/export?${queryParams.toString()}`, '_blank');
    } catch (error) {
      console.error('Lỗi khi xuất báo cáo:', error);
      alert('Có lỗi xảy ra khi tạo link tải Excel.');
    }
  };

  // Tích hợp tìm kiếm text ở Client-side
  const filteredReviews = reviews.filter((review) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (review.name && review.name.toLowerCase().includes(q)) || 
           (review.content && review.content.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cảnh báo: Manager chưa được gán chi nhánh */}
      {noLocationWarning && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4 text-amber-800 animate-in slide-in-from-top-2 duration-300">
          <ShieldAlert size={24} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">⚠️ Tài khoản chưa được gán chi nhánh</p>
            <p className="text-xs font-medium mt-1 opacity-80">Tài khoản Manager của bạn chưa được Admin phân quyền quản lý chi nhánh nào. Vui lòng liên hệ Admin để được gán chi nhánh trong mục "Quản lý Nhân sự".</p>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý Review</h1>
          <p className="text-sm text-slate-500 mt-1">Phân tích, phân loại và AI trả lời phản hồi khách hàng tự động.</p>
        </div>
        <div className="flex flex-wrap gap-3 justify-end items-center mt-4 sm:mt-0">
          <button 
            onClick={() => handleSimulate('5star_empty')}
            className="hidden lg:flex bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-emerald-500/25 hover:shadow-lg flex items-center gap-2"
          >
            🌟 Khách 5 Sao
          </button>
          <button 
            onClick={() => handleSimulate('negative')}
            className="hidden lg:flex bg-orange-500 hover:bg-orange-600 text-white shadow-sm px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-orange-500/25 hover:shadow-lg flex items-center gap-2"
          >
            🚨 Đánh giá 1 Sao
          </button>
          
          <div className="hidden lg:block h-6 w-px bg-slate-200 mx-1"></div>

          <button 
            onClick={handleSyncReviews}
            disabled={isSyncing || syncCooldown > 0 || isQuotaExceeded}
            className={`${isQuotaExceeded ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white shadow-sm px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed w-48 justify-center`}
          >
            {isSyncing ? (
              <><Loader2 size={16} className="animate-spin" /> Đang đồng bộ...</>
            ) : isQuotaExceeded ? (
              <><AlertTriangle size={16} /> Hết hạn mức API</>
            ) : syncCooldown > 0 ? (
              <><Clock size={16} /> Chờ {syncCooldown}s...</>
            ) : (
              <><Sparkles size={16} /> Đồng bộ Review</>
            )}
          </button>

          <button 
            onClick={handleExport}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          >
            <ArrowUpRight size={16} />
            <span className="hidden sm:inline">Xuất báo cáo</span>
          </button>
        </div>
      </div>
      
      {isQuotaExceeded && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 animate-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={20} className="text-amber-500 shrink-0" />
          <p className="text-sm font-bold">
            {quotaMessage || 'Hệ thống đang chờ Google xét duyệt hạn mức API. Các tính năng đồng bộ sẽ tạm khóa.'}
          </p>
        </div>
      )}

      {/* HIỂN THỊ ERROR NGAY DƯỚI HEADER NẾU CÓ */}
      {apiError && !loading && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
          <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-rose-700">Lỗi tải dữ liệu Review</p>
            <p className="text-xs text-rose-600 mt-0.5">{apiError}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('reviews')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reviews' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Đánh Giá (Reviews)
        </button>
        <button 
          onClick={() => setActiveTab('qa')}
          className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'qa' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Hỏi & Đáp (Q&A) <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">New</span>
        </button>
      </div>
      
      {activeTab === 'qa' ? (
         <QaTab />
      ) : (
      <div className="bg-white shadow-sm border border-slate-200/60 rounded-2xl overflow-hidden">
        {/* Filter Bar Redesigned to Match Dashboard */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-end">
          {/* Ô Tìm kiếm */}
          <div className="space-y-1 flex-1 min-w-[200px] max-w-md">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Search size={12} /> Tìm kiếm
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Nội dung, tên khách hàng..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={14} />
              </div>
            </div>
          </div>

          {/* Từ ngày */}
          <div className="space-y-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Calendar size={12} /> Từ ngày
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Đến ngày */}
          <div className="space-y-1 min-w-[140px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Calendar size={12} /> Đến ngày
            </label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Dropdowns with Labels */}
          <div className="space-y-1 min-w-[120px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Filter size={12} /> Sao
            </label>
            <select 
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="all">Tất cả sao</option>
              <option value="5">⭐ 5 Sao</option>
              <option value="1-2">⭐ 1-2 Sao</option>
            </select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Sparkles size={12} /> Cảm xúc
            </label>
            <select 
              value={filterSentiment}
              onChange={(e) => setFilterSentiment(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="positive">Tích Cực</option>
              <option value="negative">Tiêu Cực</option>
            </select>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Clock size={12} /> Trạng thái
            </label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="unreplied">Chưa phản hồi</option>
              <option value="replied">Đã phản hồi</option>
            </select>
          </div>

          <button 
            onClick={() => {
              setFilterRating('all');
              setFilterSentiment('all');
              setFilterStatus('all');
              setStartDate('');
              setEndDate('');
              setSearchQuery('');
            }}
            className="px-3 py-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1.5 mb-1"
          >
            <RotateCcw size={14} />
            Đặt lại
          </button>
        </div>

        {/* Reviews List */}
        <div className="relative min-h-[400px]">
          {loading ? (
             <div className="space-y-4 pt-4">
               {[1, 2, 3].map((i) => (
                  <div key={i} className="p-6 border border-slate-100 rounded-3xl animate-pulse bg-white/60 flex flex-col gap-4">
                     <div className="flex gap-4 items-center">
                         <div className="w-12 h-12 bg-slate-200 rounded-full shadow-inner"></div>
                         <div className="space-y-2 flex-1">
                             <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                             <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                         </div>
                     </div>
                     <div className="h-20 bg-slate-50 border border-slate-100 rounded-2xl w-full ml-0 md:ml-16"></div>
                  </div>
               ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 transition-opacity duration-300">
               {filteredReviews.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-indigo-50 border-2 border-indigo-100 text-indigo-400 rounded-full flex items-center justify-center mb-5 shadow-sm mt-8">
                       <MessageSquare size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-3 tracking-tight">Chưa có dữ liệu đánh giá</h3>
                    <p className="text-slate-500 font-medium text-sm max-w-sm mb-8 leading-relaxed">Nền tảng chưa ghi nhận đánh giá nào cho chi nhánh này. Bấm đồng bộ để tải về từ Google Business Profile.</p>
                    <button 
                      onClick={handleSyncReviews}
                      disabled={isSyncing || syncCooldown > 0}
                      className="px-6 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-2xl text-sm transition-all flex items-center gap-2.5 active:scale-95 shadow-xl shadow-slate-900/10 hover:shadow-indigo-600/20 group uppercase tracking-wide disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {isSyncing ? <Loader2 size={16} className="animate-spin" /> : syncCooldown > 0 ? <Clock size={16} /> : <RotateCcw size={16} className="group-hover:-rotate-180 transition-transform duration-700" />}
                      {syncCooldown > 0 ? `Vui lòng chờ ${syncCooldown}s` : '📥 Đồng bộ lần đầu cho chi nhánh này'}
                    </button>
                  </div>
               ) : filteredReviews.map((review, index) => {
              const displayIndex = ((currentPage - 1) * 10) + index + 1;
              const badgeStyle = review.sentiment === 'Tích cực' 
                ? 'text-emerald-700 bg-emerald-100' 
                : review.sentiment === 'Tiêu cực' 
                  ? 'text-rose-700 bg-rose-100' 
                  : 'text-slate-500 bg-slate-100';

              return (
            <div key={review.id} className="p-6 flex flex-col gap-5 hover:bg-slate-50/50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="relative">
                    <img 
                      src={review.profilePhotoUrl || `https://ui-avatars.com/api/?name=${review.name.split(' ').join('+')}&background=e2e8f0&color=475569`} 
                      alt="user" 
                      className="w-12 h-12 rounded-full ring-4 ring-white shadow-sm object-cover" 
                    />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <h3 className="text-sm font-bold text-slate-900 tracking-tight">{review.name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ml-2 tracking-wider ${badgeStyle}`}>
                        Trang {currentPage} - #{displayIndex}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 drop-shadow-sm">
                      <div className="flex text-amber-500 text-xs">
                        {'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}
                      </div>
                      
                      {/* Trạng thái RBAC/Spam tags */}
                      {review.status === 'Reporting' ? (
                        <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase border border-orange-200">Đã báo cáo</span>
                      ) : review.isSpamFlagged ? (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded uppercase border border-rose-200">Nghi vấn Spam</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {/* Badge: Đã phản hồi hay chưa */}
                    {(review.reply_content || review.status === 'Auto-Replied' || review.status === 'AI-Replied') ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700">
                        ✅ Đã phản hồi
                        {review.replied_at && (
                          <span className="font-normal opacity-70 ml-1">({new Date(review.replied_at).toLocaleDateString('vi-VN')})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-600">
                        ⏳ Chờ phản hồi
                      </span>
                    )}
                    {/* Badge: category_tag */}
                    {review.category_tag && review.category_tag !== 'Khác' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600">
                        🏷️ {review.category_tag}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{review.date}</span>
                  </div>
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full ring-1 ${
                    review.sentiment === 'Tích cực' 
                      ? 'text-emerald-600 bg-emerald-100 ring-emerald-200/50' 
                      : 'text-rose-600 bg-rose-100 ring-rose-200/50'
                  }`}>
                    {review.sentiment}
                  </span>
                </div>
              </div>

              <p className="text-slate-700 text-sm leading-relaxed pl-0 md:pl-16 mt-3">
                {review.content}
              </p>

              <div className="ml-0 md:ml-16 mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2 items-start">
                  {/* Nút AI gợi ý: chỉ hiện khi CHƯA có phản hồi nào */}
                  {(!review.aiReply && !review.reply_content &&
                    review.status !== 'Auto-Replied' && review.status !== 'AI-Replied') ? (
                    <button 
                      onClick={() => handleGenerateReply(review.id, review.content, review.stars, review.name)}
                      disabled={generatingFor === review.id}
                      className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-indigo-100 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {generatingFor === review.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {generatingFor === review.id ? 'AI đang phân tích...' : 'AI gợi ý trả lời'}
                    </button>
                  ) : (review.reply_content || review.status === 'Auto-Replied' || review.status === 'AI-Replied') && !review.aiReply ? null : (
                    <button 
                      onClick={() => handleStartEdit(review)}
                      className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-slate-200"
                    >
                      <MessageSquare size={16} />
                      Chỉnh sửa phản hồi
                    </button>
                  )}

                  {(review.isSpamFlagged || review.status === 'Reporting') && (
                    <button 
                      onClick={() => handleReportViolation(review)}
                      disabled={reportingFor === review.id}
                      className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-rose-100 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {reportingFor === review.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <AlertTriangle size={16} />
                      )}
                      {reportingFor === review.id ? 'Đang soạn (AI)...' : (review.status === 'Reporting' ? 'Xem lại Đơn khiếu nại' : 'Báo cáo vi phạm')}
                    </button>
                  )}
                </div>

                {review.aiReply && (
                  <div className="bg-gradient-to-br from-indigo-50/80 to-indigo-50/30 p-4 rounded-xl border border-indigo-100/60 flex flex-col gap-3 relative shadow-sm mt-1">
                    <div className="absolute top-4 left-0 -ml-2 w-4 h-4 bg-indigo-50 border-t border-l border-indigo-100/60 rotate-45 hidden md:block"></div>
                    <div className="flex justify-between items-center z-10">
                      <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-900 tracking-tight">
                            {review.isAutoReplied ? 'Hệ thống đã trả lời tự động' : 'Cửa hàng đã trả lời (AI tạo)'}
                          </span>
                      </div>
                      <button 
                        onClick={() => handleStartEdit(review)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
                      >
                        Chỉnh sửa
                      </button>
                    </div>

                    {editingReviewId === review.id ? (
                      <div className="flex flex-col gap-2 z-10">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full p-3 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all min-h-[100px] text-slate-800 font-medium"
                          placeholder="Nhập nội dung phản hồi..."
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 rounded-lg transition-colors"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={() => handleSaveEdit(review.id)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                          >
                            Lưu thay đổi
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-indigo-900/80 leading-relaxed font-medium z-10">
                        {review.aiReply}
                      </p>
                    )}
                    {/* Nút xác nhận gửi lên Google Maps - chỉ hiển khi chưa được lưu (chưa có reply_content) */}
                    {!review.reply_content && (
                      <button
                        onClick={() => handleSubmitReply(review)}
                        disabled={submittingFor === review.id}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all self-end shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed z-10"
                      >
                        {submittingFor === review.id ? (
                          <><Loader2 size={14} className="animate-spin" /> Đang gửi lên Google Maps...</>
                        ) : (
                          <><Send size={14} /> Xác nhận gửi lên Google Maps</>
                        )}
                      </button>
                    )}
                  </div>
                )}
                
                {review.reply_content && (
                  <div className="bg-gradient-to-br from-emerald-50/80 to-emerald-50/30 p-4 rounded-xl border border-emerald-100/60 flex flex-col gap-3 relative shadow-sm mt-1">
                    <div className="absolute top-4 left-0 -ml-2 w-4 h-4 bg-emerald-50 border-t border-l border-emerald-100/60 rotate-45 hidden md:block"></div>
                    <div className="flex justify-between items-center z-10">
                      <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-900 tracking-tight">
                            {review.replied_at ? `Google Maps (${new Date(review.replied_at).toLocaleDateString('vi-VN')})` : 'Google Maps'}
                          </span>
                      </div>
                    </div>
                    <p className="text-sm text-emerald-900/80 leading-relaxed font-medium z-10">
                      {review.reply_content}
                    </p>
                  </div>
                )}
                
                {disputeDrafts[review.id] && (
                  <div className="bg-slate-900 rounded-2xl p-5 shadow-inner border border-rose-500/30 mt-1">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                        <h4 className="text-rose-400 text-[11px] font-black uppercase tracking-wider">GIẢI TRÌNH KHIẾU NẠI (Tiếng Anh - AI Draft)</h4>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(disputeDrafts[review.id]);
                              alert('Đã copy đơn khiếu nại vào Clipboard!');
                            }}
                            className="flex-1 sm:flex-none justify-center text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-500 transition-all font-semibold"
                          >
                             Copy & Paste
                          </button>
                          <a 
                            href={`https://business.google.com/locations/${selectedLocationId?.split('/').pop()}/reviews`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex-1 sm:flex-none justify-center text-[10px] bg-white/10 text-white px-3 py-1.5 rounded-lg hover:bg-white/20 transition-all flex items-center gap-1 font-semibold"
                          >
                             Đến Google GBP <ArrowUpRight size={12} />
                          </a>
                        </div>
                     </div>
                     <pre className="text-rose-50 text-xs font-mono whitespace-pre-wrap leading-relaxed opacity-90 border-l-2 border-rose-500/50 pl-3">
                        {disputeDrafts[review.id]}
                     </pre>
                  </div>
                )}
              </div>
            </div>
            );
          })}
          </div>
          )}
        </div>

        {/* Pagination UI */}
        {!loading && reviews.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
            <span className="text-sm text-slate-500 font-medium">
              Hiển thị tổng số <span className="font-bold text-slate-800">{pagination.total}</span> đánh giá
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Trước
              </button>
              
              <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] h-8 rounded-md text-sm font-bold transition-all px-2 ${
                      currentPage === page 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
