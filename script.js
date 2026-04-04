/**
         * Random Generator Core Module
         * Uses Crypto API for true randomness
         */
class CryptoRandomUtils {
    /**
     * Generate a cryptographically secure random number between min and max (inclusive)
     */
    static getRandomInt(min, max) {
        if (min > max) [min, max] = [max, min];
        const range = max - min + 1;
        const maxSafe = Math.floor((2 ** 32 - 1) / range) * range;

        let randomValue;
        do {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            randomValue = array[0];
        } while (randomValue >= maxSafe); // Reject bias

        return min + (randomValue % range);
    }
}

/**
 * App Controller
 */
class RandomGeneratorApp {
    constructor() {
        this.currentMode = 'number'; // 'number' | 'name'
        this.isSpinning = false;
        this.soundEnabled = true;
        this.history = JSON.parse(localStorage.getItem('randomGenHistory')) || [];
        this.drawnPool = new Set(); // For unique mode

        // Prize Tiers Setup
        const defaultTiers = [];
        this.prizeTiers = JSON.parse(localStorage.getItem('randomGenPrizes')) || defaultTiers;

        // Audio contexts (using base64 or public domains to avoid local path issues)
        // using short placeholder beeps using Web Audio API to ensure it works without external assets
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        this.initDOM();
        this.initPrizeTiers();
        this.bindEvents();
        this.renderHistory();
    }

    initDOM() {
        this.appContainer = document.getElementById('appContainer');
        this.resultDisplay = document.getElementById('resultDisplay');
        this.btnSpin = document.getElementById('btnSpin');
        this.historyList = document.getElementById('historyList');

        // Tabs
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.modeSections = document.querySelectorAll('.mode-section');

        // Inputs
        this.nameTextArea = document.getElementById('nameList');
        this.nameCount = document.getElementById('nameCount');
        
        // Scratch
        this.scratchTextArea = document.getElementById('scratchList');
        this.scratchCount = document.getElementById('scratchCount');
    }

    bindEvents() {
        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isSpinning) {
                    alert("Vui lòng đợi hệ thống Quay số hoặc Thẻ cào xử lý xong trước khi chuyển Tab!");
                    return;
                }

                this.tabBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                this.modeSections.forEach(sec => sec.classList.add('hidden'));
                const targetId = e.target.dataset.target;
                document.getElementById(targetId).classList.remove('hidden');

                this.currentMode = targetId.replace('Mode', ''); // 'number', 'name', 'scratch'

                // Show/hide prize selector accordingly
                const prizeSelectorWrapper = document.getElementById('prizeSelectorWrapper');
                const prizeHeading = document.getElementById('prizeHeading');
                const scratchContainer = document.getElementById('scratchContainer');
                const btnCreateScratch = document.getElementById('btnCreateScratch');
                
                const spinConfigGroup = document.getElementById('spinConfigGroup');
                const blacklistGroup = document.getElementById('blacklistGroup');

                if (this.currentMode === 'number') {
                    prizeSelectorWrapper.classList.add('hidden');
                    prizeHeading.style.display = 'none';
                    this.resultDisplay.classList.remove('hidden');
                    document.getElementById('scratchGridWrapper').classList.add('hidden');
                    scratchContainer.classList.add('hidden');
                    document.getElementById('scratchActions').classList.add('hidden');
                    this.btnSpin.classList.remove('hidden');
                    spinConfigGroup.classList.remove('hidden');
                    blacklistGroup.classList.remove('hidden');
                } else if (this.currentMode === 'name') {
                    prizeSelectorWrapper.classList.remove('hidden');
                    document.getElementById('prizeSelect').dispatchEvent(new Event('change'));
                    this.resultDisplay.classList.remove('hidden');
                    document.getElementById('scratchGridWrapper').classList.add('hidden');
                    scratchContainer.classList.add('hidden');
                    document.getElementById('scratchActions').classList.add('hidden');
                    this.btnSpin.classList.remove('hidden');
                    spinConfigGroup.classList.remove('hidden');
                    blacklistGroup.classList.remove('hidden');
                } else if (this.currentMode === 'scratch') {
                    prizeSelectorWrapper.classList.add('hidden'); // Scratch uses internal list
                    prizeHeading.style.display = 'none';
                    this.resultDisplay.classList.add('hidden');
                    document.getElementById('scratchGridWrapper').classList.add('hidden');
                    scratchContainer.classList.add('hidden');
                    document.getElementById('scratchActions').classList.remove('hidden');
                    this.btnSpin.classList.add('hidden');
                    btnCreateScratch.classList.remove('hidden');
                    document.getElementById('btnBackToGrid').classList.add('hidden');
                    spinConfigGroup.classList.add('hidden');
                    blacklistGroup.classList.add('hidden');
                }
            });
        });

        // Name list counter dynamically
        this.nameTextArea.addEventListener('input', () => {
            const count = this.getValidNames().length;
            this.nameCount.textContent = `${count} mục`;
        });

        // Scratch list counter dynamically
        this.scratchTextArea.addEventListener('input', () => {
            const count = this.getValidNames('scratch').length;
            this.scratchCount.textContent = `${count} mục`;
        });

        // Spin Action
        this.btnSpin.addEventListener('click', () => this.startSpinning());
        document.getElementById('btnCreateScratch').addEventListener('click', () => this.generateScratchGrid());
        document.getElementById('btnBackToGrid').addEventListener('click', () => {
            document.getElementById('scratchContainer').classList.add('hidden');
            document.getElementById('btnBackToGrid').classList.add('hidden');

            const remainingCards = document.querySelectorAll('.mystery-card:not(.scratched)');
            if (remainingCards.length === 0) {
                // If no cards are left, return to initial mode to generate a new grid
                document.getElementById('scratchGridWrapper').classList.add('hidden');
                const btnCreateScratch = document.getElementById('btnCreateScratch');
                btnCreateScratch.classList.remove('hidden');
                btnCreateScratch.disabled = false;
                document.querySelector('.result-display').classList.add('hidden');
            } else {
                // Show the grid again
                document.getElementById('scratchGridWrapper').classList.remove('hidden');
            }
        });

        // Fullscreen
        document.getElementById('btnFullscreen').addEventListener('click', () => this.toggleFullscreen());

        // Sidebar Toggles
        document.getElementById('btnToggleLeft').addEventListener('click', () => {
            this.appContainer.classList.toggle('left-collapsed');
        });
        document.getElementById('btnToggleRight').addEventListener('click', () => {
            this.appContainer.classList.toggle('right-collapsed');
        });

        // Sound
        const btnSound = document.getElementById('btnSound');
        btnSound.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            btnSound.innerHTML = this.soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
        });

        // History Actions
        document.getElementById('btnClearHistory').addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử không?')) {
                this.history = [];
                this.drawnPool.clear();
                this.saveHistory();
                this.renderHistory();
            }
        });

        document.getElementById('btnExportCSV').addEventListener('click', () => this.exportCSV());

        // Exclusive Checkboxes (Odd/Even)
        const filterOdd = document.getElementById('filterOdd');
        const filterEven = document.getElementById('filterEven');
        filterOdd.addEventListener('change', () => { if (filterOdd.checked) filterEven.checked = false; });
        filterEven.addEventListener('change', () => { if (filterEven.checked) filterOdd.checked = false; });

        // Custom Stepper Logic
        document.querySelectorAll('.btn-step').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                const input = document.getElementById(targetId);
                const isUp = e.currentTarget.classList.contains('up');

                let val = parseInt(input.value) || 0;
                const min = parseInt(input.min) !== NaN ? parseInt(input.min) : -Infinity;
                const max = parseInt(input.max) !== NaN ? parseInt(input.max) : Infinity;

                if (isUp) val++;
                else val--;

                if (val < min) val = min;
                if (val > max) val = max;

                input.value = val;
                // Ném sự kiện để báo cho các hệ thống khác biết giá trị đã thay đổi
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
    }

    // --- PRIZE TIER MANAGEMENT ---
    initPrizeTiers() {
        this.renderPrizeList();
        this.renderPrizeSelect();

        document.getElementById('btnAddPrize').addEventListener('click', () => {
            const newId = Date.now();
            this.prizeTiers.push({ id: newId, tierName: "Giải Mới", prizeDetail: "Phần thưởng", quantity: 1 });
            this.savePrizes();
            this.renderPrizeList();
            this.renderPrizeSelect();
        });

        document.getElementById('prizeSelect').addEventListener('change', (e) => {
            const selectedId = parseInt(e.target.value);
            const tier = this.prizeTiers.find(p => p.id === selectedId);
            const prizeHeading = document.getElementById('prizeHeading');
            if (tier) {
                const drawCountInput = document.getElementById('drawCount');
                drawCountInput.value = tier.quantity;
                prizeHeading.style.display = 'block';
                prizeHeading.textContent = `ĐANG QUAY ${tier.tierName.toUpperCase()}: ${tier.prizeDetail.toUpperCase()}`;
            } else {
                prizeHeading.style.display = 'none';
                prizeHeading.textContent = '';
            }
        });

        // Trigger initial change layout
        document.getElementById('prizeSelect').dispatchEvent(new Event('change'));

        // Hide on initial load since default is numberMode
        if (this.currentMode === 'number') {
            document.getElementById('prizeSelectorWrapper').classList.add('hidden');
            document.getElementById('prizeHeading').style.display = 'none';
        }
    }

    renderPrizeList() {
        const list = document.getElementById('prizeList');
        list.innerHTML = '';
        this.prizeTiers.forEach((tier) => {
            const item = document.createElement('div');
            item.className = 'prize-item';
            item.innerHTML = `
                <input type="text" class="tier-name" data-id="${tier.id}" value="${tier.tierName}" placeholder="Tên giải">
                <input type="text" class="prize-detail" data-id="${tier.id}" value="${tier.prizeDetail}" placeholder="Phần thưởng">
                <div class="custom-stepper-wrapper">
                    <input type="number" class="tier-quantity" data-id="${tier.id}" value="${tier.quantity}" min="1">
                    <div class="stepper-controls">
                        <button type="button" class="btn-step-tier up" data-id="${tier.id}"><i class="fa-solid fa-caret-up"></i></button>
                        <button type="button" class="btn-step-tier down" data-id="${tier.id}"><i class="fa-solid fa-caret-down"></i></button>
                    </div>
                </div>
                <button type="button" class="btn-delete-prize" data-id="${tier.id}" title="Xóa giải"><i class="fa-solid fa-trash"></i></button>
            `;
            list.appendChild(item);
        });

        // Event Listeners for Input changes
        list.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                const tier = this.prizeTiers.find(p => p.id === id);
                if (tier) {
                    if (e.target.classList.contains('tier-name')) tier.tierName = e.target.value;
                    if (e.target.classList.contains('prize-detail')) tier.prizeDetail = e.target.value;
                    if (e.target.classList.contains('tier-quantity')) tier.quantity = Math.max(1, parseInt(e.target.value) || 1);

                    this.savePrizes();
                    this.renderPrizeSelect();
                    // If modified currently selected tier, update heading/count
                    if (document.getElementById('prizeSelect').value == tier.id) {
                        document.getElementById('drawCount').value = tier.quantity;
                        document.getElementById('prizeHeading').textContent = `ĐANG QUAY ${tier.tierName.toUpperCase()}: ${tier.prizeDetail.toUpperCase()}`;
                    }
                }
            });
        });

        // Stepper Buttons
        list.querySelectorAll('.btn-step-tier').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const isUp = e.currentTarget.classList.contains('up');
                const tier = this.prizeTiers.find(p => p.id === id);
                if (tier) {
                    if (isUp) tier.quantity++;
                    else tier.quantity = Math.max(1, tier.quantity - 1);
                    this.savePrizes();
                    this.renderPrizeList();
                    this.renderPrizeSelect();
                    // Sync main board
                    if (document.getElementById('prizeSelect').value == tier.id) {
                        document.getElementById('drawCount').value = tier.quantity;
                    }
                }
            });
        });

        // Delete Buttons
        list.querySelectorAll('.btn-delete-prize').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                if (confirm("Chắc chắn xóa phần thưởng này?")) {
                    this.prizeTiers = this.prizeTiers.filter(p => p.id !== id);
                    this.savePrizes();
                    this.renderPrizeList();
                    this.renderPrizeSelect();
                    document.getElementById('prizeSelect').dispatchEvent(new Event('change'));
                }
            });
        });
    }

    savePrizes() {
        localStorage.setItem('randomGenPrizes', JSON.stringify(this.prizeTiers));
    }

    renderPrizeSelect() {
        const select = document.getElementById('prizeSelect');
        const currentVal = select.value;
        select.innerHTML = '';

        if (this.prizeTiers.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "Chưa thiết lập giải thưởng";
            select.appendChild(opt);
        } else {
            this.prizeTiers.forEach(tier => {
                const opt = document.createElement('option');
                opt.value = tier.id;
                opt.textContent = `${tier.tierName} - ${tier.prizeDetail} (x${tier.quantity})`;
                select.appendChild(opt);
            });
            // Restore selection if exists
            if (this.prizeTiers.find(p => p.id == currentVal)) {
                select.value = currentVal;
            }
        }
    }

    // --- AUDIO SYSTEM (Generated natively) ---
    playSound(type) {
        if (!this.soundEnabled) return;

        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        if (type === 'tick') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 0.05);
        } else if (type === 'win') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 1);
            oscillator.start();
            oscillator.stop(this.audioCtx.currentTime + 1);
        }
    }

    getValidNames(targetMode = null) {
        const source = targetMode === 'scratch' ? this.scratchTextArea.value : this.nameTextArea.value;
        return source.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    }

    getBlacklist() {
        const raw = document.getElementById('blacklist').value;
        return raw.split(',').map(v => v.trim()).filter(v => v.length > 0);
    }

    buildPool() {
        const pool = [];
        const blacklist = this.getBlacklist();
        const requireUnique = document.getElementById('uniqueToggle').checked;

        if (this.currentMode === 'number') {
            const min = parseInt(document.getElementById('numMin').value) || 0;
            const max = parseInt(document.getElementById('numMax').value) || 100;
            const filterOdd = document.getElementById('filterOdd').checked;
            const filterEven = document.getElementById('filterEven').checked;

            for (let i = min; i <= max; i++) {
                if (filterOdd && i % 2 === 0) continue;
                if (filterEven && i % 2 !== 0) continue;

                const strVal = i.toString();
                if (blacklist.includes(strVal)) continue;
                if (requireUnique && this.drawnPool.has(strVal)) continue;

                pool.push(strVal);
            }
        } else {
            const mode = this.currentMode === 'scratch' ? 'scratch' : 'name';
            const names = this.getValidNames(mode);
            for (const name of names) {
                if (blacklist.includes(name)) continue;
                // Đối với thẻ cào, luôn sinh ra tổng lượng thẻ dựa theo danh sách gốc, bỏ qua check Unique so với history cũ
                if (mode !== 'scratch' && requireUnique && this.drawnPool.has(name)) continue;

                pool.push(name);
            }
            
            // Generate numbers for Scratch Mode if inputs are provided
            if (mode === 'scratch') {
                const sMinRaw = document.getElementById('scratchNumMin').value;
                const sMaxRaw = document.getElementById('scratchNumMax').value;
                
                if (sMinRaw !== '' && sMaxRaw !== '') {
                    const min = parseInt(sMinRaw);
                    const max = parseInt(sMaxRaw);
                    const filterOdd = document.getElementById('scratchFilterOdd').checked;
                    const filterEven = document.getElementById('scratchFilterEven').checked;
                    
                    if (!isNaN(min) && !isNaN(max) && min <= max) {
                        for (let i = min; i <= max; i++) {
                            if (filterOdd && i % 2 === 0) continue;
                            if (filterEven && i % 2 !== 0) continue;
                            
                            const strVal = i.toString();
                            if (blacklist.includes(strVal)) continue;
                            // Scratch mode ignores requireUnique when generating grid
                            pool.push(strVal);
                        }
                    }
                }
            }
        }

        return pool;
    }

    async startSpinning() {
        if (this.isSpinning) return;

        const count = parseInt(document.getElementById('drawCount').value) || 1;

        // Ensure Audio context is resumed (browser policy workaround)
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        const pool = this.buildPool();

        if (pool.length < count) {
            alert(`Không đủ ô trống/kết quả hợp lệ để quay! Hiện có: ${pool.length}, Yêu cầu: ${count}`);
            return;
        }

        this.isSpinning = true;
        this.btnSpin.disabled = true;

        // Presentation effect - Dim UI
        this.appContainer.classList.add('presentation-mode');

        // Prepare display area
        this.resultDisplay.innerHTML = '';
        const slots = [];
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'result-item';
            el.textContent = '...';
            this.resultDisplay.appendChild(el);
            slots.push(el);
        }

        const finalResults = [];
        // Pull unique random indices for the final result
        const poolCopy = [...pool];
        for (let i = 0; i < count; i++) {
            const idx = CryptoRandomUtils.getRandomInt(0, poolCopy.length - 1);
            finalResults.push(poolCopy[idx]);
            poolCopy.splice(idx, 1); // remove from copy to prevent dupes in same draw
        }

        // --- Animation Engine (Odometer / Slot Machine logic) ---
        const spinDurationSec = parseFloat(document.getElementById('spinDuration').value) || 5;
        const DURATION = spinDurationSec * 1000; // ms
        const FRAMERATE = 1000 / 60;
        const totalFrames = DURATION / FRAMERATE;
        let frame = 0;
        let lastUpdateFrames = new Array(count).fill(0);

        const animate = () => {
            frame++;

            // Calculate linear progress and an ease-out curve progress
            const progress = frame / totalFrames;
            const easeOutProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            for (let i = 0; i < count; i++) {
                // Spread out the stops so that the very last one stops at exactly progress = 1.0 (no delay)
                const stopThreshold = 1.0 - ((count - 1 - i) * (0.1 / Math.max(1, count)));

                if (progress < stopThreshold) { // use linear progress so it spans the entire DURATION
                    // Decrease flashing text update frequency towards the end to simulate slowing down
                    const framesToWait = Math.floor(easeOutProgress * 8) + 1;
                    if (frame - lastUpdateFrames[i] >= framesToWait) {
                        slots[i].textContent = pool[CryptoRandomUtils.getRandomInt(0, pool.length - 1)];
                        lastUpdateFrames[i] = frame;
                        if (i === 0) this.playSound('tick');
                    }

                    // Performance check: removed dynamic CSS blur
                    slots[i].style.transform = `translateY(${CryptoRandomUtils.getRandomInt(-8, 8)}px)`;
                } else {
                    slots[i].textContent = finalResults[i];
                    slots[i].style.filter = 'none';
                    slots[i].style.transform = 'translateY(0)';
                }
            }

            if (frame < totalFrames) {
                requestAnimationFrame(animate);
            } else {
                this.finalizeSpin(slots, finalResults);
            }
        };

        requestAnimationFrame(animate);
    }

    finalizeSpin(slotElements, results) {
        this.playSound('win');

        // Apply winning CSS
        slotElements.forEach(el => el.classList.add('result-winner'));

        // Confetti!
        this.triggerConfetti();

        // Restore UI after a delay
        setTimeout(() => {
            this.appContainer.classList.remove('presentation-mode');
            this.isSpinning = false;
            this.btnSpin.disabled = false;
        }, 2000);

        // Save Results
        const requireUnique = document.getElementById('uniqueToggle').checked;
        const now = new Date().toLocaleString('vi-VN');

        const selectedTierId = parseInt(document.getElementById('prizeSelect').value);
        const selectedTier = this.prizeTiers.find(p => p.id === selectedTierId);
        const tierInfo = selectedTier ? `${selectedTier.tierName} (${selectedTier.prizeDetail})` : '';

        results.forEach(res => {
            if (requireUnique) this.drawnPool.add(res);
            this.history.unshift({
                time: now,
                mode: this.currentMode,
                tier: tierInfo,
                value: res
            });
        });

        this.saveHistory();
        this.renderHistory();
    }

    // --- SCRATCH CARD LOGIC ---
    generateScratchGrid() {
        if (this.isSpinning) return;

        // Ensure Audio context
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const pool = this.buildPool();
        if (pool.length === 0) {
            alert(`Không có giải thưởng trống để phát thẻ cào!`);
            return;
        }

        // Show grid
        document.getElementById('scratchGridWrapper').classList.remove('hidden');
        document.getElementById('scratchContainer').classList.add('hidden');

        // Populate grid
        const scratchGrid = document.getElementById('scratchGrid');
        scratchGrid.innerHTML = '';
        
        // Shuffle pool so cards are unpredictable instead of sequential
        const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

        // Render exactly as many cards as valid un-picked items in the pool
        shuffledPool.forEach((prizeValue, index) => {
            const card = document.createElement('div');
            card.className = 'mystery-card';
            card.innerHTML = `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; color: #cbd5e1;">
                    <i class="fa-solid fa-suitcase" style="font-size: 6.5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));"></i>
                    <span style="position: absolute; top: 55%; left: 50%; transform: translate(-50%, -50%); color: #1e293b; font-size: 2.5rem; font-weight: 800;">?</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                this.expandScratchCard(prizeValue, card);
            });
            
            scratchGrid.appendChild(card);
        });
    }

    expandScratchCard(finalResult, cardElement) {
        if (this.isSpinning) return;
        this.isSpinning = true;

        // Hide grid, show canvas
        document.getElementById('scratchGridWrapper').classList.add('hidden');
        document.getElementById('scratchContainer').classList.remove('hidden');

        // Set backend layer text
        document.getElementById('scratchPrizeText').textContent = finalResult;

        // Mark the card as done so it won't be clickable if navigated back
        cardElement.classList.add('scratched');

        // Setup the Canvas
        this.initScratchInteraction(finalResult);
    }

    initScratchInteraction(winningResult) {
        const canvas = document.getElementById('scratchCanvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const container = document.getElementById('scratchContainer');

        // Reset canvas state (remove fade)
        canvas.classList.remove('fade-out');

        const width = container.offsetWidth;
        const height = container.offsetHeight;
        canvas.width = width;
        canvas.height = height;

        // Draw silver coating
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 0, width, height);

        // Draw help text
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = '#4b5563';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CÀO 50% ĐỂ MỞ THẺ', width / 2, height / 2);

        let isDrawing = false;
        const brushRadius = 25;

        const getCoordinates = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const handleStart = (e) => {
            isDrawing = true;
            handleScratch(e);
        };

        const handleScratch = (e) => {
            if (!isDrawing) return;
            e.preventDefault(); // Prevent scroll on mobile

            const { x, y } = getCoordinates(e);

            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
            ctx.fill();
        };

        let revealed = false;

        const handleEnd = () => {
            if (!isDrawing || revealed) return;
            isDrawing = false;

            const imageData = ctx.getImageData(0, 0, width, height);
            const pixels = imageData.data;
            let transparentPixels = 0;
            const stride = 32;
            const totalSamplePixels = pixels.length / 4 / stride;

            for (let i = 0; i < pixels.length; i += 4 * stride) {
                if (pixels[i + 3] < 128) {
                    transparentPixels++;
                }
            }

            const clearedPercentage = (transparentPixels / totalSamplePixels) * 100;

            if (clearedPercentage > 50) {
                revealed = true;
                canvas.classList.add('fade-out');
                
                // Trigger win effects
                this.finalizeScratchSpin(winningResult);

                // Dettach events
                cleanupEvents();
            }
        };

        const cleanupEvents = () => {
            canvas.removeEventListener('mousedown', handleStart);
            canvas.removeEventListener('mousemove', handleScratch);
            canvas.removeEventListener('mouseup', handleEnd);
            canvas.removeEventListener('mouseleave', handleEnd);
            
            canvas.removeEventListener('touchstart', handleStart);
            canvas.removeEventListener('touchmove', handleScratch);
            canvas.removeEventListener('touchend', handleEnd);
        };

        // Attach fresh listeners
        canvas.addEventListener('mousedown', handleStart);
        canvas.addEventListener('mousemove', handleScratch);
        canvas.addEventListener('mouseup', handleEnd);
        canvas.addEventListener('mouseleave', handleEnd);
        
        canvas.addEventListener('touchstart', handleStart, { passive: false });
        canvas.addEventListener('touchmove', handleScratch, { passive: false });
        canvas.addEventListener('touchend', handleEnd);
    }

    finalizeScratchSpin(result) {
        this.playSound('win');
        this.triggerConfetti();

        // Release lock and show back button
        setTimeout(() => {
            this.isSpinning = false;
            const btnBackToGrid = document.getElementById('btnBackToGrid');
            const remainingCards = document.querySelectorAll('.mystery-card:not(.scratched)');
            
            // Check if it's the last card
            if (remainingCards.length === 0) {
                btnBackToGrid.innerHTML = 'KẾT THÚC <i class="fa-solid fa-flag-checkered"></i>';
                btnBackToGrid.style.background = '#e11d48'; // Red end color
            } else {
                btnBackToGrid.innerHTML = 'TIẾP TỤC CÀO <i class="fa-solid fa-rotate-left"></i>';
                btnBackToGrid.style.background = '#4b5563'; // Normal gray
            }

            btnBackToGrid.classList.remove('hidden');
        }, 1500);

        // Save Results
        const requireUnique = document.getElementById('uniqueToggle').checked;
        const now = new Date().toLocaleString('vi-VN');

        if (requireUnique) this.drawnPool.add(result);
        
        this.history.unshift({
            time: now,
            mode: 'MẢNG CÀO',
            tier: '', // No tier directly selectable in scratch since it has its own list for now
            value: result
        });

        this.saveHistory();
        this.renderHistory();
    }

    triggerConfetti() {
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        var interval = setInterval(function () {
            var timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }
            // Reduced particle count for performance
            var particleCount = 20 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: CryptoRandomUtils.getRandomInt(10, 30) / 100, y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: CryptoRandomUtils.getRandomInt(70, 90) / 100, y: Math.random() - 0.2 } }));
        }, 250);
    }

    saveHistory() {
        // Keep max 100 history items so localstorage doesn't bloat
        if (this.history.length > 100) this.history = this.history.slice(0, 100);
        localStorage.setItem('randomGenHistory', JSON.stringify(this.history));
    }

    renderHistory() {
        this.historyList.innerHTML = '';
        this.history.forEach(item => {
            const el = document.createElement('div');
            el.className = 'history-item';
            const modeText = item.mode === 'number' ? 'SỐ' : 'TÊN';
            const tierHTML = item.tier ? `<strong style="color:var(--primary); display:block; margin-bottom: 5px;">${item.tier}</strong>` : '';
            el.innerHTML = `
                ${tierHTML}
                <div class="history-time">${item.time} - [${modeText}]</div>
                <div class="history-val">${item.value}</div>
            `;
            this.historyList.appendChild(el);
        });
    }

    exportCSV() {
        if (this.history.length === 0) return alert('Không có lịch sử nào để xuất!');

        let csvContent = "Thời gian,Hạng giải,Chế độ,Kết quả\n";
        this.history.forEach(row => {
            const tierEscape = row.tier ? row.tier.replace(/"/g, '""') : '';
            csvContent += `"${row.time}","${tierEscape}","${row.mode === 'number' ? 'Số' : 'Tên'}","${row.value}"\n`;
        });

        // 1. Khởi tạo mảng byte BOM cho UTF-8
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);

        // 2. Nối mảng byte BOM này vào TRƯỚC chuỗi nội dung CSV khi tạo Blob
        const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // Tạo tên file chứa ngày tháng chuẩn
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const fileName = `Lich_Su_Quay_So_${dd}${mm}${yyyy}.csv`;

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link); // Required for FF
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RandomGeneratorApp();
});
