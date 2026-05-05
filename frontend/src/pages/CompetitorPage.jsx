import { useState } from 'react';
import { Target, Search, Loader2, Zap, AlertTriangle, TrendingUp, Building2, MapPin, Users, Star, Radar } from 'lucide-react';
import apiService from '../services/apiService';
import LocalSearchGrid from '../components/competitor/LocalSearchGrid';

export default function CompetitorPage() {
  const [activeTab, setActiveTab] = useState('radar'); // 'single' hoặc 'radar'
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [competitorData, setCompetitorData] = useState(null);
  const [result, setResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setCompetitorData(null);
    setResult(null);

    try {
      const data = await apiService.post('/competitor/search', { query });
      if (data.success) {
        setCompetitorData(data.data);
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi khi tìm đối thủ:', error);
      alert('Không thể kết nối đến server để tìm đối thủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!competitorData) return;

    setAnalyzing(true);
    try {
      const data = await apiService.post('/competitor/analyze', { 
        reviews: competitorData.reviews,
        competitorInfo: {
          id: competitorData.id,
          displayName: competitorData.displayName,
          rating: competitorData.rating,
          userRatingCount: competitorData.userRatingCount,
        }
      });
      if (data.success) {
        setResult(data.data);
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (error) {
      console.error('Lỗi khi phân tích đối thủ:', error);
      alert('Không thể kết nối đến server để phân tích đối thủ.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Phân tích Đối thủ</h1>
          <p className="text-sm text-slate-500 mt-1">Dùng AI tự động quét Google Maps đối thủ để tìm ra điểm thóp và cơ hội chốt Sales.</p>
        </div>
      </div>

      <div className="flex bg-slate-200/60 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('radar')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'radar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Radar size={18} /> Radar Khu Vực
        </button>
        <button
          onClick={() => setActiveTab('single')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search size={18} /> Quét 1 Đối Thủ
        </button>
      </div>

      {activeTab === 'radar' ? (
        <LocalSearchGrid />
      ) : (
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 lg:p-8">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Nhập Tên đối thủ hoặc dán Link Google Maps của họ vào đây..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-base text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
          <button
            type="submit"
            disabled={loading || analyzing || !query.trim()}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed min-w-[140px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            Tìm kiếm
          </button>
        </form>

        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-slate-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              <Search className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-500 w-6 h-6 animate-pulse" />
            </div>
            <h3 className="mt-6 text-lg font-bold text-slate-800">Đang tra cứu thông tin...</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">Hệ thống đang tìm kiếm địa điểm tương ứng trên Google Maps. Vui lòng đợi.</p>
          </div>
        )}

        {analyzing && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-100 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
              <Target className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 w-6 h-6 animate-pulse" />
            </div>
            <h3 className="mt-6 text-lg font-bold text-slate-800">Đang cử AI đi do thám...</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">Hệ thống đang quét các đánh giá mới nhất của đối thủ trên Google Maps để tổng hợp báo cáo. Tùy thuộc vào số lượng review mà quá trình này có thể tốn vài chục giây.</p>
          </div>
        )}

        {!loading && !analyzing && !competitorData && !result && (
          <div className="py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
            <Building2 className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-slate-500 font-bold">Chưa có dữ liệu</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-sm">Hãy nhập tên đối thủ hoặc dán Link bản đồ và bấm "Tìm kiếm" để bắt đầu.</p>
          </div>
        )}

        {!loading && !analyzing && competitorData && !result && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl text-center shadow-sm">
              <div className="w-16 h-16 bg-white border shadow-sm text-slate-600 rounded-2xl flex items-center justify-center font-black text-2xl mx-auto mb-4">
                {competitorData.displayName.charAt(0)}
              </div>
              <h2 className="font-bold text-slate-900 text-2xl leading-tight">{competitorData.displayName}</h2>
              <div className="flex items-center justify-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 font-bold text-amber-500 bg-amber-50 px-3 py-1 rounded-lg">
                  <Star className="w-4 h-4 fill-amber-500" /> {competitorData.rating}
                </span>
                <span className="flex items-center gap-1.5 font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">
                  <Users className="w-4 h-4" /> {competitorData.userRatingCount} reviews
                </span>
              </div>
              
              <div className="mt-8 pt-6 border-t border-slate-200 border-dashed">
                 <p className="text-slate-500 mb-4 text-sm font-medium">Bạn có chắc chắn đây là đối thủ bạn muốn phân tích?</p>
                 <button
                    onClick={handleAnalyze}
                    className="flex items-center justify-center w-full gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-md group"
                 >
                    <Target className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    Xác nhận & Bắt đầu Phân tích AI
                 </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !analyzing && result && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Info Badge */}
            <div className="flex flex-wrap items-center gap-4 bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-lg">
                  {result.competitorInfo.displayName.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg leading-tight">{result.competitorInfo.displayName}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-500" /> {result.competitorInfo.rating}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      <Users className="w-3 h-3" /> {result.competitorInfo.userRatingCount} reviews
                    </span>
                    {result.competitorInfo.id && (
                       <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 uppercase tracking-widest pl-2 border-l border-indigo-200">
                         <MapPin className="w-3 h-3" /> Trích xuất từ Google Maps
                       </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weaknesses */}
              <div className="bg-rose-50/30 border border-rose-100 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-100/50 to-transparent rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-rose-700 tracking-tight">Điểm yếu đối thủ</h3>
                    <p className="text-[11px] font-bold text-rose-500/70 uppercase tracking-widest">Customer Pain Points</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  {result.insights.weaknesses && result.insights.weaknesses.length > 0 ? (
                    result.insights.weaknesses.map((item, idx) => (
                      <div key={idx} className="bg-white border border-rose-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <h4 className="font-bold text-slate-800 text-sm leading-snug">{item.topic}</h4>
                          <span className="shrink-0 text-[10px] font-black tracking-wider text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 text-center min-w-[48px]">
                            {item.percentage}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.summary}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 bg-white border border-dashed border-rose-200 text-center rounded-2xl text-slate-400 text-sm font-medium">
                      Chưa tìm thấy điểm yếu đáng kể hoặc đối thủ không có review tiêu cực.
                    </div>
                  )}
                </div>
              </div>

              {/* Opportunities */}
              <div className="bg-emerald-50/30 border border-emerald-100 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-emerald-100/50 to-transparent rounded-full -ml-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-emerald-700 tracking-tight">Cơ hội chốt Sales</h3>
                    <p className="text-[11px] font-bold text-emerald-500/70 uppercase tracking-widest">How to win them back</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  {result.insights.opportunities && result.insights.opportunities.length > 0 ? (
                    result.insights.opportunities.map((item, idx) => (
                      <div key={idx} className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <h4 className="font-bold text-slate-800 text-sm leading-snug">{item.topic}</h4>
                          <span className="shrink-0 text-[10px] font-black tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 text-center min-w-[48px]">
                            {item.percentage}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{item.summary}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 bg-white border border-dashed border-emerald-200 text-center rounded-2xl text-slate-400 text-sm font-medium">
                      AI không tìm thấy cơ hội rõ ràng nào. Cần thêm dữ liệu review.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-8 bg-indigo-50 rounded-2xl p-4 flex items-start gap-4 border border-indigo-100">
               <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl mt-1">
                 <Zap className="w-5 h-5 fill-indigo-600/20" />
               </div>
               <div>
                  <h4 className="font-bold text-indigo-900 text-sm">Gợi ý kịch bản Sales</h4>
                  <p className="text-xs text-indigo-700/80 mt-1 font-medium leading-relaxed">
                    Dựa vào các báo cáo trên, khi sale liên hệ với nhóm khách hàng định rời bỏ đối thủ, hãy trực tiếp đánh vào Pain Points (Điểm yếu) với tỷ lệ phần trăm cao nhất. Các giải pháp tương ứng đã được AI đề xuất ở cột "Cơ hội chốt sales".
                  </p>
               </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
