import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { Youtube, Search, Loader2, MessageSquare, Users, ThumbsUp, ThumbsDown, AlertCircle, Info, History, Trash2, Clock, Home, Cpu, Terminal, Database, Activity, Zap, Image as ImageIcon, Download, Film, ExternalLink, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Types for the generated data
interface Comment {
  username: string;
  text: string;
  type: string;
  likes: number;
  timeAgo: string;
}

interface Segment {
  segmentName: string;
  segmentDescription: string;
  comments: Comment[];
}

interface AnalysisResult {
  videoTitle: string;
  videoSummary: string;
  videoAnalysis: string;
  usedTranscript: boolean;
  usedAudio?: boolean;
  segments: Segment[];
}

interface HistoryItem extends AnalysisResult {
  id: string;
  url: string;
  timestamp: number;
}

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [commentCount, setCommentCount] = useState<number>(10);
  const [commentLength, setCommentLength] = useState<'short' | 'medium' | 'long' | 'mixed'>('mixed');
  const [commentTone, setCommentTone] = useState<'neutral' | 'enthusiastic' | 'critical' | 'humorous' | 'questioning' | 'loyal' | 'happy' | 'sad' | 'angry' | 'surprised' | 'mixed'>('mixed');
  const [loading, setLoading] = useState(false);
  const [extractingAudio, setExtractingAudio] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | HistoryItem | null>(null);
  const [activeSegment, setActiveSegment] = useState<number>(0);
  const [view, setView] = useState<'home' | 'history' | 'thumbnail' | 'video'>('home');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [thumbUrlInput, setThumbUrlInput] = useState('');
  const [currentThumbId, setCurrentThumbId] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [resolution, setResolution] = useState<'360' | '720' | '1080'>('1080');
  const [showWidget, setShowWidget] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleShare = async (title: string, text: string, shareUrl: string) => {
    const shareData = {
      title,
      text,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback to clipboard
        const clipboardText = `${title}\n\n${text}\n\nLink: ${shareUrl}`;
        await navigator.clipboard.writeText(clipboardText);
        showToast('Đã sao chép vào clipboard!');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Lỗi chia sẻ:', err);
        showToast('Không thể chia sẻ. Vui lòng thử lại.');
      }
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setLoadingTime(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    setShowWidget(false);
  }, [videoUrlInput, resolution]);

  useEffect(() => {
    const saved = localStorage.getItem('yt_analyzer_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const saveToHistory = (data: AnalysisResult, videoUrl: string) => {
    const newItem: HistoryItem = {
      ...data,
      id: Date.now().toString(),
      url: videoUrl,
      timestamp: Date.now(),
    };
    const newHistory = [newItem, ...history];
    setHistory(newHistory);
    localStorage.setItem('yt_analyzer_history', JSON.stringify(newHistory));
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setUrl(item.url);
    setResult(item);
    setActiveSegment(0);
    setView('home');
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem('yt_analyzer_history', JSON.stringify(newHistory));
    if (result && 'id' in result && (result as HistoryItem).id === id) {
      setResult(null);
    }
  };

  const analyzeVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const videoId = extractYouTubeId(url);
      const normalizedUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;

      let exactTitle = "";
      let exactAuthor = "";
      let videoDescription = "";
      let videoComments = "";
      
      try {
        const contextRes = await fetch(`/api/video-context?url=${encodeURIComponent(normalizedUrl)}`);
        if (contextRes.ok) {
          const contextData = await contextRes.json();
          if (contextData.title) exactTitle = contextData.title;
          if (contextData.author) exactAuthor = contextData.author;
          if (contextData.description) videoDescription = contextData.description;
          if (contextData.comments) videoComments = contextData.comments;
        }
      } catch (e) {
        console.warn("Failed to fetch video context", e);
      }

      // Fallback to noembed if context fetching failed
      if (!exactTitle) {
        try {
          const noembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(normalizedUrl)}`);
          if (noembedRes.ok) {
            const data = await noembedRes.json();
            if (data.title) exactTitle = data.title;
            if (data.author_name) exactAuthor = data.author_name;
          }
        } catch (e) {
          console.warn("Failed to fetch video metadata from noembed", e);
        }
      }

      let transcriptText = "";
      let audioFileUri = "";
      let audioMimeType = "";
      
      try {
        const transcriptRes = await fetch(`/api/transcript?url=${encodeURIComponent(normalizedUrl)}`);
        if (transcriptRes.ok) {
          const data = await transcriptRes.json();
          if (data.transcript && Array.isArray(data.transcript)) {
            transcriptText = data.transcript.map((t: any) => t.text).join(" ");
          }
        }
      } catch (e) {
        console.warn("Failed to fetch transcript from backend", e);
      }

      // If no transcript, try to extract audio
      if (!transcriptText) {
        setExtractingAudio(true);
        try {
          const audioRes = await fetch(`/api/audio-extract?url=${encodeURIComponent(normalizedUrl)}`);
          if (audioRes.ok) {
            const audioData = await audioRes.json();
            if (audioData.fileUri) {
              audioFileUri = audioData.fileUri;
              audioMimeType = audioData.mimeType;
            }
          } else {
            console.warn("Audio extraction blocked by YouTube anti-bot protection. Falling back to context analysis.");
          }
        } catch (e) {
          console.warn("Failed to extract audio:", e);
        } finally {
          setExtractingAudio(false);
        }
      }

      const lengthInstruction = commentLength === 'short' ? 'NGẮN GỌN (1-2 câu)' :
                                commentLength === 'medium' ? 'VỪA PHẢI (2-4 câu)' :
                                commentLength === 'long' ? 'CHI TIẾT, DÀI DÒNG (4+ câu)' :
                                'ĐA DẠNG (có cả ngắn, vừa, dài)';

      const toneInstruction = commentTone === 'neutral' ? 'TRUNG LẬP, KHÁCH QUAN' :
                              commentTone === 'enthusiastic' ? 'HÀO HỨNG, TÍCH CỰC (Fomo, hô múc, khen ngợi)' :
                              commentTone === 'critical' ? 'PHẢN BIỆN, TIÊU CỰC (Chim lợn, chê bai, nghi ngờ)' :
                              commentTone === 'humorous' ? 'HÀI HƯỚC, CHÂM BIẾM (Troll, cà khịa)' :
                              commentTone === 'questioning' ? 'TÒ MÒ, HỎI ĐÁP (Xin lời khuyên, thắc mắc)' :
                              commentTone === 'loyal' ? 'FAN CỨNG, TRUNG THÀNH (Luôn ủng hộ, nhắc lại các nhận định đúng trong quá khứ của kênh, biết rõ phong cách của tác giả)' :
                              commentTone === 'happy' ? 'VUI VẺ, LẠC QUAN (Phấn khởi, khoe lãi, tin tưởng thị trường)' :
                              commentTone === 'sad' ? 'BUỒN BÃ, BI QUAN (Than vãn, chán nản, than lỗ, mất niềm tin)' :
                              commentTone === 'angry' ? 'TỨC GIẬN, BỨC XÚC (Chửi bới lái, bực tức vì thị trường sập hoặc lỡ sóng)' :
                              commentTone === 'surprised' ? 'NGẠC NHIÊN, BẤT NGỜ (Sốc vì thị trường biến động mạnh, không tin vào mắt mình)' :
                              'ĐA DẠNG (Có đủ các sắc thái: khen, chê, hỏi, troll...)';

      const currentDateTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const prompt = `
Bạn là một chuyên gia phân tích nội dung video, đặc biệt là các video TƯ VẤN CHỨNG KHOÁN, TÀI CHÍNH (thị trường chứng khoán Việt Nam - VNINDEX, các mã cổ phiếu).
Nhiệm vụ của bạn là phân tích SÂU VÀ CHI TIẾT CHÍNH XÁC video YouTube từ đường link được cung cấp, sau đó tạo ra các bình luận y hệt như NGƯỜI DÙNG THẬT trên YouTube. TUYỆT ĐỐI KHÔNG được để lộ dấu vết của AI hay văn phong "seeding" giả tạo.

THỜI GIAN HIỆN TẠI (LÚC ĐANG TẠO BÌNH LUẬN): ${currentDateTime}
LƯU Ý TỐI QUAN TRỌNG VỀ THỜI GIAN: Các bình luận BẮT BUỘC phải khớp với bối cảnh của THỜI GIAN HIỆN TẠI. Nếu video được đăng trong quá khứ (ví dụ: video đăng hôm qua, tuần trước), bình luận phải thể hiện góc nhìn của người xem ở thời điểm HIỆN TẠI (${currentDateTime}), đối chiếu nhận định của tác giả với diễn biến thị trường đã thực sự xảy ra từ lúc đăng video đến nay.

THÔNG TIN BẮT BUỘC CỦA VIDEO CHÍNH:
- Link video: ${normalizedUrl} ${videoId ? `(Video ID: ${videoId})` : ''}
${exactTitle ? `- Tiêu đề chính xác: "${exactTitle}"` : ''}
${exactAuthor ? `- Kênh đăng tải: "${exactAuthor}"` : ''}

${videoDescription ? `MÔ TẢ VIDEO (DESCRIPTION):\n"""\n${videoDescription}\n"""\n` : ''}
${videoComments ? `CÁC BÌNH LUẬN HIỆN TẠI TRÊN VIDEO (ĐỂ THAM KHẢO QUAN ĐIỂM KHÁN GIẢ):\n"""\n${videoComments}\n"""\n` : ''}

${transcriptText ? `NỘI DUNG PHỤ ĐỀ (TRANSCRIPT) CỦA VIDEO:\n"""\n${transcriptText}\n"""\n\nLỆNH TỐI CAO: BẠN BẮT BUỘC PHẢI ĐỌC KỸ PHỤ ĐỀ NÀY. Đây là lời nói thực tế của tác giả. Bạn phải trích xuất CHÍNH XÁC quan điểm của họ (Hô tăng hay giảm? Khuyên mua hay bán mã nào? Lý do là gì?). TUYỆT ĐỐI KHÔNG ĐƯỢC ĐOÁN MÒ DỰA VÀO TIÊU ĐỀ.\n` : audioFileUri ? `LỆNH TỐI CAO: BẠN VỪA ĐƯỢC CUNG CẤP FILE ÂM THANH CỦA VIDEO NÀY. BẠN BẮT BUỘC PHẢI NGHE KỸ FILE ÂM THANH NÀY ĐỂ PHÂN TÍCH. Đây là lời nói thực tế của tác giả. Bạn phải trích xuất CHÍNH XÁC quan điểm của họ (Hô tăng hay giảm? Khuyên mua hay bán mã nào? Lý do là gì?). TUYỆT ĐỐI KHÔNG ĐƯỢC ĐOÁN MÒ DỰA VÀO TIÊU ĐỀ.\n` : `CẢNH BÁO: KHÔNG CÓ PHỤ ĐỀ VÀ KHÔNG THỂ LẤY ÂM THANH CHO VIDEO NÀY (Có thể do đây là livestream hoặc tác giả tắt phụ đề).\nLỆNH TỐI CAO: Vì không có phụ đề, bạn KHÔNG ĐƯỢC TỰ Ý ĐOÁN MÒ quan điểm của tác giả chỉ dựa vào tiêu đề (thường là clickbait). Bạn BẮT BUỘC phải:\n1. ĐỌC KỸ CÁC BÌNH LUẬN (Comments) đã được cung cấp ở trên. Khán giả thường sẽ tóm tắt lại hoặc phản biện lại quan điểm của tác giả trong bình luận (VD: "Sao ad lại hô bán HPG lúc này", "Đồng ý với ad là thị trường sẽ sập"). Đây là manh mối quan trọng nhất để biết tác giả đã nói gì trong video.\n2. Kết hợp với phần MÔ TẢ (Description) để suy luận chính xác quan điểm của tác giả.\n3. Dùng googleSearch để tìm kiếm các bài viết, nhận định gần nhất của kênh "${exactAuthor}" hoặc về chủ đề "${exactTitle}".\n4. Nếu vẫn không chắc chắn, hãy phân tích dựa trên bối cảnh thị trường thực tế kết hợp với tiêu đề, nhưng phải giữ thái độ khách quan và ghi rõ trong phân tích là dựa trên suy luận.\n`}

CẢNH BÁO TỐI QUAN TRỌNG VÀ NGHIÊM TRỌNG NHẤT:
1. NGUY CƠ NHẦM LẪN CAO: Khi bạn sử dụng công cụ để đọc trang YouTube, trang web sẽ chứa rất nhiều tiêu đề của "Video đề xuất" (Related videos) từ các kênh khác. BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC NHẦM LẪN VÀ LẤY NỘI DUNG CỦA CÁC VIDEO ĐỀ XUẤT NÀY.
2. ${exactTitle ? `Bạn CHỈ ĐƯỢC PHÉP phân tích video có đúng tiêu đề là "${exactTitle}" của kênh "${exactAuthor}".` : 'Bạn phải xác định đúng video chính đang được phát.'}
3. CHỈ trả về "ERROR_NOT_FOUND" ở trường videoTitle NẾU video thực sự bị xóa, private, hoặc link hỏng. KHÔNG ĐƯỢC lấy râu ông nọ cắm cằm bà kia.
4. ĐẶC BIỆT LƯU Ý VỚI TIÊU ĐỀ DẠNG CÂU HỎI HOẶC TRÍCH DẪN: Nếu tiêu đề có dấu ngoặc kép hoặc dấu hỏi chấm (VD: "Mấy đứa tích cực là do đang kẹp hàng ?"), rất có thể tác giả đang TRÍCH DẪN lại lời của người khác để PHẢN BIỆN hoặc CHÂM BIẾM. Đừng vội kết luận tác giả đồng tình với câu nói đó. Trong chứng khoán, "người cầm tiền" thường châm chọc "người cầm hàng" (kẹp hàng) khi thị trường giảm. Nếu tác giả lấy câu châm chọc đó làm tiêu đề, RẤT CÓ THỂ tác giả đang đứng về phe "người cầm hàng" (cho rằng thị trường đã giảm đủ sâu, không nên bán nữa, hoặc chuẩn bị tạo đáy - tức là BULLISH/LẠC QUAN). Hãy phân tích thật kỹ tâm lý ngược này. Cần tìm bằng chứng trong phụ đề, âm thanh hoặc bình luận để xem tác giả thực sự đang bảo vệ phe nào. NẾU BÌNH LUẬN CÓ NHIỀU NGƯỜI VÀO CHÊ BAI, CHÂM BIẾM TÁC GIẢ (VD: "Nói trúng tim đen", "Đúng là kẹp hàng thật"), ĐIỀU ĐÓ CÀNG CHỨNG TỎ TÁC GIẢ ĐANG ĐỨNG Ở PHE NGƯỢC LẠI VỚI HỌ (Tức là tác giả đang LẠC QUAN/BULLISH, khuyên giữ hàng, còn khán giả thì đang BI QUAN/BEARISH). BẠN PHẢI PHÂN TÍCH RA ĐƯỢC SỰ ĐỐI LẬP NÀY.

QUY TRÌNH THỰC HIỆN BẮT BUỘC (ĐẶC BIỆT CHO VIDEO CHỨNG KHOÁN):
BƯỚC 1 - XÁC ĐỊNH MÃ CỔ PHIẾU & THỊ TRƯỜNG: Xác định xem video đang nói về VNINDEX hay các mã cổ phiếu cụ thể nào (VD: HPG, SSI, VCB, NVL...).
BƯỚC 2 - TRA CỨU THÔNG TIN THỰC TẾ & XU HƯỚNG (TRENDING) TẠI THỜI ĐIỂM HIỆN TẠI (BẮT BUỘC): BẠN PHẢI SỬ DỤNG CÔNG CỤ TÌM KIẾM (googleSearch) ĐỂ TRA CỨU NGAY LẬP TỨC:
   - Biến động giá mới nhất, chính xác nhất của VNINDEX và các mã cổ phiếu được nhắc đến trong video tính đến thời điểm HIỆN TẠI (${currentDateTime}).
   - Các tin tức vĩ mô, tin tức doanh nghiệp mới nhất liên quan đến các mã cổ phiếu đó.
   - CÁC CHỦ ĐỀ ĐANG THỊNH HÀNH (TRENDING TOPICS): Tìm kiếm các sự kiện nóng, xu hướng dòng tiền, chính sách vĩ mô mới nhất (VD: lãi suất Fed, giá vàng, tỷ giá, tin đồn, sự kiện thế giới...) có liên quan hoặc đang tác động mạnh đến tâm lý nhà đầu tư lúc này.
   - TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT SỐ LIỆU (HALLUCINATE). Phải lấy số liệu thực tế từ thị trường hiện tại.
BƯỚC 3 - TỔNG HỢP QUAN ĐIỂM & KẾT LUẬN: Phân tích toàn bộ nội dung video để rút ra QUAN ĐIỂM CHÍNH của tác giả (VD: hô sập, hô múc, khuyên giữ hàng, khuyên cắt lỗ...). Phải chỉ rõ tác giả đang Bullish (lạc quan) hay Bearish (bi quan).
BƯỚC 4 - TẠO BÌNH LUẬN ĐỐI CHIẾU THỜI GIAN THỰC & BẮT TREND: Tạo bình luận phản hồi trực tiếp vào nhận định của tác giả, NHƯNG PHẢI LỒNG GHÉP SỐ LIỆU THỰC TẾ, BỐI CẢNH THỜI GIAN HIỆN TẠI VÀ CÁC CHỦ ĐỀ ĐANG HOT. (VD: "Video từ đầu tuần hô múc mà nay thứ 5 sập lòi sàn r ad ơi", "Tỷ giá đang căng thế này mà ad vẫn hô múc à", "Đang trend AI mà múc mấy con bất động sản làm gì ae").

YÊU CẦU VỀ BÌNH LUẬN (ĐẬM CHẤT CHỨNG SĨ VIỆT NAM VÀ CỰC KỲ CHÂN THỰC):
1. LỒNG GHÉP THÔNG TIN THỰC TẾ HIỆN TẠI & XU HƯỚNG: Bình luận phải nhắc đến giá cổ phiếu hiện tại, tin tức mới ra, điểm số VNINDEX hiện tại, HOẶC CÁC SỰ KIỆN/CHỦ ĐỀ ĐANG HOT (Trending) để chứng minh tính thời sự. Phải có sự so sánh giữa lúc video ra mắt và hiện tại nếu có biến động lớn.
2. NGÔN NGỮ CHUYÊN NGÀNH & LÓNG: Sử dụng từ lóng chứng khoán một cách TỰ NHIÊN, KHÔNG LẠM DỤNG: "bắt đáy", "đu đỉnh", "cắt lỗ", "chốt lời", "kéo xả", "lái lợn", "úp sọt", "bulltrap", "bear trap", "nổ vol", "break nền", "tây lông", "nhỏ lẻ", "f0", "full margin", "cháy tài khoản", "về bờ", "gồng lãi", "gồng lỗ", "chim lợn", "bìm bịp"...
3. ĐA DẠNG THỂ LOẠI & QUAN ĐIỂM: Các phân khúc khán giả phải đa dạng và tự nhiên như: Fan cứng, Người đồng tình, Người phản biện/hoài nghi, Người qua đường, Người mới tìm hiểu (F0), v.v.
4. SỐ LƯỢNG: BẮT BUỘC tạo TỐI THIỂU 5 phân khúc khán giả khác nhau, mỗi phân khúc khoảng ${commentCount} bình luận.
5. ĐỘ DÀI BÌNH LUẬN: BẮT BUỘC viết các bình luận với độ dài ${lengthInstruction}.
6. NGỮ ĐIỆU & BIỂU CẢM: BẮT BUỘC thể hiện ngữ điệu ${toneInstruction} trong các bình luận. (Lưu ý: Dù ngữ điệu chung là gì, vẫn phải chia thành các phân khúc khán giả khác nhau cho phù hợp).
7. ĐỘ CHÂN THỰC TỐI ĐA (QUAN TRỌNG NHẤT): Giọng văn phải CỰC KỲ TỰ NHIÊN, giống hệt người thật đang gõ phím trên điện thoại. BẮT BUỘC phải có các đặc điểm sau:
   - Sử dụng từ viết tắt phổ biến của người Việt: ko, k, dc, đk, r, rùi, rứa, ntn, v, z, ad, sếp, bác, thớt, ae, mng...
   - Cố tình viết sai chính tả nhẹ, không viết hoa chữ cái đầu câu, thiếu dấu chấm câu, hoặc dùng nhiều dấu chấm than/hỏi liên tiếp (!!!, ???, ...).
   - Câu cú có thể lủng củng, cụt lủn, cảm xúc bộc phát (VD: "đỉnh quá ad ơi", "sập rùi chạy ngay đi ae", "hpg hnay sao bác").
   - TUYỆT ĐỐI KHÔNG viết văn phong quá lịch sự, cấu trúc quá hoàn hảo, ngữ pháp chuẩn chỉnh như robot hay bài văn mẫu.
   - Tránh việc bình luận nào cũng có cấu trúc giống nhau. Có người chỉ comment 3 chữ, có người comment 1 đoạn dài không có dấu phẩy.
`;

      const contents: any[] = [{ text: prompt }];
      if (audioFileUri) {
        contents.unshift({
          fileData: {
            fileUri: audioFileUri,
            mimeType: audioMimeType
          }
        });
      }

        model: 'gemini-3.1-pro-preview',
        contents: contents,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              videoTitle: { type: Type.STRING, description: "Tên chính xác của video (Hoặc 'ERROR_NOT_FOUND' nếu không tìm thấy)" },
              videoAnalysis: { type: Type.STRING, description: "Phân tích sâu quan điểm chính, thông điệp cốt lõi và kết luận tổng thể của toàn bộ video..." },
              videoSummary: { type: Type.STRING, description: "Tóm tắt ngắn gọn nội dung video" },
              usedTranscript: { type: Type.BOOLEAN, description: "Trả về true nếu bạn được cung cấp NỘI DUNG PHỤ ĐỀ (TRANSCRIPT) trong prompt, ngược lại false" },
              usedAudio: { type: Type.BOOLEAN, description: "Trả về true nếu bạn được cung cấp FILE ÂM THANH trong prompt, ngược lại false" },
              segments: {
                type: Type.ARRAY,
                description: "Danh sách TỐI THIỂU 5 phân khúc người xem",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    segmentName: { type: Type.STRING, description: "Tên phân khúc (VD: Fan cứng, Kẻ hoài nghi, Người qua đường...)" },
                    segmentDescription: { type: Type.STRING, description: "Mô tả đặc điểm của phân khúc này" },
                    comments: {
                      type: Type.ARRAY,
                      description: `Danh sách khoảng ${commentCount} bình luận cho phân khúc này`,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          username: { type: Type.STRING, description: "Tên người dùng ngẫu nhiên, kiểu Việt Nam (VD: tuan_anh_99, Hoa Hồng Gai, user-xyz...)" },
                          text: { type: Type.STRING, description: "Nội dung bình luận cực kỳ chân thật, phản hồi trực tiếp vào quan điểm và kết luận tổng thể của video, đa dạng giọng văn..." },
                          type: { type: Type.STRING, description: "Loại bình luận (VD: Tranh luận, Đồng tình, Phản bác, Hỏi đáp, Lạc đề...)" },
                          likes: { type: Type.INTEGER, description: "Số lượt thích ngẫu nhiên (0 - 5000)" },
                          timeAgo: { type: Type.STRING, description: "Thời gian đăng (VD: 2 giờ trước, 1 ngày trước...)" }
                        },
                        required: ["username", "text", "type", "likes", "timeAgo"]
                      }
                    }
                  },
                  required: ["segmentName", "segmentDescription", "comments"]
                }
              }
            },
            required: ["videoTitle", "videoSummary", "videoAnalysis", "usedTranscript", "usedAudio", "segments"]
          },
          tools: [{ googleSearch: {} }, { urlContext: {} }],
          toolConfig: { includeServerSideToolInvocations: true }
        },
      });

      const jsonStr = response.text?.trim();
      if (jsonStr) {
        const parsedData = JSON.parse(jsonStr) as AnalysisResult;
        
        if (parsedData.videoTitle === "ERROR_NOT_FOUND") {
          throw new Error("Hệ thống AI không thể truy cập hoặc tìm thấy thông tin về video này. Vui lòng kiểm tra lại link (đảm bảo video không bị giới hạn độ tuổi, riêng tư, sai link, hoặc là livestream chưa kết thúc).");
        }

        setResult(parsedData);
        setActiveSegment(0);
        saveToHistory(parsedData, url);
      } else {
        throw new Error("Không nhận được dữ liệu phản hồi.");
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      
      let errorMessage = err.message || "Đã xảy ra lỗi trong quá trình phân tích. Vui lòng thử lại.";
      
      // Catch Gemini API Quota Exceeded error
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("exceeded your current quota")) {
        errorMessage = "Hệ thống AI đã hết lượt sử dụng (Quota Exceeded) hoặc đang bị quá tải. Vui lòng đợi một lát rồi thử lại, hoặc kiểm tra lại giới hạn API của bạn.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper to generate a random color for avatars based on username
  const getAvatarColor = (name: string) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const extractVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleThumbUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setThumbUrlInput(newUrl);
    setCurrentThumbId(extractVideoId(newUrl));
  };

  const downloadThumbnail = async (url: string, videoId: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `thumbnail_${videoId}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback if CORS blocks the fetch
      window.open(url, '_blank');
    }
  };

  const handleVideoDownload = () => {
    if (!videoUrlInput.trim()) return;
    setShowWidget(true);
  };

  return (
    <div className="min-h-screen bg-transparent text-[#f1f1f1] font-sans selection:bg-red-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
            <div className="relative">
              <div className="absolute -inset-1 bg-red-500 rounded-xl blur opacity-30 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-red-500 to-red-700 p-2 rounded-xl border border-red-400/50">
                <Youtube className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold tracking-tight glow-text text-white">Seeding Comment Youtube</h1>
              <div className="text-[10px] text-red-400 font-mono tracking-widest uppercase mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                System Online
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10 shadow-inner">
            <button
              onClick={() => setView('home')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'home' ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Cpu className="w-4 h-4" />
              Phân tích
            </button>
            <button
              onClick={() => setView('thumbnail')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'thumbnail' ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Thumbnail
            </button>
            <button
              onClick={() => setView('video')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'video' ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Film className="w-4 h-4" />
              Tải Video
            </button>
            <button
              onClick={() => setView('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'history' ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-4 h-4" />
              Lịch sử
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {view === 'video' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-12 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/20 rounded-full blur-[100px] -z-10"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono mb-6">
                <Film className="w-3.5 h-3.5" />
                <span>VIDEO DOWNLOADER</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight glow-text text-white">
                Tải <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Video</span> YouTube
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto font-mono text-sm">
                <span className="text-red-500 mr-2">&gt;</span> Dán link YouTube để tải video với độ phân giải tùy chọn (Hỗ trợ tối đa 1080p).
              </p>
            </div>

            {/* Video Input */}
            <div className="relative max-w-3xl mx-auto mb-8 group z-10">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-[22px] blur-lg opacity-30 group-focus-within:opacity-70 transition-opacity duration-200"></div>
              <div className="relative rounded-[22px] p-[1px] bg-gradient-to-r from-red-500/40 via-orange-500/40 to-red-500/40 group-focus-within:from-red-500/80 group-focus-within:via-orange-500/80 group-focus-within:to-red-500/80 transition-all duration-200 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-focus-within:shadow-[0_0_25px_rgba(239,68,68,0.3)]">
                <div className="relative flex flex-col bg-[#0a0a0a]/80 backdrop-blur-xl rounded-[21px] overflow-hidden group-focus-within:bg-[#141414]/90 transition-colors duration-200">
                  <div className="flex items-center relative">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-red-500/50 group-focus-within:text-orange-500/80 transition-colors duration-200" />
                    </div>
                    <input
                      type="text"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      placeholder="Dán link YouTube hoặc Shorts vào đây..."
                      className="w-full pl-14 pr-6 py-5 bg-transparent text-white placeholder-red-500/40 focus:outline-none text-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Resolution Selector (Removed as external sites handle this) */}
            <div className="flex justify-center gap-4 mb-8">
            </div>

            {/* Download Button */}
            {!showWidget ? (
              <div className="text-center space-y-4">
                <button 
                  onClick={handleVideoDownload}
                  disabled={!videoUrlInput.trim()}
                  className="relative z-10 px-10 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold inline-flex items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] transition-all duration-200 hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  <Download className="w-6 h-6" />
                  Lấy Link Tải Video
                </button>
              </div>
            ) : (
              <div className="w-full max-w-2xl mx-auto space-y-6">
                <div className="bg-black/40 p-6 rounded-2xl border border-white/10 shadow-xl text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Chọn Server Tải Xuống</h3>
                  <p className="text-sm text-gray-400 mb-6">Vui lòng chọn một trong các server bên dưới để tải video. Các server này sẽ mở trong tab mới.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => window.open(`https://en.savefrom.net/1-youtube-video-downloader-360/?url=${encodeURIComponent(videoUrlInput)}`, '_blank')}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all hover:-translate-y-1 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <Zap className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-white">Server 1 (SaveFrom)</span>
                      <span className="text-[10px] text-gray-400">Phổ biến nhất</span>
                    </button>

                    <button
                      onClick={() => window.open(`https://publer.io/tools/youtube-video-downloader?url=${encodeURIComponent(videoUrlInput)}`, '_blank')}
                      className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all hover:-translate-y-1 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                        <Activity className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-white">Server 2 (Publer)</span>
                      <span className="text-[10px] text-gray-400">An toàn, không quảng cáo</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : view === 'thumbnail' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-12 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/20 rounded-full blur-[100px] -z-10"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono mb-6">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>THUMBNAIL EXTRACTOR</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight glow-text text-white">
                Tải <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Ảnh Bìa</span> Video
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto font-mono text-sm">
                <span className="text-red-500 mr-2">&gt;</span> Dán link YouTube để xem và tải ảnh bìa chất lượng cao nhất (Max Resolution).
              </p>
            </div>

            {/* Thumbnail Input */}
            <div className="relative max-w-3xl mx-auto mb-12 group z-10">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-[22px] blur-lg opacity-30 group-focus-within:opacity-70 transition-opacity duration-200"></div>
              <div className="relative rounded-[22px] p-[1px] bg-gradient-to-r from-red-500/40 via-orange-500/40 to-red-500/40 group-focus-within:from-red-500/80 group-focus-within:via-orange-500/80 group-focus-within:to-red-500/80 transition-all duration-200 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-focus-within:shadow-[0_0_25px_rgba(239,68,68,0.3)]">
                <div className="relative flex flex-col bg-[#0a0a0a]/80 backdrop-blur-xl rounded-[21px] overflow-hidden group-focus-within:bg-[#141414]/90 transition-colors duration-200">
                  <div className="flex items-center relative">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-red-500/50 group-focus-within:text-orange-500/80 transition-colors duration-200" />
                    </div>
                    <input
                      type="text"
                      value={thumbUrlInput}
                      onChange={handleThumbUrlChange}
                      placeholder="Dán link YouTube hoặc Shorts vào đây..."
                      className="w-full pl-14 pr-6 py-5 bg-transparent text-white placeholder-red-500/40 focus:outline-none text-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Thumbnail Preview */}
            <AnimatePresence mode="wait">
              {currentThumbId ? (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-panel rounded-3xl p-6 text-center relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4"></div>
                  <img 
                    src={`https://img.youtube.com/vi/${currentThumbId}/maxresdefault.jpg`} 
                    alt="YouTube Thumbnail" 
                    className="w-full rounded-2xl shadow-2xl mb-8 relative z-10 object-cover aspect-video bg-black/50"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      // Fallback to hqdefault if maxresdefault doesn't exist
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${currentThumbId}/hqdefault.jpg`;
                    }}
                  />
                  <button 
                    onClick={() => downloadThumbnail(`https://img.youtube.com/vi/${currentThumbId}/maxresdefault.jpg`, currentThumbId)}
                    className="relative z-10 px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-bold inline-flex items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] transition-all duration-200 hover:-translate-y-1"
                  >
                    <Download className="w-5 h-5" />
                    Tải Xuống Ảnh Bìa (Max Res)
                  </button>
                </motion.div>
              ) : thumbUrlInput ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-red-400 font-mono bg-red-500/10 py-4 rounded-xl border border-red-500/20"
                >
                  Link không hợp lệ. Vui lòng nhập đúng link YouTube.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        ) : view === 'history' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between mb-8 border-b border-red-500/20 pb-4">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-red-500" />
                <h2 className="text-3xl font-bold glow-text">Lịch sử phân tích</h2>
              </div>
              <div className="text-xs font-mono text-red-400/60 uppercase tracking-widest hidden sm:block">
                LOCAL_STORAGE // {history.length} RECORDS
              </div>
            </div>
            
            {history.length === 0 ? (
              <div className="text-center py-20 glass-panel rounded-3xl">
                <Terminal className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
                <p className="text-gray-400 text-lg font-mono">Chưa có dữ liệu trong hệ thống.</p>
                <button 
                  onClick={() => setView('home')}
                  className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium transition-all text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                >
                  Khởi tạo phân tích mới
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {history.map(item => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass-panel hover-3d p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-red-500/50 transition-all cursor-pointer group relative overflow-hidden"
                    onClick={() => loadHistoryItem(item)}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    <div className="flex-1 min-w-0 relative z-10">
                      <h3 className="font-bold text-lg text-white truncate mb-1 group-hover:text-red-400 transition-colors">{item.videoTitle}</h3>
                      <p className="text-sm text-gray-400 font-mono truncate mb-3">{item.url}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-mono">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(item.timestamp).toLocaleString('vi-VN')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {item.segments.length} phân khúc
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {item.segments.reduce((acc, seg) => acc + seg.comments.length, 0)} bình luận
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => deleteHistoryItem(item.id, e)} 
                      className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded-xl transition-colors shrink-0 relative z-10"
                      title="Xóa khỏi hệ thống"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <>
            {/* Hero Section */}
            <div className="text-center mb-12 relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/20 rounded-full blur-[100px] -z-10"></div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono mb-6">
                <Activity className="w-3.5 h-3.5" />
                <span>AI ANALYSIS ENGINE v3.1</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight glow-text text-white">
                Hệ Thống Phân Tích <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Dữ Liệu Khán Giả</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto font-mono text-sm">
                <span className="text-red-500 mr-2">&gt;</span> Nhập URL video YouTube để khởi động module AI. Hệ thống sẽ trích xuất tệp người xem và giả lập bình luận tương ứng.
              </p>
            </div>

            {/* Search Input */}
            <form onSubmit={analyzeVideo} className="relative max-w-3xl mx-auto mb-16 group z-10">
              {/* Ambient light behind */}
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 rounded-[22px] blur-lg opacity-30 group-focus-within:opacity-70 transition-opacity duration-200"></div>
              
              {/* Gradient Border Wrapper */}
              <div className="relative rounded-[22px] p-[1px] bg-gradient-to-r from-red-500/40 via-orange-500/40 to-red-500/40 group-focus-within:from-red-500/80 group-focus-within:via-orange-500/80 group-focus-within:to-red-500/80 transition-all duration-200 shadow-[0_0_15px_rgba(239,68,68,0.1)] group-focus-within:shadow-[0_0_25px_rgba(239,68,68,0.3)]">
                
                {/* Inner Input Container */}
                <div className="relative flex flex-col bg-[#0a0a0a]/80 backdrop-blur-xl rounded-[21px] overflow-hidden group-focus-within:bg-[#141414]/90 transition-colors duration-200">
                  <div className="flex items-center relative">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-red-500/50 group-focus-within:text-orange-500/80 transition-colors duration-200" />
                    </div>
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="Dán link YouTube Shorts vào đây..."
                      className="w-full pl-14 pr-40 py-5 bg-transparent text-white placeholder-red-500/40 focus:outline-none text-lg"
                      disabled={loading}
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading || !url.trim()}
                      className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-[14px] font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          <span className="hidden sm:inline">Khởi Chạy</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Settings Bar */}
                  <div className="border-t border-white/5 px-6 py-4 bg-black/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex flex-col gap-2 w-full sm:w-auto flex-1">
                      <label htmlFor="commentCount" className="text-sm text-gray-400 font-mono whitespace-nowrap flex items-center gap-2">
                        <Activity className="w-4 h-4 text-red-500/70" />
                        Số lượng bình luận/phân khúc: <span className="text-white font-bold ml-1">{commentCount}</span>
                      </label>
                      <input
                        id="commentCount"
                        type="range"
                        min="1"
                        max="30"
                        value={commentCount}
                        onChange={(e) => setCommentCount(parseInt(e.target.value))}
                        disabled={loading}
                        className="w-full h-1.5 bg-red-900/30 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-orange-500 transition-colors"
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                        <label className="text-xs text-gray-400 font-mono uppercase tracking-wider">Độ dài</label>
                        <select 
                          value={commentLength}
                          onChange={(e) => setCommentLength(e.target.value as any)}
                          disabled={loading}
                          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors cursor-pointer appearance-none pr-8 relative"
                          style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
                        >
                          <option value="mixed">Đa dạng</option>
                          <option value="short">Ngắn gọn</option>
                          <option value="medium">Vừa phải</option>
                          <option value="long">Chi tiết</option>
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                        <label className="text-xs text-gray-400 font-mono uppercase tracking-wider">Ngữ điệu</label>
                        <select 
                          value={commentTone}
                          onChange={(e) => setCommentTone(e.target.value as any)}
                          disabled={loading}
                          className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors cursor-pointer appearance-none pr-8 relative"
                          style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
                        >
                          <option value="mixed">Đa dạng</option>
                          <option value="neutral">Trung lập</option>
                          <option value="happy">Vui vẻ (Khoe lãi)</option>
                          <option value="sad">Buồn bã (Than lỗ)</option>
                          <option value="angry">Tức giận (Bức xúc)</option>
                          <option value="surprised">Ngạc nhiên (Sốc)</option>
                          <option value="enthusiastic">Hào hứng (Fomo)</option>
                          <option value="critical">Phản biện (Chim lợn)</option>
                          <option value="humorous">Hài hước (Troll)</option>
                          <option value="questioning">Hỏi đáp</option>
                          <option value="loyal">Fan cứng (Trung thành)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 max-w-3xl mx-auto mb-12"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-red-500 rounded-full border-t-transparent animate-spin shadow-[0_0_15px_rgba(255,0,60,0.5)]"></div>
                <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-red-500 animate-pulse" />
              </div>
              <p className="text-xl font-mono font-bold text-red-400 animate-pulse glow-text-red mb-2">
                {extractingAudio ? "ĐANG TẢI VÀ PHÂN TÍCH ÂM THANH..." : "ĐANG PHÂN TÍCH SÂU VIDEO..."}
              </p>
              <div className="flex items-center gap-2 text-gray-400 font-mono mb-4">
                <Clock className="w-4 h-4" />
                <span>Thời gian xử lý: {Math.floor(loadingTime / 60).toString().padStart(2, '0')}:{(loadingTime % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="max-w-md text-center space-y-2">
                <p className="text-sm text-gray-500 font-mono">
                  {extractingAudio 
                    ? "Hệ thống đang tải xuống âm thanh từ video để nghe và phân tích chính xác nhất." 
                    : "Hệ thống đang quét và nhận diện chi tiết nội dung, hình ảnh, âm thanh trong video để đảm bảo bình luận chính xác nhất."}
                </p>
                <p className="text-xs text-red-500/70 font-mono italic">Quá trình này có thể mất 1-2 phút tùy thuộc vào độ dài video.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12"
            >
              {/* Video Info Card */}
              <div className="glass-panel tech-corners rounded-3xl p-8 relative overflow-hidden mb-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 text-red-400">
                      <Info className="w-5 h-5" />
                      <span className="font-mono font-bold uppercase tracking-widest text-xs glow-text-red">Thông tin Video</span>
                    </div>
                    <button
                      onClick={() => handleShare(
                        `Phân tích video: ${result.videoTitle}`,
                        `Tóm tắt: ${result.videoSummary}\n\nPhân tích sâu: ${result.videoAnalysis}`,
                        (result as HistoryItem).url || url
                      )}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-sm font-mono text-gray-300 hover:text-white group"
                    >
                      <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span>Chia sẻ kết quả</span>
                    </button>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-6 leading-tight text-white">{result.videoTitle}</h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-bold text-red-400/80 mb-2 uppercase tracking-wider font-mono">Tóm tắt</h4>
                      <p className="text-gray-300 text-lg leading-relaxed">{result.videoSummary}</p>
                    </div>
                    
                    <div className="p-5 bg-black/40 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-orange-500/30 transition-colors">
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <h4 className="text-sm font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                          <Cpu className="w-4 h-4" />
                          AI Deep Analysis
                        </h4>
                        {result.usedTranscript !== undefined && (
                          <div className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${result.usedTranscript ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : result.usedAudio ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                            {result.usedTranscript ? (
                              <>
                                <Check className="w-3 h-3" />
                                Đã quét phụ đề gốc
                              </>
                            ) : result.usedAudio ? (
                              <>
                                <Film className="w-3 h-3" />
                                Đã nghe âm thanh gốc
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3" />
                                Suy luận từ bối cảnh (Không có phụ đề)
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed font-mono whitespace-pre-wrap">{result.videoAnalysis}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Segments & Comments Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Segments Sidebar */}
                <div className="lg:col-span-4 space-y-3 sticky top-24">
                  <h4 className="text-lg font-mono font-bold mb-6 flex items-center gap-2 text-white glow-text">
                    <Users className="w-5 h-5" />
                    PHÂN KHÚC KHÁN GIẢ
                  </h4>
                  {result.segments.map((segment, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSegment(index)}
                      className={`w-full text-left p-5 rounded-2xl transition-all duration-300 border relative overflow-hidden hover-3d ${
                        activeSegment === index
                          ? 'glass-panel border-red-500/50 shadow-[0_0_15px_rgba(255,0,60,0.2)]'
                          : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      {activeSegment === index && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 shadow-[0_0_10px_rgba(255,0,60,0.8)]"></div>
                      )}
                      <h5 className={`font-bold text-lg mb-1 ${activeSegment === index ? 'text-red-400 glow-text-red' : 'text-gray-300'}`}>
                        {segment.segmentName}
                      </h5>
                      <p className="text-sm text-gray-500 line-clamp-2">{segment.segmentDescription}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 font-mono">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {segment.comments.length} DATA POINTS
                      </div>
                    </button>
                  ))}
                </div>

                {/* Comments Feed */}
                <div className="lg:col-span-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSegment}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      <div className="mb-8 glass-panel p-6 rounded-2xl border-l-4 border-l-red-500">
                        <h4 className="text-2xl font-bold mb-2 text-white">{result.segments[activeSegment].segmentName}</h4>
                        <p className="text-gray-400">{result.segments[activeSegment].segmentDescription}</p>
                      </div>

                      <div className="space-y-6">
                        {result.segments[activeSegment].comments.map((comment, idx) => (
                          <div key={idx} className="relative flex gap-4 group">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className={`absolute -inset-1 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity ${getAvatarColor(comment.username)}`}></div>
                              <div className={`relative w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg border border-white/10 ${getAvatarColor(comment.username)}`}>
                                {comment.username.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            
                            {/* Comment Content */}
                            <div className="flex-1 min-w-0">
                              <div className="glass-panel p-4 sm:p-5 rounded-2xl rounded-tl-sm transition-all duration-300 shadow-sm group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] relative overflow-hidden">
                                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] transition-colors duration-300 pointer-events-none"></div>
                                <div className="relative z-10">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
                                    <span className="font-bold text-[15px] text-white tracking-tight">@{comment.username}</span>
                                    <span className="text-xs text-gray-500 font-mono">{comment.timeAgo}</span>
                                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 ml-auto sm:ml-2">
                                      {comment.type}
                                    </span>
                                  </div>
                                  
                                  <p className="text-[15px] text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">
                                    {comment.text}
                                  </p>
                                  
                                  {/* Actions */}
                                  <div className="flex items-center gap-1 sm:gap-2 text-gray-500 font-mono">
                                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">
                                      <ThumbsUp className="w-4 h-4" />
                                      <span className="text-xs font-bold">{comment.likes > 0 ? comment.likes.toLocaleString() : ''}</span>
                                    </button>
                                    <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all">
                                      <ThumbsDown className="w-4 h-4" />
                                    </button>
                                    <button className="text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all uppercase tracking-wider ml-1">
                                      Reply
                                    </button>
                                    <button
                                      onClick={() => handleShare(
                                        `Bình luận về video: ${result.videoTitle}`,
                                        `"${comment.text}" - @${comment.username}`,
                                        (result as HistoryItem).url || url
                                      )}
                                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-all ml-auto"
                                      title="Chia sẻ bình luận"
                                    >
                                      <Share2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
          </>
        )}
      </main>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-full shadow-2xl font-mono text-sm"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Check className="w-3 h-3" />
            </div>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
