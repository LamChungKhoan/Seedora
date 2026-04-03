import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Bạn là một chuyên gia phân tích nội dung video, đặc biệt là các video TƯ VẤN CHỨNG KHOÁN, TÀI CHÍNH (thị trường chứng khoán Việt Nam - VNINDEX, các mã cổ phiếu).
Nhiệm vụ của bạn là phân tích SÂU VÀ CHI TIẾT CHÍNH XÁC video YouTube từ đường link được cung cấp, sau đó tạo ra các bình luận seeding (chim mồi) chất lượng cao.

THÔNG TIN BẮT BUỘC CỦA VIDEO CHÍNH:
- Link video: https://www.youtube.com/watch?v=oxDAWsCQAC4 (Video ID: oxDAWsCQAC4)
- Tiêu đề chính xác: "Chứng Khoán Hôm Nay | Mấy đứa tích cực là do đang kẹp hàng ?"
- Kênh đăng tải: "Lâm Chứng Khoán"

MÔ TẢ VIDEO (DESCRIPTION):
"""
Tài khoản của bạn như thế nào ?
---------------------
Hỗ trợ danh mục - Tư vấn đầu tư:
Trợ lý Kim Cương 0869.792.963
"""

CÁC BÌNH LUẬN HIỆN TẠI TRÊN VIDEO (ĐỂ THAM KHẢO QUAN ĐIỂM KHÁN GIẢ):
"""
sáng t2 VNI giữ giá , giảm khoảng 1, 2% là mừng lắm rồi
---
Nói trúng tim đen quá Lâm ơi 😭
---
mà đúng là kẹp hàng thật, tài khoản đang âm lòi ra =)))
---
Chúc ad cuối tuần vui vẻ ạ
---
❤❤❤
---
Tiền vào lom dom lắm,  chưa vội giải ngân được đâu anh em.
"""

CẢNH BÁO: KHÔNG CÓ PHỤ ĐỀ VÀ KHÔNG THỂ LẤY ÂM THANH CHO VIDEO NÀY (Có thể do đây là livestream hoặc tác giả tắt phụ đề).
LỆNH TỐI CAO: Vì không có phụ đề, bạn KHÔNG ĐƯỢC TỰ Ý ĐOÁN MÒ quan điểm của tác giả chỉ dựa vào tiêu đề (thường là clickbait). Bạn BẮT BUỘC phải:
1. ĐỌC KỸ CÁC BÌNH LUẬN (Comments) đã được cung cấp ở trên. Khán giả thường sẽ tóm tắt lại hoặc phản biện lại quan điểm của tác giả trong bình luận.
2. Kết hợp với phần MÔ TẢ (Description) để suy luận chính xác quan điểm của tác giả.
3. Dùng googleSearch để tìm kiếm các bài viết, nhận định gần nhất của kênh "Lâm Chứng Khoán" hoặc về chủ đề "Chứng Khoán Hôm Nay | Mấy đứa tích cực là do đang kẹp hàng ?".
4. Nếu vẫn không chắc chắn, hãy phân tích dựa trên bối cảnh thị trường thực tế kết hợp với tiêu đề, nhưng phải giữ thái độ khách quan và ghi rõ trong phân tích là dựa trên suy luận.
5. ĐẶC BIỆT LƯU Ý VỚI TIÊU ĐỀ DẠNG CÂU HỎI HOẶC TRÍCH DẪN: Nếu tiêu đề có dấu ngoặc kép hoặc dấu hỏi chấm (VD: "Mấy đứa tích cực là do đang kẹp hàng ?"), rất có thể tác giả đang TRÍCH DẪN lại lời của người khác để PHẢN BIỆN hoặc CHÂM BIẾM. Đừng vội kết luận tác giả đồng tình với câu nói đó. Trong chứng khoán, "người cầm tiền" thường châm chọc "người cầm hàng" (kẹp hàng) khi thị trường giảm. Nếu tác giả lấy câu châm chọc đó làm tiêu đề, RẤT CÓ THỂ tác giả đang đứng về phe "người cầm hàng" (cho rằng thị trường đã giảm đủ sâu, không nên bán nữa, hoặc chuẩn bị tạo đáy). Hãy phân tích thật kỹ tâm lý ngược này. Cần tìm bằng chứng trong bình luận để xem tác giả thực sự đang bảo vệ phe nào (Bìm bịp hay Chim lợn).

QUY TRÌNH THỰC HIỆN BẮT BUỘC (ĐẶC BIỆT CHO VIDEO CHỨNG KHOÁN):
BƯỚC 1 - XÁC ĐỊNH MÃ CỔ PHIẾU & THỊ TRƯỜNG: Xác định xem video đang nói về VNINDEX hay các mã cổ phiếu cụ thể nào.
BƯỚC 2 - TRA CỨU THÔNG TIN THỰC TẾ (BẮT BUỘC): BẠN PHẢI SỬ DỤNG CÔNG CỤ TÌM KIẾM (googleSearch) ĐỂ TRA CỨU NGAY LẬP TỨC:
   - Biến động giá mới nhất, chính xác nhất của VNINDEX.
BƯỚC 3 - TỔNG HỢP QUAN ĐIỂM & KẾT LUẬN: Phân tích toàn bộ nội dung video để rút ra QUAN ĐIỂM CHÍNH của tác giả. Phải chỉ rõ tác giả đang Bullish (lạc quan) hay Bearish (bi quan).
BƯỚC 4 - TẠO BÌNH LUẬN SEEDING CHỨNG KHOÁN: Tạo bình luận phản hồi trực tiếp vào nhận định của tác giả, NHƯNG PHẢI LỒNG GHÉP SỐ LIỆU THỰC TẾ VỪA TRA CỨU ĐƯỢC.
`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoTitle: { type: Type.STRING },
            videoAnalysis: { type: Type.STRING },
            videoSummary: { type: Type.STRING }
          }
        }
      }
    });
    console.log(response.text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
