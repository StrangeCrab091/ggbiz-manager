import { Map, MapPin, Building, Search, Play, AlertCircle, Loader2, ArrowLeft, Target, Grid, Layers, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap, Tooltip } from 'react-leaflet';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import apiService from '../services/apiService';
import 'leaflet/dist/leaflet.css';

// Fix icon url issue with leaflet in React
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Component Map Tự di chuyển tâm
const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);
  return null;
};

export default function LocationsPage() {
  const context = useOutletContext();
  const globalSelectedId = context?.selectedLocationId;
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedLoc, setSelectedLoc] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [placeUrlOrId, setPlaceUrlOrId] = useState('');
  const [gridSize, setGridSize] = useState('3x3');
  const [distance, setDistance] = useState('1km');
  const [gridPoints, setGridPoints] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [errorToast, setErrorToast] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'heatmap' // Toggle Grid vs Heatmap
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const navigate = useNavigate();

  // Auto hide toast sau 3s
  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  useEffect(() => {
    apiService.get('/locations')
      .then(data => {
        if (data.success && data.data) {
          setLocations(data.data);
          
          if (globalSelectedId) {
             const found = data.data.find(l => l.locationId === globalSelectedId);
             if(found) setSelectedLoc(found);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [globalSelectedId]);

  const getMapCenter = (loc) => {
    if (loc?.lat && loc?.lng) return { lat: loc.lat, lng: loc.lng };
    // Hardcode tọa độ demo dự phòng nếu DB chưa có
    if (loc?.title?.toLowerCase().includes('hà nội')) return { lat: 21.028511, lng: 105.804817 };
    return { lat: 10.762622, lng: 106.660172 }; // Default HCMC
  };

  const generateGridCoords = (center, sizeStr, distanceStr) => {
    const size = parseInt(sizeStr.split('x')[0]);
    const distanceObj = { '500m': 500, '1km': 1000, '2km': 2000 };
    const d = distanceObj[distanceStr] || 1000;
    
    // 1 độ ~ 111,320 mét
    const dDeg = d / 111320;
    
    const coords = [];
    const offset = Math.floor(size / 2);
    const startLat = center.lat;
    const startLng = center.lng;

    for (let i = offset; i >= -offset; i--) { // Từ Bắc xuống Nam (hàng)
      for (let j = -offset; j <= offset; j++) { // Từ Tây sang Đông (cột)
        const latOffset = i * dDeg;
        const lngOffset = (j * dDeg) / Math.cos(startLat * (Math.PI / 180));
        coords.push({
          id: `grid-${i}-${j}`,
          lat: startLat + latOffset,
          lng: startLng + lngOffset,
          row: i,
          col: j,
          status: 'pending', // pending, top3, top10, bad
          rank: null,
          competitors: []
        });
      }
    }
    return coords;
  };

  // Xem preview grid ngay khi đổi tham số, chưa cần quét
  useEffect(() => {
    if (selectedLoc) {
      const center = getMapCenter(selectedLoc);
      setGridPoints(generateGridCoords(center, gridSize, distance));
      setScanComplete(false);
    }
  }, [selectedLoc, gridSize, distance]);

  const handleScanGrid = async () => {
    if (!keyword.trim()) {
      setErrorToast('Vui lòng nhập Từ khóa mục tiêu để quét!');
      return;
    }
    
    // Tính toán chi phí (số điểm trên lưới)
    const cost = parseInt(gridSize.split('x')[0]) * parseInt(gridSize.split('x')[0]);
    if (!window.confirm(`Xác nhận: Việc này sẽ tốn ${cost} lượt truy cập API. Bạn có muốn thực hiện?`)) {
       return;
    }

    setIsScanning(true);
    setScanComplete(false);
    
    // 1. Chuyển tất cả các điểm về trạng thái 'scanning' ngay lập tức
    setGridPoints(prev => prev.map(p => ({ ...p, status: 'scanning' })));

    try {
      // 2. Gọi API Backend thật
      const centerPos = getMapCenter(selectedLoc);
      
      const data = await apiService.post('/locations/scan-grid', { 
          keyword, 
          placeUrlOrId, 
          gridSize, 
          distance, 
          center: centerPos,
          gridPoints: gridPoints.map(p => ({ id: p.id, lat: p.lat, lng: p.lng })) // Gửi mảng lưới để backend xử lý
        });
      
      if (data.success) {
        // Cập nhật lại kết quả vào UI
        setGridPoints(data.data.results);
        setScanComplete(true);
      } else {
        setErrorToast('Lỗi từ Server: ' + data.message);
        setGridPoints(prev => prev.map(p => ({ ...p, status: 'pending' })));
      }

    } catch (error) {
       console.error('Lỗi quét lưới:', error);
       setErrorToast('Có lỗi xảy ra trong quá trình quét dữ liệu từ máy chủ!');
       setGridPoints(prev => prev.map(p => ({ ...p, status: 'pending' })));
    } finally {
       setIsScanning(false);
    }
  };

  const getMarkerColor = (status) => {
    switch (status) {
      case 'top3': return '#10b981'; // Xanh lá
      case 'top10': return '#eab308'; // Vàng
      case 'bad': return '#f43f5e'; // Đỏ
      case 'scanning': return '#6366f1'; // Indigo (pulse)
      default: return '#cbd5e1'; // Xám rỗng
    }
  };

  const getHeatmapOpacity = (status) => {
    if (status === 'top3') return 0.6;
    if (status === 'top10') return 0.5;
    if (status === 'bad') return 0.4;
    return 0;
  };

  const getHeatmapRadius = () => {
    const distanceObj = { '500m': 500, '1km': 1000, '2km': 2000 };
    return (distanceObj[distance] || 1000) * 0.75; // overlap radius for blur
  };

  const handleExportPDF = async () => {
    const mapElement = document.getElementById('heatmap-capture-area');
    if (!mapElement) return;
    
    setIsExportingPdf(true);
    
    // Đảm bảo ở chế độ Heatmap trước khi xuất
    if (viewMode !== 'heatmap') {
      setViewMode('heatmap');
      // Đợi DOM React render Heatmap
      await new Promise(r => setTimeout(r, 600)); 
    } else {
      await new Promise(r => setTimeout(r, 200)); 
    }

    try {
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        allowTaint: true,
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Page 1: Heatmap Area (Phân tích độ phủ)
      pdf.setFontSize(22);
      pdf.setTextColor(30, 41, 59); // slate-800
      pdf.text(`BÁO CÁO PHÂN TÍCH ĐỘ PHỦ THỊ TRƯỜNG`, pdfWidth/2, 20, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.text(`Chi nhánh: ${selectedLoc.title || 'Chưa rõ'} | Từ khóa: "${keyword}"`, pdfWidth/2, 28, { align: 'center' });
      pdf.text(`Lưới: ${gridSize} | Khoảng cách: ${distance} | Thời gian quét: ${new Date().toLocaleDateString('vi-VN')}`, pdfWidth/2, 35, { align: 'center' });

      // Căn giữa ảnh bản đồ
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgWidth = pdfWidth - 40;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      const xObj = 20;
      const yObj = 45;

      pdf.addImage(dataUrl, 'PNG', xObj, yObj, imgWidth, imgHeight, undefined, 'FAST');
      
      pdf.save(`Heatmap_DoPhu_${selectedLoc.locationId}_${new Date().getTime()}.pdf`);
    } catch (error) {
       console.error('Lỗi khi xuất PDF:', error);
       setErrorToast('Lỗi xuất PDF. Bản đồ có thể quá nặng.');
    } finally {
       setIsExportingPdf(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500 font-medium animate-pulse">Đang tải danh sách chi nhánh (Google My Business)...</div>;
  }

  // --- MÀN HÌNH CHỌN LOCATION (NẾU CHƯA CHỌN) ---
  if (!selectedLoc && locations.length > 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Chi nhánh của bạn</h1>
          <p className="text-sm text-slate-500 mt-1">Chọn một chi nhánh để quản lý và phân tích Local Search Grid</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((loc) => (
            <div 
               key={loc.locationId} 
               onClick={() => setSelectedLoc(loc)}
               className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                 <Building className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 truncate max-w-[200px]" title={loc.title}>{loc.title || 'Chi nhánh chưa có tên'}</h3>
                <p className="text-sm text-slate-500 font-mono mt-1 text-[11px] break-all">{loc.locationId}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- MÀN HÌNH CHƯA CÓ CHI NHÁNH TỪ API ---
  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] animate-in zoom-in-95 duration-500">
          {/* ... UI cũ ... */}
          <h2 className="text-xl font-bold">Chưa có dữ liệu</h2>
      </div>
    );
  }

  const cost = parseInt(gridSize.split('x')[0]) * parseInt(gridSize.split('x')[0]);
  const centerPos = getMapCenter(selectedLoc);

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6 shrink-0 relative">
        {/* Toast Notification Error */}
        {errorToast && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[120%] z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-xl shadow-rose-500/30 flex items-center gap-3 border border-rose-400">
              <AlertCircle size={18} />
              <span className="text-sm font-bold tracking-wide">{errorToast}</span>
            </div>
          </div>
        )}

        <button 
          onClick={() => setSelectedLoc(null)}
          className="p-2 hover:bg-slate-200 bg-slate-100 rounded-xl text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
            Local Search Grid <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded uppercase font-black tracking-widest">BETA</span>
            {scanComplete && (
               <button onClick={handleExportPDF} disabled={isExportingPdf} className="ml-4 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider rounded-lg shadow-md transition-all">
                 {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Xuất PDF
               </button>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1 uppercase font-bold text-[10px] tracking-widest">{selectedLoc.title}</p>
        </div>

        {/* View Mode Toggle - Hiện khi quét xong */}
        {scanComplete && (
           <div className="ml-auto flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-200">
             <button 
               onClick={() => setViewMode('grid')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <Grid size={16} /> Lưới số
             </button>
             <button 
               onClick={() => setViewMode('heatmap')}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'heatmap' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <Layers size={16} /> Bản đồ nhiệt
             </button>
           </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Bản đồ Lớn */}
        <div id="heatmap-capture-area" className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative z-0 flex flex-col">
           <MapContainer 
              center={[centerPos.lat, centerPos.lng]} 
              zoom={14} 
              style={{ flex: 1, width: '100%', borderRadius: '1.5rem' }}
              zoomControl={false}
           >
              {/* TileLayer dùng CartoDB Positron để clean UI, giống map premium */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <MapUpdater center={centerPos} />

              {/* Lớp hiển thị (Heatmap vs Grid) */}
              <div className={viewMode === 'heatmap' ? 'heatmap-mode-active' : ''}>
                {gridPoints.map((point) => {
                  const color = getMarkerColor(point.status);
                  
                  // Chế độ Heatmap -> dùng Circle overlap + Blur class CSS
                  if (viewMode === 'heatmap' && point.status !== 'pending' && point.status !== 'scanning') {
                     return (
                       <Circle
                         key={`heat-${point.id}`}
                         center={[point.lat, point.lng]}
                         radius={getHeatmapRadius()}
                         pathOptions={{
                           color: 'transparent',
                           fillColor: color,
                           fillOpacity: getHeatmapOpacity(point.status)
                         }}
                         className="heatmap-circle"
                       >
                         {/* Hover Soi điểm nóng Heatmap */}
                         <Tooltip sticky className="font-sans text-xs">
                            <b className="block text-slate-800">Thứ hạng dự kiến: #{point.rank}</b>
                            <span className="text-slate-500">{point.competitors[0]?.name || 'Không rõ'}</span>
                         </Tooltip>
                       </Circle>
                     )
                  }

                  // Chế độ Lưới (Grid) -> dùng CircleMarker cố định pixel
                  if (viewMode === 'grid' || point.status === 'pending' || point.status === 'scanning') {
                    return (
                      <CircleMarker
                        key={`grid-${point.id}`}
                        center={[point.lat, point.lng]}
                        radius={isScanning ? 16 : (point.status !== 'pending' ? 14 : 10)}
                        pathOptions={{ 
                          color: color, 
                          fillColor: point.status === 'pending' ? 'white' : color, 
                          fillOpacity: point.status === 'pending' ? 0.3 : 0.8,
                          weight: point.status === 'pending' ? 2 : 0
                        }}
                        className={point.status === 'scanning' ? 'animate-pulse' : ''}
                      >
                        {viewMode === 'grid' && point.status !== 'pending' && point.status !== 'scanning' && (
                          <Popup className="custom-popup">
                            <div className="p-1 min-w-[200px]">
                              <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <span className="font-black text-slate-900">Rank của bạn: </span>
                                <span className={`text-xl font-black ${point.status === 'top3' ? 'text-emerald-500' : point.status === 'top10' ? 'text-amber-500' : 'text-rose-500'}`}>
                                  #{point.rank}
                                </span>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">TOP 3 ĐỐI THỦ</p>
                              <ul className="space-y-2">
                                {point.competitors.map((comp, idx) => (
                                    <li key={idx} className="flex justify-between items-center text-xs">
                                      <span className="font-semibold text-slate-700 truncate max-w-[120px]">{idx+1}. {comp.name}</span>
                                      <span className="flex items-center text-amber-500 text-[10px] gap-1 font-bold">
                                        {comp.rating} ★
                                      </span>
                                    </li>
                                ))}
                              </ul>
                            </div>
                          </Popup>
                        )}
                      </CircleMarker>
                    );
                  }
                  return null;
                })}
              </div>
              
              {/* Nhãn Rank Text lên Circle (Grid mode only) */}
              {viewMode === 'grid' && gridPoints.map(point => {
                 if (point.status === 'pending' || point.status === 'scanning') return null;
                 return (
                    <CircleMarker
                       key={`text-${point.id}`}
                       center={[point.lat, point.lng]}
                       radius={0}
                       pathOptions={{ color: 'transparent' }}
                       interactive={false}
                    >
                      <Popup className="rank-label" closeButton={false} autoPan={false}>
                        <span className="text-white font-black drop-shadow-md text-xs">{point.rank > 20 ? '>20' : point.rank}</span>
                      </Popup>
                    </CircleMarker>
                 )
              })}
           </MapContainer>
           
           {/* Map Legends */}
           {scanComplete && (
              <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200/50">
                 <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">Chú giải kết quả</h4>
                 <div className="space-y-2">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-700">Top 1-3 (An toàn)</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-xs font-bold text-slate-700">Top 4-10 (Cần SEO)</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500"></div><span className="text-xs font-bold text-slate-700">Ngoài Top 10 (Mất tích)</span></div>
                 </div>
              </div>
           )}
        </div>

        {/* Cột Settings */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
             <div className="space-y-2">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1.5"><Search size={12}/> Link Google Maps hoặc Place ID</label>
               <input 
                 type="text" 
                 value={placeUrlOrId}
                 onChange={(e) => setPlaceUrlOrId(e.target.value)}
                 disabled={isScanning}
                 placeholder="VD: ChIJT4k... hoặc https://goo.gl/maps/..." 
                 className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
               />
             </div>

             <div className="space-y-2">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1.5"><Target size={12}/> Từ khóa mục tiêu</label>
               <input 
                 type="text" 
                 value={keyword}
                 onChange={(e) => setKeyword(e.target.value)}
                 disabled={isScanning}
                 placeholder="VD: Quán cafe đẹp, sửa xe..." 
                 className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
               />
             </div>

             <div className="space-y-2">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1.5"><Grid size={12}/> Kích thước Lưới (Lượt quét)</label>
               <select 
                 value={gridSize}
                 onChange={(e) => setGridSize(e.target.value)}
                 disabled={isScanning}
                 className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
               >
                 <option value="3x3">3 x 3 (9 Điểm quét)</option>
                 <option value="5x5">5 x 5 (25 Điểm quét)</option>
                 <option value="7x7">7 x 7 (49 Điểm quét)</option>
               </select>
             </div>

             <div className="space-y-2">
               <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1.5"><MapPin size={12}/> Khoảng cách Điểm</label>
               <select 
                   value={distance}
                   onChange={(e) => setDistance(e.target.value)}
                   disabled={isScanning}
                   className="w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none"
                >
                   <option value="500m">500 M</option>
                   <option value="1km">1 KM</option>
                   <option value="2km">2 KM</option>
                </select>
             </div>
             
             <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 flex items-start gap-3">
                <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
                <p className="text-xs text-orange-900 font-medium leading-relaxed">
                  Mỗi lần quét lưới <span className="font-bold">{gridSize}</span> sẽ tiêu tốn <span className="font-bold text-rose-600">{cost} lượt API</span>. Hãy cân nhắc trước khi thực hiện.
                </p>
             </div>

             <button
               onClick={handleScanGrid}
               disabled={isScanning}
               className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-75 disabled:cursor-not-allowed"
             >
                {isScanning ? (
                  <><Loader2 size={18} className="animate-spin" /> Đang quét dữ liệu...</>
                ) : (
                  <><Play size={18} fill="currentColor"/> Bắt đầu quét lưới</>
                )}
             </button>
          </div>
        </div>
      </div>

    </div>
  );
}
