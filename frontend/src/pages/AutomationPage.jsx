import { useState, useEffect } from 'react';
import { Bot, Zap, Plus, Loader2, Star, MessageCircle, Clock, CheckCircle2, X, Pencil } from 'lucide-react';
import { Tooltip } from '../components/common/Tooltip';
import apiService from '../services/apiService';

export default function AutomationPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    minStars: 1,
    maxStars: 5,
    conditionHasText: 'both',
    delayMinutes: 5,
    aiPrompt: '',
    isActive: true
  });
  const [editingRuleId, setEditingRuleId] = useState(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await apiService.get('/automation');
      if (data.success) {
        setRules(data.data);
      }
    } catch (error) {
      console.error('Lỗi khi fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const toggleRule = async (id, currentStatus) => {
    try {
      const data = await apiService.put(`/automation/${id}`, { isActive: !currentStatus });
      if (data.success) {
        setRules(rules.map(r => r._id === id ? data.data : r));
      }
    } catch (error) {
      console.error('Lỗi khi toggle rule:', error);
    }
  };

  const deleteRule = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa quy tắc này?')) return;
    try {
      const data = await apiService.delete(`/automation/${id}`);
      if (data.success) {
        setRules(rules.filter(r => r._id !== id));
      }
    } catch (error) {
      console.error('Lỗi khi xóa quy tắc:', error);
    }
  };

  const handleSubmitRule = async (e) => {
    e.preventDefault();
    try {
      if (editingRuleId) {
        const data = await apiService.put(`/automation/${editingRuleId}`, newRule);
        if (data.success) {
          setRules(rules.map(r => r._id === editingRuleId ? data.data : r));
          closeModal();
        }
      } else {
        const data = await apiService.post('/automation', newRule);
        if (data.success) {
          setRules([data.data, ...rules]);
          closeModal();
        }
      }
    } catch (error) {
      console.error('Lỗi khi lưu quy tắc:', error);
    }
  };

  const handleEditRule = (rule) => {
    setEditingRuleId(rule._id);
    setNewRule({
      name: rule.name,
      minStars: rule.minStars,
      maxStars: rule.maxStars,
      conditionHasText: rule.conditionHasText,
      delayMinutes: rule.delayMinutes,
      aiPrompt: rule.aiPrompt || '',
      isActive: rule.isActive
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRuleId(null);
    setNewRule({
      name: '',
      minStars: 1,
      maxStars: 5,
      conditionHasText: 'both',
      delayMinutes: 5,
      aiPrompt: '',
      isActive: true
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bot className="text-indigo-600" /> Tự động hóa (Auto-Pilot)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý các quy tắc AI tự động phản hồi đánh giá khách hàng.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
        >
          <Plus size={18} /> Thêm quy tắc
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="text-slate-500 font-bold">Đang tải danh sách quy tắc...</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200/60 shadow-sm text-center px-6">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Chưa có quy tắc nào</h2>
          <p className="text-sm text-slate-500 mb-8 max-w-sm">
            Hệ thống Auto-Pilot đang trống. Hãy thêm một quy tắc để AI bắt đầu chăm sóc khách hàng giúp bạn.
          </p>
          <button 
            onClick={() => setShowModal(true)}
            className="text-indigo-600 font-bold hover:underline"
          >
            Bấm vào đây để tạo quy tắc đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {rules.map((rule) => (
            <div key={rule._id} className={`bg-white border transition-all duration-300 rounded-3xl p-6 shadow-sm hover:shadow-md ${rule.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${rule.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    <Zap size={20} fill={rule.isActive ? 'currentColor' : 'none'} className={rule.isActive ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{rule.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex text-amber-400 text-[10px]">
                        {'★'.repeat(rule.minStars)}{'☆'.repeat(5-rule.minStars)}
                      </div>
                      <span className="text-slate-400 text-[10px] font-bold">TỚI</span>
                      <div className="flex text-amber-400 text-[10px]">
                        {'★'.repeat(rule.maxStars)}{'☆'.repeat(5-rule.maxStars)}
                      </div>
                    </div>
                  </div>
                </div>
                <div 
                  onClick={() => toggleRule(rule._id, rule.isActive)}
                  className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center ${rule.isActive ? 'bg-indigo-600 border-indigo-700' : 'bg-slate-200 border-slate-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${rule.isActive ? 'translate-x-6' : ''}`} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <MessageCircle size={10} /> Điều kiện <Tooltip text="Chỉ áp dụng quy tắc này khi review thỏa mãn có hoặc không có nội dung văn bản" />
                  </p>
                  <p className="text-xs font-bold text-slate-700">
                    {rule.conditionHasText === 'both' ? 'Có hoặc không lời nhắn' : 
                     rule.conditionHasText === 'has_text' ? 'Chỉ khi có lời nhắn' : 'Chỉ đánh giá sao'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Clock size={10} /> Thời gian chờ <Tooltip text="Khoảng thời gian AI chờ trước khi tự động phản hồi để trông giống người thật nhất" />
                  </p>
                  <p className="text-xs font-bold text-slate-700">{rule.delayMinutes} phút</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-emerald-500 shadow-sm animate-pulse' : 'bg-slate-300'}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                    {rule.isActive ? 'Đang hoạt động' : 'Đang tạm dừng'}
                  </span>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => handleEditRule(rule)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors uppercase flex items-center gap-1"
                  >
                    <Pencil size={12} /> Chỉnh sửa
                  </button>
                  <button 
                    onClick={() => deleteRule(rule._id)}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase"
                  >
                    Xóa quy tắc
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal - Smooth Transition */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-0">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={closeModal} />
          <form 
            onSubmit={handleSubmitRule}
            className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white">
                  <Zap size={20} fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{editingRuleId ? 'Chỉnh sửa Quy tắc' : 'Thêm Quy tắc Mới'}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Automation Setting</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Tên quy tắc</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ví dụ: Tự động cảm ơn 5 sao..."
                  value={newRule.name}
                  onChange={e => setNewRule({...newRule, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Sao tối thiểu (Min)</label>
                  <select 
                    value={newRule.minStars}
                    onChange={e => setNewRule({...newRule, minStars: parseInt(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    {[1,2,3,4,5].map(s => <option key={s} value={s}>{s} Sao</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Sao tối đa (Max)</label>
                  <select 
                    value={newRule.maxStars}
                    onChange={e => setNewRule({...newRule, maxStars: parseInt(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    {[1,2,3,4,5].map(s => <option key={s} value={s}>{s} Sao</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Điều kiện Text</label>
                  <select 
                    value={newRule.conditionHasText}
                    onChange={e => setNewRule({...newRule, conditionHasText: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                  >
                    <option value="both">Tất cả</option>
                    <option value="has_text">Có nội dung</option>
                    <option value="no_text">Không nội dung</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Delay (Phút) <Tooltip text="0 = Phản hồi ngay lập tức, >0 = Đợi X phút mới phản hồi" /></label>
                  <input 
                    type="number" 
                    min="0"
                    required
                    value={newRule.delayMinutes}
                    onChange={e => setNewRule({...newRule, delayMinutes: parseInt(e.target.value)})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">Hướng dẫn AI (Prompt) <Tooltip text="Mô tả phong cách AI: Ví dụ 'Hãy trả lời thân thiện, mời họ quay lại và tặng mã giảm giá'" /></label>
                <textarea 
                  rows="3"
                  placeholder="Nhập hướng dẫn cụ thể cho AI khi gặp trường hợp này..."
                  value={newRule.aiPrompt}
                  onChange={e => setNewRule({...newRule, aiPrompt: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-y"
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-3">
              <button 
                type="button" 
                onClick={closeModal}
                className="flex-1 px-4 py-3.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3.5 rounded-2xl text-sm font-black shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> {editingRuleId ? 'Cập nhật' : 'Lưu Quy tắc'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
