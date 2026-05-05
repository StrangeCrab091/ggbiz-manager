import React, { useState } from 'react';
import {
  Target, Search, Loader2, Zap, MapPin, Map as MapIcon,
  SlidersHorizontal, CheckCircle2, TrendingUp, AlertTriangle,
  LayoutGrid, Coffee, ShoppingBag, Cpu, Sparkles, Heart, BookOpen, Flame
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import apiService from '../../services/apiService';

// Fix Leaflet default icon path trong React/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// ─── ICON FACTORY ─────────────────────────────────────────────────────────────
const sourceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadow,
  iconSize: [30, 49], iconAnchor: [15, 49], popupAnchor: [1, -40],
});

/** Tạo marker màu dựa theo rating. Size tỉ lệ với popularityScore */
const makeCompetitorIcon = (rating, popularityScore) => {
  let color = 'red';
  if (rating >= 4.3) color = 'green';
  else if (rating >= 3.5) color = 'orange';
  const size = 20 + Math.round((popularityScore / 100) * 16); // 20–36px
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: markerShadow,
    iconSize: [size, Math.round(size * 1.65)],
    iconAnchor: [Math.round(size / 2), Math.round(size * 1.65)],
    popupAnchor: [1, -Math.round(size * 1.65)],
  });
};

// ─── PRESETS ──────────────────────────────────────────────────────────────────
const INDUSTRY_PRESETS = [
  {
    id: 'fb',
    label: 'F&B',
    icon: <Coffee size={16} />,
    keywords: ['quán cà phê đẹp', 'nhà hàng ngon', 'đồ uống pha chế', 'cafe làm việc', 'trà sữa ngon'],
    color: 'amber',
  },
  {
    id: 'retail',
    label: 'Bán lẻ',
    icon: <ShoppingBag size={16} />,
    keywords: ['cửa hàng tiện lợi', 'siêu thị mini', 'tạp hóa', 'shop bán lẻ', 'cửa hàng 24h'],
    color: 'emerald',
  },
  {
    id: 'tech',
    label: 'Công nghệ',
    icon: <Cpu size={16} />,
    keywords: ['dịch vụ IT', 'sửa chữa điện thoại', 'hosting', 'tên miền', 'phần mềm'],
    color: 'indigo',
  },
  {
    id: 'beauty',
    label: 'Làm đẹp',
    icon: <Heart size={16} />,
    keywords: ['spa đẹp', 'nail salon', 'thẩm mỹ viện', 'massage', 'chăm sóc da'],
    color: 'pink',
  },
  {
    id: 'edu',
    label: 'Giáo dục',
    icon: <BookOpen size={16} />,
    keywords: ['trung tâm tiếng Anh', 'trung tâm dạy học', 'lớp học kỹ năng', 'gia sư', 'đào tạo'],
    color: 'violet',
  },
  {
    id: 'general',
    label: 'Tổng quát',
    icon: <LayoutGrid size={16} />,
    keywords: [],
    color: 'slate',
  },
];

const colorMap = {
  amber:   { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  activeBg: 'bg-amber-500',  activeText: 'text-white' },
  emerald: { bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-300',activeBg: 'bg-emerald-600',activeText: 'text-white' },
  indigo:  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300', activeBg: 'bg-indigo-600', activeText: 'text-white' },
  pink:    { bg: 'bg-pink-100',   text: 'text-pink-700',   border: 'border-pink-300',   activeBg: 'bg-pink-500',   activeText: 'text-white' },
  violet:  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', activeBg: 'bg-violet-600', activeText: 'text-white' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-300',  activeBg: 'bg-slate-700',  activeText: 'text-white' },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
};

const PopularityBar = ({ score, label }) => {
  const color = score >= 70 ? 'bg-rose-500' : score >= 40 ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-black text-slate-500 w-6 text-right">{score}</span>
    </div>
  );
};

const RatingDot = ({ rating }) => {
  const color = rating >= 4.3 ? 'bg-emerald-500' : rating >= 3.5 ? 'bg-amber-400' : 'bg-rose-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1`} />;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LocalSearchGrid() {
  const [source, setSource] = useState('');
  const [keyword, setKeyword] = useState('');
  const [radius, setRadius] = useState(2000);
  const [industry, setIndustry] = useState('general');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeGapTab, setActiveGapTab] = useState('product');

  const selectedPreset = INDUSTRY_PRESETS.find(p => p.id === industry) || INDUSTRY_PRESETS[5];
  const c = colorMap[selectedPreset.color];

  const handleSelectPreset = (preset) => {
    setIndustry(preset.id);
    if (preset.keywords.length > 0 && !keyword) {
      setKeyword(preset.keywords[0]);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!source.trim() || !keyword.trim()) {
      alert('Vui lòng nhập Vị trí nguồn và Từ khóa mục tiêu');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await apiService.post('/competitor/radar', { source, keyword, radius, industry });
      if (data.success) {
        setResult(data.data);
        setActiveGapTab('product');
      } else {
        alert('Lỗi: ' + data.message);
      }
    } catch (err) {
      console.error('Radar error:', err);
      alert('Không thể kết nối đến server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const GAP_TABS = [
    { id: 'product', label: 'Sản phẩm', emoji: '📦' },
    { id: 'price',   label: 'Giá cả',   emoji: '💰' },
    { id: 'space',   label: 'Không gian',emoji: '🏠' },
    { id: 'service', label: 'Dịch vụ',  emoji: '🎯' },
  ];

  return (
    <div className="space-y-6">

      {/* ── SEARCH FORM ── */}
      <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow">
            <MapIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Competitor Radar Map</h2>
            <p className="text-xs text-slate-400 font-medium">Quét AI đối thủ trong bán kính — Gap Analysis + Chiến lược tấn công</p>
          </div>
        </div>

        {/* Industry Presets */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Chọn ngành nghề</p>
          <div className="flex flex-wrap gap-2">
            {INDUSTRY_PRESETS.map(preset => {
              const pc = colorMap[preset.color];
              const isActive = industry === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold border transition-all ${
                    isActive
                      ? `${pc.activeBg} ${pc.activeText} border-transparent shadow-md scale-105`
                      : `${pc.bg} ${pc.text} ${pc.border} hover:scale-105`
                  }`}
                >
                  {preset.icon} {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Vị trí của bạn (Nguồn)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Vd: Tên doanh nghiệp hoặc dán Link Google Maps"
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Từ khóa mục tiêu</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Vd: cafe đẹp, nhà hàng ngon, dịch vụ IT..."
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              {/* Quick keyword suggestions */}
              {selectedPreset.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedPreset.keywords.map(kw => (
                    <button
                      key={kw} type="button"
                      onClick={() => setKeyword(kw)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                        keyword === kw
                          ? `${c.activeBg} text-white border-transparent`
                          : `${c.bg} ${c.text} ${c.border} hover:opacity-80`
                      }`}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Radius Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-slate-600">
              <span className="flex items-center gap-2"><SlidersHorizontal size={16} /> Bán kính quét (Radius)</span>
              <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg font-black">{(radius / 1000).toFixed(1)} km</span>
            </div>
            <input
              type="range" min="500" max="10000" step="500" value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400">
              <span>500m</span><span>2.5km</span><span>5km</span><span>7.5km</span><span>10km</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !source.trim() || !keyword.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3.5 px-8 rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Đang quét vệ tinh AI...</>
              : <><Target className="w-5 h-5" /> Bắt đầu Quét Radar Đối Thủ</>
            }
          </button>
        </form>
      </div>

      {/* ── LOADING ── */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="relative mb-6">
            <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
            <div className="w-20 h-20 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0" />
            <Target className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 w-7 h-7 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Đang quét Radar khu vực...</h3>
          <p className="mt-2 text-sm text-slate-400 font-medium max-w-xs leading-relaxed">
            AI đang thu thập review, tính Popularity Score và phân tích Gap nhóm <span className="font-bold text-indigo-600">{selectedPreset.label}</span>. Vui lòng đợi.
          </p>
        </div>
      )}

      {/* ── RESULTS ── */}
      {!loading && result && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">

          {/* Legend + Map */}
          <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-sm">

            {/* Stats Row */}
            <div className="flex flex-wrap gap-4 mb-4 px-1">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2.5 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-bold text-blue-700">{result.source.displayName}</span>
                <span className="text-xs font-medium text-blue-500 ml-1">★ {result.source.rating}</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl">
                <Target size={14} className="text-slate-500" />
                <span className="text-sm font-bold text-slate-700">{result.competitors.length} đối thủ</span>
              </div>
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 px-4 py-2.5 rounded-xl">
                <Flame size={14} className="text-rose-500" />
                <span className="text-sm font-bold text-rose-700">
                  {result.competitors.filter(c => c.rating >= 4.3).length} đối thủ mạnh (≥4.3 ★)
                </span>
              </div>
            </div>

            {/* Leaflet Map */}
            <div className="relative">
              <div className="absolute top-4 right-4 z-[400] bg-white/95 backdrop-blur border border-slate-200 p-3 rounded-xl shadow-lg text-xs space-y-2">
                <p className="font-black text-slate-700 uppercase tracking-wider text-[10px]">Chú giải Marker</p>
                <div className="flex items-center gap-2 text-slate-600 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Vị trí của bạn</div>
                <div className="flex items-center gap-2 text-slate-600 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> Đối thủ mạnh (≥4.3★)</div>
                <div className="flex items-center gap-2 text-slate-600 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" /> Đối thủ trung bình</div>
                <div className="flex items-center gap-2 text-slate-600 font-medium"><span className="inline-block w-3 h-3 rounded-full bg-rose-500" /> Đối thủ yếu</div>
                <div className="flex items-center gap-2 text-slate-600 font-medium pt-1 border-t"><span className="inline-block w-3 h-3 rounded-full bg-rose-400 opacity-40" /> Heatmap cạnh tranh cao</div>
                <div className="flex items-center gap-2 text-slate-400 font-medium text-[10px]">Size = Độ phổ biến</div>
              </div>

              <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-slate-100">
                <MapContainer
                  center={[result.source.location.latitude, result.source.location.longitude]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <ChangeView center={[result.source.location.latitude, result.source.location.longitude]} />

                  {/* Source Marker */}
                  <Marker
                    position={[result.source.location.latitude, result.source.location.longitude]}
                    icon={sourceIcon}
                  >
                    <Popup>
                      <div className="font-sans p-1">
                        <strong className="text-sm text-blue-700">📍 {result.source.displayName}</strong>
                        <p className="text-xs text-slate-500 mt-1">Vị trí trung tâm (Bạn)</p>
                        <p className="text-xs font-bold mt-1">★ {result.source.rating} — Popularity: <span className="text-indigo-600">{result.source.popularityScore}/100</span></p>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Scan Radius Circle */}
                  <Circle
                    center={[result.source.location.latitude, result.source.location.longitude]}
                    radius={radius}
                    pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.04, weight: 1.5, dashArray: '6 4' }}
                  />

                  {/* Competitor Markers */}
                  {result.competitors.map(comp => comp.location ? (
                    <React.Fragment key={comp.id}>
                      <Marker
                        position={[comp.location.latitude, comp.location.longitude]}
                        icon={makeCompetitorIcon(comp.rating, comp.popularityScore || 30)}
                      >
                        <Popup>
                          <div className="font-sans p-1 min-w-[180px]">
                            <strong className="text-sm">{comp.displayName}</strong>
                            <div className="flex items-center gap-1 mt-1.5 mb-1">
                              <RatingDot rating={comp.rating} />
                              <span className="font-bold text-amber-600 text-xs">★ {comp.rating}</span>
                              <span className="text-slate-400 text-xs">({comp.userRatingCount})</span>
                            </div>
                            <div className="text-xs text-slate-500 space-y-0.5">
                              <div>Phổ biến: <strong className="text-indigo-600">{comp.popularityScore}/100</strong></div>
                              {result.source.location && (
                                <div>Cách bạn: <strong>{haversineKm(result.source.location.latitude, result.source.location.longitude, comp.location.latitude, comp.location.longitude)} km</strong></div>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Heatmap glow for high-performing competitors */}
                      {comp.rating >= 4.3 && comp.userRatingCount > 20 && (
                        <Circle
                          center={[comp.location.latitude, comp.location.longitude]}
                          radius={150 + (comp.popularityScore || 30) * 3}
                          pathOptions={{ color: 'transparent', fillColor: '#f43f5e', fillOpacity: 0.18 }}
                        />
                      )}
                    </React.Fragment>
                  ) : null)}
                </MapContainer>
              </div>
            </div>
          </div>

          {/* ── ANALYSIS ROW ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Top Competitors + Popularity */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
                  <Flame size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">Xếp hạng Đối Thủ</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Popularity Score</p>
                </div>
              </div>

              <div className="space-y-3">
                {result.topCompetitors.map((comp, idx) => (
                  <div key={comp.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-start gap-2.5 mb-2">
                      <div className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 line-clamp-1">{comp.displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <RatingDot rating={comp.rating} />
                          <span className="text-xs font-bold text-amber-600">★ {comp.rating}</span>
                          <span className="text-xs text-slate-400">({comp.userRatingCount})</span>
                          {idx === 0 && <span className="text-[9px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded uppercase">Hot 🔥</span>}
                        </div>
                      </div>
                    </div>
                    <PopularityBar score={comp.popularityScore || 0} label="Popularity" />
                  </div>
                ))}
                {result.topCompetitors.length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-400 font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                    Không tìm thấy đối thủ có review
                  </div>
                )}
              </div>
            </div>

            {/* AI Insights + Gap Analysis */}
            <div className="xl:col-span-2 space-y-4">

              {/* Summary + Top Weakness */}
              {result.aiAnalysis?.summary && (
                <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={18} className="text-yellow-300" />
                    <span className="text-xs font-black uppercase tracking-widest opacity-70">AI Market Overview</span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{result.aiAnalysis.summary}</p>
                  {result.aiAnalysis.topWeakness && (
                    <div className="mt-3 bg-white/15 rounded-xl p-3 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-yellow-300 shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold leading-relaxed opacity-90">
                        <span className="font-black">Điểm yếu chung:</span> {result.aiAnalysis.topWeakness}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Gap Analysis Table */}
              {result.aiAnalysis?.gapAnalysis && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                      <LayoutGrid size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Bảng So Sánh Lỗ Hổng Dịch Vụ</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gap Analysis — {selectedPreset.label}</p>
                    </div>
                  </div>

                  {/* Tab Row */}
                  <div className="flex bg-slate-100 p-1 rounded-xl mb-4 gap-1">
                    {GAP_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveGapTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-lg transition-all ${
                          activeGapTab === tab.id
                            ? 'bg-white shadow-sm text-slate-800'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span>{tab.emoji}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Tab Content */}
                  {(() => {
                    const gap = result.aiAnalysis.gapAnalysis[activeGapTab];
                    if (!gap) return null;
                    return (
                      <div className="space-y-3 animate-in fade-in duration-300">
                        <div>
                          <p className="text-xs font-black text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} /> Điểm yếu của đối thủ
                          </p>
                          <div className="space-y-2">
                            {(gap.weaknesses || []).map((w, i) => (
                              <div key={i} className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-xl p-3">
                                <span className="w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                <p className="text-sm text-rose-800 font-medium leading-snug">{w}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <TrendingUp size={12} /> Cơ hội khai thác
                          </p>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-start gap-2">
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-800 font-medium leading-snug">{gap.opportunity}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Marketing Campaign */}
              {result.aiAnalysis?.marketingCampaign && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={18} className="text-amber-600" />
                    <h3 className="font-bold text-amber-900">Chiến dịch Marketing Đề xuất</h3>
                  </div>
                  <p className="text-base font-black text-amber-800 mb-1">{result.aiAnalysis.marketingCampaign.title}</p>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">{result.aiAnalysis.marketingCampaign.angle}</p>
                  <p className="text-sm text-amber-800 font-medium leading-relaxed bg-white/60 rounded-xl p-3 border border-amber-200">
                    "{result.aiAnalysis.marketingCampaign.message}"
                  </p>
                </div>
              )}

              {/* Strategy Cards */}
              {result.aiAnalysis?.strategies?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-indigo-500" /> Chiến lược tấn công thị trường
                  </p>
                  <div className="space-y-3">
                    {result.aiAnalysis.strategies.map((strat, i) => (
                      <div key={i} className="flex items-start gap-3 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl hover:bg-indigo-50 transition-colors">
                        <div className="w-6 h-6 bg-indigo-600 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm mb-0.5">{strat.title}</p>
                          <p className="text-slate-600 text-sm font-medium leading-relaxed">{strat.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
