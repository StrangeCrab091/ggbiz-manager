import { useState, useEffect } from 'react';
import { Users, Shield, MapPin, Plus, Edit2, Trash2, Loader2, X, Check, Zap, UserPlus, Medal, Award, Activity } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import apiService from '../services/apiService';

export default function UserManagementPage() {
  const { user } = useUser();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, username: '', password: '', role: 'MANAGER', managedLocations: [] });

  const fetchUsers = async () => {
    try {
      const data = await apiService.get('/users');
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
       console.error('Error fetching users:', error);
    }
  };

  const fetchKPI = async () => {
    try {
      const data = await apiService.get('/users/kpi');
      if (data.success) {
        setKpiData(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await apiService.get('/locations');
      if (data.success) {
        setLocations(data.data);
      }
    } catch (error) {
      console.error('Lỗi chi nhánh:', error);
    }
  };

  useEffect(() => {
    // Case-insensitive role check
    const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
    if (isAdmin) {
      Promise.all([fetchUsers(), fetchLocations(), fetchKPI()]).then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleOpenModal = (editUser = null) => {
    if (editUser) {
      setFormData({
        id: editUser._id,
        username: editUser.username,
        password: '',
        role: editUser.role?.toUpperCase() || 'MANAGER',
        managedLocations: editUser.managedLocations || editUser.assignedLocations || []
      });
    } else {
      setFormData({ id: null, username: '', password: '', role: 'MANAGER', managedLocations: [] });
    }
    setIsModalOpen(true);
  };

  const handleToggleLocation = (locId) => {
    setFormData(prev => {
      const isSelected = prev.managedLocations.includes(locId);
      if (isSelected) {
        return { ...prev, managedLocations: prev.managedLocations.filter(id => id !== locId) };
      } else {
        return { ...prev, managedLocations: [...prev.managedLocations, locId] };
      }
    });
  };

  const handleSaveUser = async () => {
    if (!formData.username) return alert('Vui lòng nhập Username');

    const payload = { ...formData };
    // Standardize role for Backend (uppercase)
    payload.role = payload.role.toUpperCase();

    try {
      let data;
      if (formData.id) {
        // Nếu edit và không nhập pass thì xóa key password để giữ pass cũ
        if (!payload.password) delete payload.password;
        data = await apiService.put(`/users/${formData.id}`, payload);
      } else {
        data = await apiService.post('/users', payload);
      }
      
      if (data.success) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Lỗi lưu User: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc xoá user này?')) return;
    try {
      const data = await apiService.delete(`/users/${id}`);
      if (data.success) fetchUsers();
    } catch (error) {
      alert('Lỗi xóa.');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPass = prompt("Nhập mật khẩu mới cho user này (Mặc định: 123456):", "123456");
    if (newPass === null) return;
    
    try {
      const data = await apiService.put(`/users/${userId}`, { password: newPass });
      if (data.success) {
        alert("Reset mật khẩu thành công!");
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (e) {
      alert("Lỗi kết nối server.");
    }
  };

  // Case-insensitive check
  if (user?.role?.toUpperCase() !== 'ADMIN') {
    return (
       <div className="py-20 text-center">
         <Shield className="mx-auto w-16 h-16 text-rose-500 mb-4 opacity-50" />
         <h2 className="text-xl font-bold text-slate-800">Truy cập bị từ chối</h2>
         <p className="text-slate-500 mt-2">Tính năng Quản lý Nhân sự chỉ dành cho Admin.</p>
         <button onClick={() => window.location.href='/'} className="mt-6 text-indigo-600 font-bold hover:underline">Về Dashboard</button>
       </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="text-indigo-600" /> Quản lý Nhân sự
          </h1>
          <p className="text-sm text-slate-500 mt-1">Phân quyền tài khoản ADMIN / MANAGER và gán chi nhánh quản lý.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 active:scale-95"
        >
          <UserPlus size={18} /> Thêm Nhân sự mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : (
        <>
          {/* KPI Leaderboard */}
          {kpiData.length > 0 && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 mb-6 relative overflow-hidden">
               <div className="flex items-center gap-2 mb-6 z-10 relative">
                 <Award className="text-amber-500" size={24} />
                 <h2 className="text-lg font-black text-slate-800 tracking-tight">Bảng Xếp Hạng Manager (Tháng {new Date().getMonth() + 1})</h2>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                 {kpiData.slice(0, 3).map((kpi, index) => (
                   <div key={kpi._id} className="relative bg-slate-50/50 border border-slate-100 rounded-2xl p-5 hover:shadow-md transition-shadow">
                     {index === 0 && <div className="absolute -top-3 -right-3 w-10 h-10 bg-amber-400 text-amber-900 rounded-full flex items-center justify-center font-black shadow-lg border-2 border-white transform rotate-12"><Medal size={20} /></div>}
                     {index === 1 && <div className="absolute -top-3 -right-3 w-10 h-10 bg-slate-300 text-slate-800 rounded-full flex items-center justify-center font-black shadow-lg border-2 border-white transform rotate-12"><Medal size={20} /></div>}
                     {index === 2 && <div className="absolute -top-3 -right-3 w-10 h-10 bg-orange-300 text-orange-900 rounded-full flex items-center justify-center font-black shadow-lg border-2 border-white transform rotate-12"><Medal size={20} /></div>}
                     
                     <div className="flex items-center gap-3 mb-4">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border-2 border-white shadow-sm ${index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'}`}>
                         {index + 1}
                       </div>
                       <div>
                         <h4 className="font-bold text-slate-800">{kpi.username}</h4>
                         <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">Top {index + 1}</span>
                       </div>
                     </div>
                     
                     <div className="space-y-3">
                       <div>
                         <div className="flex justify-between text-xs mb-1 font-semibold text-slate-600">
                           <span>Giải quyết (Resolution)</span>
                           <span className="text-slate-900">{kpi.resolutionRate}%</span>
                         </div>
                         <div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${kpi.resolutionRate}%` }}></div></div>
                       </div>
                       <div>
                         <div className="flex justify-between text-xs mb-1 font-semibold text-slate-600">
                           <span>ART (Thời gian phản hồi)</span>
                           <span className="text-slate-900">{kpi.art} phút</span>
                         </div>
                         <div className="w-full bg-slate-200 rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (60 / kpi.art) * 100)}%` }}></div></div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
               
               {/* Background Gradients for Top 1 */}
               <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob"></div>
               <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-blob animation-delay-2000"></div>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                 <tr>
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nhân sự</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Quyền (Role)</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Chi nhánh Quản lý</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Trạng thái</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Thao tác</th>
                 </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {users.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center font-black border border-slate-200">
                              {u.username.charAt(0).toUpperCase()}
                           </div>
                           <span className="font-bold text-slate-800">{u.username}</span>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        {u.role?.toUpperCase() === 'ADMIN' ? (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 rounded-xl shadow-sm">
                              <Shield size={12} /> Admin
                           </span>
                        ) : (
                           <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl shadow-sm">
                              <Users size={12} /> Manager
                           </span>
                        )}
                     </td>
                     <td className="px-6 py-4">
                        {u.role?.toUpperCase() === 'ADMIN' ? (
                           <span className="text-xs font-bold text-slate-400 italic">Quản lý toàn bộ hệ thống</span>
                        ) : (
                           <div className="flex flex-wrap gap-2">
                             {(u.managedLocations || u.assignedLocations)?.length > 0 ? (
                                (u.managedLocations || u.assignedLocations).map(locId => {
                                   const locData = locations.find(l => l.locationId === locId);
                                   return (
                                      <span key={locId} className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 rounded-lg border border-slate-200">
                                         <MapPin size={10} className="text-slate-400" />
                                         {locData?.title || locId.split('/').pop()}
                                      </span>
                                   )
                                })
                             ) : (
                                <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100 uppercase tracking-tighter">Chưa gán</span>
                             )}
                           </div>
                        )}
                     </td>
                     <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase border border-emerald-100">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Đang hoạt động
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                           <button onClick={() => handleResetPassword(u._id)} title="Reset Mật khẩu nhanh"
                                   className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all">
                              <Zap size={18} />
                           </button>
                           <button onClick={() => handleOpenModal(u)} title="Sửa thông tin"
                                   className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                              <Edit2 size={18} />
                           </button>
                           {user?._id !== u._id && (
                             <button onClick={() => handleDelete(u._id)} title="Xóa tài khoản"
                                     className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                                <Trash2 size={18} />
                             </button>
                           )}
                        </div>
                     </td>
                  </tr>
               ))}
               {users.length === 0 && !loading && (
                 <tr>
                    <td colSpan="5" className="py-20 text-center text-slate-400 font-medium italic">Không có nhân sự nào trong danh sách.</td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Modal User Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <UserPlus size={20} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{formData.id ? 'Cập nhật Nhân sự' : 'Tạo Nhân sự mới'}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
               <div className="space-y-2">
                 <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Tên đăng nhập *</label>
                 <input 
                   type="text" 
                   value={formData.username} 
                   onChange={e => setFormData({...formData, username: e.target.value})}
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                   placeholder="Vd: admin_hanoi, manager01..."
                 />
               </div>
               
               <div className="space-y-2">
                 <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1">
                   Mật khẩu {formData.id && <span className="text-slate-400 normal-case">(Bỏ trống nếu không đổi)</span>}
                 </label>
                 <input 
                   type="password" 
                   value={formData.password} 
                   onChange={e => setFormData({...formData, password: e.target.value})}
                   className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                   placeholder="••••••••"
                 />
               </div>
               
               <div className="space-y-2">
                 <label className="block text-xs font-black text-slate-500 uppercase tracking-widest ml-1 pb-1">Chức vụ (Role)</label>
                 <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, role: 'MANAGER'})}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-sm transition-all ${
                        formData.role === 'MANAGER' 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                          : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <Users size={18} /> MANAGER
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, role: 'ADMIN'})}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-sm transition-all ${
                        formData.role === 'ADMIN' 
                          ? 'border-rose-500 bg-rose-50 text-rose-700' 
                          : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <Shield size={18} /> ADMIN
                    </button>
                 </div>
               </div>

               {formData.role === 'MANAGER' && (
                 <div className="space-y-3 pt-4 border-t border-slate-100">
                    <label className="block text-xs font-black text-indigo-600 uppercase tracking-widest ml-1">📍 Gán Chi nhánh Quản lý</label>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-1 gap-2">
                       {locations.map(loc => {
                         const isSelected = formData.managedLocations.includes(loc.locationId);
                         return (
                           <label 
                             key={loc.locationId} 
                             className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200'}`}
                             onClick={(e) => { e.preventDefault(); handleToggleLocation(loc.locationId); }}
                           >
                              <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 bg-white'}`}>
                                 {isSelected && <Check size={14} className="stroke-[4px]" />}
                              </div>
                              <div className="flex-1">
                                <p className={`text-sm font-black ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{loc.title}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-tighter opacity-70 italic">{loc.locationId}</p>
                              </div>
                           </label>
                         )
                       })}
                       {locations.length === 0 && <p className="text-xs text-slate-400 italic">Không tìm thấy chi nhánh nào hệ thống.</p>}
                    </div>
                 </div>
               )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 px-8">
               <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-sm font-black text-slate-500 hover:bg-slate-200 rounded-2xl transition-all">
                  Hủy bỏ
               </button>
               <button onClick={handleSaveUser} className="px-8 py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 active:scale-95">
                  <Check size={20} /> {formData.id ? 'Cập nhật ngay' : 'Tạo mới Nhân sự'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
