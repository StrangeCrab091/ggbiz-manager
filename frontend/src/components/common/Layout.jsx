import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, MapPin, Settings, Bell, Search, Menu, X, ChevronDown, Zap, Target, Users, HelpCircle, BarChart3 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import apiService from '../../services/apiService';

const Layout = () => {
   const [sidebarOpen, setSidebarOpen] = useState(false);
   const location = useLocation();
   const [locations, setLocations] = useState([]);
   const [selectedLocationId, setSelectedLocationId] = useState(localStorage.getItem('selectedLocationId') || '');
   const [loading, setLoading] = useState(true);
   
   const [notifications, setNotifications] = useState([]);
   const [showNotifications, setShowNotifications] = useState(false);
   const { user, login, logout } = useUser();
   const [dbUsers, setDbUsers] = useState([]);
   const [showUserMenu, setShowUserMenu] = useState(false);

   // Demo data if API fails or takes too long
   const demoLocation = { locationId: 'demo-id', title: 'Chi nhánh Demo (Test)' };

   useEffect(() => {
    // Không gọi API khi user chưa được set (tránh 401)
    if (!user) return;
    
    let timeoutId;

    const fetchLocations = async () => {
      console.log('📡 [Frontend] Đang yêu cầu danh sách chi nhánh...');
      
      // Khởi động timeout 5s để set demo nếu quá chậm
      timeoutId = setTimeout(() => {
        if (loading && locations.length === 0) {
          console.warn('⏱️ [Frontend] API chi nhánh quá chậm, sử dụng Demo...');
          setLocations([demoLocation]);
          setSelectedLocationId('demo-id');
          setLoading(false);
        }
      }, 5000);

      try {
        const res = await apiService.get('/locations');
        const data = res; // axios interceptor returns response.data
        
        if (data.status === 429) {
          localStorage.setItem('google_quota_exceeded', 'true');
        } else {
          // Nếu thành công mà bộ đếm đang bật thì có thể cân nhắc clear, 
          // nhưng với Quota = 0 thì thường nó sẽ kẹt ở 429 dài hạn.
        }

        if (data.success && data.data && data.data.length > 0) {
          clearTimeout(timeoutId);
          console.log(`✅ [Frontend] Đã nhận ${data.data.length} chi nhánh.`);
          setLocations(data.data);
          
          const savedId = localStorage.getItem('selectedLocationId');
          const exists = data.data.find(l => l.locationId === savedId);
          
          if (savedId && exists) {
            setSelectedLocationId(savedId);
          } else {
            const firstId = data.data[0].locationId;
            setSelectedLocationId(firstId);
            localStorage.setItem('selectedLocationId', firstId);
          }
        } else {
          throw new Error('No branches returned');
        }
      } catch (error) {
        console.error('❌ [Frontend] Lỗi chi nhánh:', error);
        // Ngay lập tức dùng demo nếu lỗi
        if (locations.length === 0) {
          setLocations([demoLocation]);
          setSelectedLocationId('demo-id');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchLocations();
    return () => clearTimeout(timeoutId);
  }, [user]); // Chạy lại khi user đổi để lấy lại location nếu cần

  // Xóa fetch mock users vì đã có Login thật

  const handleLocationChange = (e) => {
    const newId = e.target.value;
    const selectedLocation = locations.find(l => l.locationId === newId);
    
    // === LOG CHI TIẾT CHO DEBUG F12 ===
    console.log('🔀 [Location Switch] Đang chuyển chi nhánh...');
    console.log('📋 [Location Object]', JSON.stringify(selectedLocation, null, 2));
    console.log('🆔 [Location ID]', newId);
    console.log('Đang kéo dữ liệu cho chi nhánh:', newId);
    
    setSelectedLocationId(newId);
    localStorage.setItem('selectedLocationId', newId);
    
    // Lưu thêm title để các component khác có thể hiển thị tên
    localStorage.setItem('selectedLocationTitle', selectedLocation?.title || '');
  };

  useEffect(() => {
    if (!selectedLocationId) return;
    
    const fetchNotifications = async () => {
      try {
        const res = await apiService.get(`/reviews/notifications?locationId=${selectedLocationId}`);
        const data = res;
        if (data.success && data.data) {
          setNotifications(data.data);
        }
      } catch (error) {
        console.error('Lỗi fetch notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [selectedLocationId]);

  // Đồng bộ selectedLocationId từ URL (Deep Link)
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const urlLocId = queryParams.get('locationId');
    if (urlLocId && urlLocId !== selectedLocationId && urlLocId !== 'all') {
      console.log('🔗 [Deep Link] Phát hiện locationId trong URL:', urlLocId);
      setSelectedLocationId(urlLocId);
      localStorage.setItem('selectedLocationId', urlLocId);
    }
  }, [location.search]);


  const markAsRead = async (id) => {
    try {
      const res = await apiService.put(`/reviews/notifications/${id}/read`);
      const data = res;
      if (data.success) {
        setNotifications(prev => prev.filter(n => (n._id || n.reviewId) !== id));
      }
    } catch (error) {
      console.error('Lỗi mark as read:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} />, roles: ['admin', 'manager'] },
    { name: 'Analytics', path: '/analytics', icon: <BarChart3 size={20} />, roles: ['admin', 'manager'] },
    { name: 'Reviews', path: '/reviews', icon: <MessageSquare size={20} />, roles: ['admin', 'manager'] },
    { name: 'Locations', path: '/locations', icon: <MapPin size={20} />, roles: ['admin', 'manager'] },
    { name: 'Automation', path: '/automation', icon: <Zap size={20} />, roles: ['admin'] },
    { name: 'Competitor', path: '/competitor', icon: <Target size={20} />, roles: ['admin'] },
    { name: 'User & HR', path: '/users', icon: <Users size={20} />, roles: ['admin'] },
    { name: 'Settings', path: '/settings', icon: <Settings size={20} />, roles: ['admin'] },
    { name: 'Hướng dẫn', path: '/tutorials', icon: <HelpCircle size={20} />, roles: ['admin', 'manager'] },
  ];

  const visibleNavItems = navItems.filter(item => item.roles.includes(user?.role?.toLowerCase() || 'admin'));

  // Chỉ hiển thị locations được cấp phép nếu là MANAGER
  let visibleLocations = locations;
  if (user?.role?.toUpperCase() === 'MANAGER') {
     visibleLocations = locations.filter(l => user.managedLocations?.includes(l.locationId));
  }

  const selectedLocation = visibleLocations.find(l => l.locationId === selectedLocationId) || demoLocation;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar - Cập nhật tông màu tối cực sang */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-slate-900 text-slate-300 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 shadow-2xl ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xl tracking-tight">
            <MessageSquare className="w-6 h-6 fill-indigo-400/20" />
            <span className="text-white">MapManager<span className="text-indigo-500">.</span></span>
          </div>
          <button 
            className="lg:hidden text-slate-500 hover:text-white transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-6">
          <p className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">
            Navigation
          </p>
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-xl">
          <div className="flex items-center hover:bg-slate-800/50 p-2.5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-slate-800" onClick={() => setShowUserMenu(!showUserMenu)}>
            <img 
              className="w-9 h-9 rounded-full ring-2 ring-indigo-500/20" 
              src={`https://ui-avatars.com/api/?name=${user?.username || 'Guest'}&background=6366f1&color=fff&bold=true`} 
              alt="Avatar" 
            />
            <div className="ml-3 flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.username || 'Guest'}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase truncate tracking-tight">{user?.role || 'user'} PLAN</p>
            </div>
            <ChevronDown size={14} className="text-slate-500 hidden lg:block ml-2" />
          </div>
          
          {showUserMenu && (
             <div className="absolute bottom-20 left-4 right-4 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50">
                <div className="px-4 py-3 border-t border-slate-700 text-sm md:-10 text-rose-400 hover:bg-rose-500/10 cursor-pointer font-bold flex items-center justify-center gap-2 transition-colors"
                     onClick={logout}
                >
                  Đăng xuất hệ thống
                </div>
             </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header - Thiết kế lại Tông tối Premium */}
        <header className="flex items-center justify-between h-16 px-4 lg:px-8 bg-slate-900 border-b border-slate-800 sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-slate-400">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Portal</span>
              <span className="text-slate-700">/</span>
              <span className="text-xs font-bold text-white uppercase tracking-widest">{location.pathname === '/' ? 'Dashboard' : location.pathname.split('/')[1]}</span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Tinh chỉnh Branch Selector (Dropdown) */}
            <div className="relative group">
              <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 text-slate-100 text-xs rounded-xl px-4 py-2 font-bold transition-all cursor-pointer hover:bg-slate-800 shadow-inner">
                <MapPin size={14} className="text-indigo-400" />
                <select 
                  className="bg-transparent border-none outline-none truncate max-w-[120px] lg:max-w-[200px] cursor-pointer appearance-none pr-6"
                  value={selectedLocationId}
                  onChange={handleLocationChange}
                >
                  {visibleLocations.length > 0 ? (
                    <>
                      {user?.role?.toUpperCase() === 'ADMIN' && <option value="all" className="bg-slate-900 text-white">🌍 Tất cả hệ thống ({locations.length})</option>}
                      {visibleLocations.map(loc => (
                        <option key={loc.locationId} value={loc.locationId} className="bg-slate-900 text-white">
                          {loc.title}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="" className="bg-slate-900 text-white">Chưa có quyền quản lý chi nhánh</option>
                  )}
                </select>
                <div className="absolute right-3 pointer-events-none">
                  <ChevronDown size={14} className="text-slate-500" />
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-800 mx-1"></div>
            
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              >
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 rounded-full flex justify-center items-center text-[9px] font-bold text-white ring-2 ring-slate-900 border-none shadow-sm drop-shadow-md">
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800">Review Cần Chú Ý</h3>
                    {notifications.length > 0 && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">{notifications.length} mới</span>}
                  </div>
                  <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 text-xs font-bold leading-relaxed">
                        Chưa có vấn đề mới. <br/>Mọi thứ đang hoạt động tốt! 🎉
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {notifications.map((notif, i) => (
                          <div 
                            key={notif._id || i} 
                            onClick={() => markAsRead(notif._id || notif.reviewId)}
                            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="text-xs font-bold text-slate-900 truncate max-w-[150px]">{notif.reviewerName || 'Khách hàng'}</span>
                              <div className="flex text-amber-500 text-[10px] font-bold tracking-tighter">
                                {'★'.repeat(notif.rating || 1)}{'☆'.repeat(5 - (notif.rating || 1))}
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium mb-1">
                              {notif.reviewText || '(Không có nội dung)'}
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(notif.createdAt).toLocaleDateString()}</span>
                                <span className="text-[9px] text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Đã xử lý (Xóa)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Đã đưa menu đăng xuất xuống Sidebar cho thuận tiện và gọn gàng */}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar-main">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto overflow-x-hidden">
            <Outlet context={{ selectedLocationId, setSelectedLocationId }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
