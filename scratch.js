/**
 * 1. MOCK API: Giả lập việc gọi API kiểm tra kết quả quay từ Server
 * @returns {Promise<string>} Giá trị trúng giải
 */
const fetchPrizeFromBackend = async () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Giả lập tỉ lệ trúng thưởng: 70% Win, 30% Lose
            const isWinner = Math.random() > 0.3;
            resolve(isWinner ? "🎉 Trúng Thẻ Cào 500k! 🎉" : "Chúc bạn may mắn lần sau");
        }, 1000); // Mất 1 giây gọi mạng
    });
};

/**
 * 2. LÕI THUẬT TOÁN: Logic thao tác cào và tính toán điểm ảnh Canvas
 */
const initScratchCard = () => {
    const canvas = document.getElementById('scratchCanvas');
    // willReadFrequently tối ưu bộ nhớ GPU/CPU khi cần gọi getImageData liên tục
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); 
    const container = document.getElementById('scratchContainer');
    
    // Đồng bộ scale đồ họa canvas với element kích thước
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    // Bước 1: Vẽ đổ màu lớp bạc
    ctx.fillStyle = '#9ca3af'; // Màu nhũ bạc
    ctx.fillRect(0, 0, width, height);

    // Bước 2: Viết hướng dẫn lên mặt bạc
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#4b5563';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CÀO MẠNH ĐỂ MỞ', width / 2, height / 2);

    let isDrawing = false;
    const brushRadius = 22; // Độ to của 'đồng xu' dùng để cào

    // Lấy tọa độ chuột/touch
    const getCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    // Hàm Mouse/Touch Down
    const handleStart = (e) => {
        isDrawing = true;
        handleScratch(e);
    };

    // Hàm Mouse/Touch Move (Quá trình cào xước bạc)
    const handleScratch = (e) => {
        if (!isDrawing) return;
        
        // Ngăn trình duyệt cuộn màn hình khi lấy tay vuốt lên Canvas (Cực kỳ quan trọng ở mobile)
        e.preventDefault();

        const { x, y } = getCoordinates(e);

        // globalCompositeOperation: Core logic biến fill() thành Eraser (cục tẩy)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
        ctx.fill();
    };

    // Hàm Mouse/Touch Up (Kết thúc vuốt -> Kiểm tra đã cào đủ chưa)
    const handleEnd = () => {
        isDrawing = false;
        
        // --- Tính toán Tỉ lệ % đã cào ---
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        let transparentPixels = 0;
        
        // Tối ưu thuật toán đếm Pixel: Nhảy mỗi 32 pixel (stride) thay vì duyệt từng pixel li ti (O(N) giản lược)
        const stride = 32; 
        const totalSamplePixels = pixels.length / 4 / stride;

        // Channel của Alpha (độ đục) nằm ở index mod 3: [R, G, B, A] 
        for (let i = 0; i < pixels.length; i += 4 * stride) {
            if (pixels[i + 3] < 128) {
                // Alpha < 128 (Đã cào qua nửa trong suốt)
                transparentPixels++;
            }
        }

        const clearedPercentage = (transparentPixels / totalSamplePixels) * 100;

        // Auto-reveal: Cào dc hơn 50% => Mờ lớp trên cùng luôn
        if (clearedPercentage > 50) {
            canvas.classList.add('fade-out');
            cleanupEvents(); // Tiết kiệm event loop listener
        }
    };

    // Hàm dọn dẹp để chống Memory Leak
    const cleanupEvents = () => {
        canvas.removeEventListener('mousedown', handleStart);
        canvas.removeEventListener('mousemove', handleScratch);
        canvas.removeEventListener('mouseup', handleEnd);
        canvas.removeEventListener('mouseleave', handleEnd);
        
        canvas.removeEventListener('touchstart', handleStart);
        canvas.removeEventListener('touchmove', handleScratch);
        canvas.removeEventListener('touchend', handleEnd);
    };

    // Gắn Listeners Desktop
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleScratch);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);

    // Gắn Listeners Mobile
    // Tham số { passive: false } là bắt buộc để "e.preventDefault()" hoạt động đúng chuẩn
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleScratch, { passive: false });
    canvas.addEventListener('touchend', handleEnd);
};

/**
 * 3. HÀM MAIN: Lifecycle thực thi theo thứ tự
 */
window.addEventListener('DOMContentLoaded', async () => {
    const prizeElement = document.getElementById('prizeText');

    // Chờ hệ thống lấy mã giải thưởng dưới Backend (UI lúc này hiện "Đang xoay...")
    const prize = await fetchPrizeFromBackend();
    
    // Đã có data Backend -> Cập nhật vào Layer dưới cùng của DOM
    prizeElement.textContent = prize;

    // Phủ bạc và đè Canvas che lên trên cùng với đầy đủ tương tác
    initScratchCard();
});
