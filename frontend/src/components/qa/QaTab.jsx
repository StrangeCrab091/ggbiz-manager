import { useState, useEffect } from 'react';
import { Loader2, MessageSquare, Bot, Check, ArrowRight } from 'lucide-react';
import apiService from '../../services/apiService';
import { useOutletContext } from 'react-router-dom';

export default function QaTab() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(null);
  
  const context = useOutletContext();
  const selectedLocationId = context?.selectedLocationId;

  useEffect(() => {
    if (!selectedLocationId) return;
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const data = await apiService.get(`/qa?locationId=${selectedLocationId}`);
        if (data.success) {
          setQuestions(data.data);
        }
      } catch (error) {
        console.error('Lỗi khi fetch câu hỏi:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [selectedLocationId]);

  const handleSuggest = async (q) => {
    try {
      setGeneratingFor(q.questionId);
      const data = await apiService.post('/qa/suggest', { questionId: q.questionId, text: q.text });
      if (data.success) {
        setQuestions(prev => prev.map(item => 
          item.questionId === q.questionId ? { ...item, draftAnswer: data.data.answerText } : item
        ));
      }
    } catch (error) {
       console.error(error);
       alert('Không thể tạo gợi ý AI');
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleSubmit = async (q) => {
    if (!q.draftAnswer) return;
    try {
      const data = await apiService.post('/qa/answer', { questionId: q.questionId, answerText: q.draftAnswer });
      if (data.success) {
        setQuestions(prev => prev.map(item => 
          item.questionId === q.questionId 
            ? { ...item, isAnswered: true, answerText: q.draftAnswer, status: 'Answered' } 
            : item
        ));
        alert('Đã duyệt và đăng câu trả lời!');
      }
    } catch (e) {
      alert('Lỗi khi duyệt đăng');
    }
  };

  if (!selectedLocationId) return <div className="p-6 text-center text-slate-500">Vui lòng chọn chi nhánh</div>;

  return (
    <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="text-indigo-600" /> Quản lý Hỏi & Đáp
        </h2>
        <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">
          {questions.length} câu hỏi
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
      ) : questions.length === 0 ? (
        <div className="p-10 text-center text-slate-500 font-medium">Chưa có câu hỏi nào từ khách hàng.</div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.questionId} className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 transition-colors">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 flex items-center justify-center rounded-full font-bold shadow-inner">
                  {q.authorName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{q.authorName}</h4>
                  <p className="text-slate-600 mt-1">{q.text}</p>
                  <span className="text-xs font-medium text-slate-400 mt-2 block">
                    {new Date(q.createTime).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              {q.isAnswered ? (
                <div className="ml-14 bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800 text-sm">
                   <div className="font-bold mb-1 flex items-center gap-1.5"><Check size={14}/> Đã trả lời</div>
                   {q.answerText}
                </div>
              ) : q.draftAnswer ? (
                <div className="ml-14 bg-indigo-50 border border-indigo-100 p-4 rounded-xl relative group">
                  <div className="font-bold text-indigo-800 mb-2 flex items-center gap-2 text-sm">
                    <Bot size={16}/> Khuyến nghị từ AI
                  </div>
                  <textarea 
                    className="w-full text-sm p-3 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    rows={3}
                    value={q.draftAnswer}
                    onChange={(e) => setQuestions(prev => prev.map(item => item.questionId === q.questionId ? { ...item, draftAnswer: e.target.value } : item))}
                  />
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleSubmit(q)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 tracking-wide shadow-md transition-all">
                      <ArrowRight size={16}/> Duyệt & Đăng lên Maps
                    </button>
                    <button onClick={() => handleSuggest(q)} className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                      Tạo lại
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ml-14 mt-4">
                   <button 
                     onClick={() => handleSuggest(q)}
                     disabled={generatingFor === q.questionId}
                     className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border border-indigo-100"
                   >
                     {generatingFor === q.questionId ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                     AI Gợi ý trả lời
                   </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
