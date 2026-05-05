import { useState } from 'react';
import { 
  Book, 
  PlayCircle, 
  MessageSquare, 
  Settings, 
  ShieldCheck, 
  Zap, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  LifeBuoy
} from 'lucide-react';

const TutorialItem = ({ icon: Icon, title, content, videoUrl }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden transition-all hover:shadow-md">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Icon size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
            <p className="text-sm text-slate-400 font-medium">Click để xem chi tiết hướng dẫn</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="h-px bg-slate-100 mb-6" />
          <div className="prose prose-slate max-w-none text-slate-600 space-y-4">
            {content}
          </div>
          
          {videoUrl && (
            <div className="mt-6 aspect-video bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center relative group cursor-pointer overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop" 
                alt="Thumbnail" 
                className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-700"
              />
              <div className="z-10 flex flex-col items-center gap-2">
                <PlayCircle size={48} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest bg-white/80 backdrop-blur px-3 py-1 rounded-full border border-slate-200 shadow-sm">Xem Video Hướng Dẫn</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function TutorialsPage() {
  const tutorials = [
    {
      icon: Zap,
      title: "Bắt đầu nhanh (Quick Start)",
      videoUrl: "#",
      content: (
        <div className="space-y-3">
          <p>Chào mừng bạn đến với <b>MapManager</b>. Để bắt đầu quản lý chi nhánh của mình, hãy thực hiện theo 3 bước sau:</p>
          <ol className="list-decimal pl-5 space-y-2 font-medium">
            <li>Truy cập vào <b>Cài đặt</b> để kết nối tài khoản Google Business.</li>
            <li>Tại trang <b>Dashboard</b>, nhấn "Đồng bộ Review" để lấy dữ liệu mới nhất.</li>
            <li>Bật tính năng <b>Automation</b> để AI tự động phản hồi khách hàng 24/7.</li>
          </ol>
        </div>
      )
    },
    {
      icon: MessageSquare,
      title: "Cấu hình AI Phản hồi tự động",
      videoUrl: "#",
      content: (
        <div className="space-y-3">
          <p>Trang <b>Automation</b> cho phép bạn thiết lập các quy tắc phản hồi:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Master Toggle:</b> Bật/tắt toàn bộ hệ thống tự động trả lời.</li>
            <li><b>Delay (Độ trễ):</b> AI nên đợi bao lâu trước khi trả lời? Chúng tôi khuyên dùng 5-15 phút để tạo cảm giác tự nhiên như người thật.</li>
            <li><b>AI Reply (1-3 sao):</b> Với các review thấp điểm, AI sẽ cầu thị nhận lỗi và cung cấp Hotline hỗ trợ.</li>
          </ul>
        </div>
      )
    },
    {
      icon: ShieldCheck,
      title: "Hệ thống chống Spam (Anti-Sabotage)",
      videoUrl: "#",
      content: (
        <div className="space-y-3">
          <p>Để bảo vệ doanh nghiệp trước các đợt tấn công bẩn:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Hệ thống sẽ tự động quét mật độ review 1 sao từng giờ.</li>
            <li>Nếu phát hiện bất thường, bạn sẽ nhận được tin nhắn Telegram cảnh báo ngay lập tức.</li>
            <li>Bạn có thể dùng AI để soạn đơn khiếu nại (Dispute) bằng tiếng Anh để báo cáo Google xử lý nhanh hơn.</li>
          </ul>
        </div>
      )
    },
    {
      icon: Settings,
      title: "Quản lý nhân sự & Chi nhánh",
      content: (
        <div className="space-y-3">
          <p>Dành riêng cho <b>Admin</b>:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Bạn có thể tạo tài khoản cho các <b>Manager</b> (Quản lý vùng/chi nhánh).</li>
            <li>Chỉ định Manager được phép xem dữ liệu của chi nhánh nào để đảm bảo tính bảo mật và riêng tư giữa các cơ sở kinh doanh.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full text-sm font-bold border border-indigo-100 shadow-sm">
          <Book size={16} /> Trung tâm Hướng dẫn & Hỗ trợ
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Làm chủ MapManager trong 5 phút</h1>
        <p className="text-slate-500 max-w-xl mx-auto font-medium">Hệ thống của chúng tôi rất mạnh mẽ, hãy xem các hướng dẫn dưới đây để tối đa hóa hiệu quả quản trị chi nhánh.</p>
      </div>

      {/* Tutorial List */}
      <div className="space-y-4">
        {tutorials.map((t, i) => <TutorialItem key={i} {...t} />)}
      </div>

      {/* Support Section */}
      <div className="bg-slate-900 rounded-[32px] p-8 mt-12 text-center relative overflow-hidden group shadow-2xl shadow-indigo-900/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -mr-32 -mt-32 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/10 blur-[80px] -ml-32 -mb-32 rounded-full"></div>
        
        <div className="relative z-10 space-y-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
             <LifeBuoy size={32} className="text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Bạn cần hỗ trợ thêm?</h2>
            <p className="text-slate-400 mt-2 font-medium">Đội ngũ kỹ thuật của chúng tôi luôn sẵn sàng giải đáp thắc mắc của bạn qua Telegram/Zalo.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
             <a 
               href="https://t.me/your_telegram" 
               target="_blank" 
               className="w-full sm:w-auto px-8 py-3 bg-white text-slate-900 rounded-2xl font-bold shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
             >
                Chat với Kỹ thuật <ExternalLink size={16} />
             </a>
             <button className="w-full sm:w-auto px-8 py-3 bg-white/10 text-white rounded-2xl font-bold hover:bg-white/20 transition-all border border-white/20">
                Gửi yêu cầu qua Email
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
