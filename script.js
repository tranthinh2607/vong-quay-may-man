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
        this.packOpeningInitialized = false;
        this.bindEvents();
        this.renderHistory();

        // Asynchronously prewarm pack engine during idle time to eliminate any first-load lag
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => this.prewarmPackOpening(), { timeout: 1500 });
        } else {
            setTimeout(() => this.prewarmPackOpening(), 600);
        }
    }

    initDOM() {
        this.appContainer = document.getElementById('appContainer');
        
        // Auto-collapse sidebars on mobile devices
        if (window.innerWidth <= 992) {
            this.appContainer.classList.add('left-collapsed', 'right-collapsed');
        }

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

        // Pack Opening Elements
        this.packOpeningContainer = document.getElementById('packOpeningContainer');
        this.packStage = document.getElementById('packStage');
        this.cardsStage = document.getElementById('cardsStage');
        this.summaryStage = document.getElementById('summaryStage');
        this.boosterPack = document.getElementById('boosterPack');
        this.packPerspectiveWrap = document.getElementById('packPerspectiveWrap');
        this.packTopCrimp = document.getElementById('packTopCrimp');
        this.tearGuide = document.getElementById('tearGuide');
        this.tearTrack = document.getElementById('tearTrack');
        this.tearProgressFill = document.getElementById('tearProgressFill');
        this.tearCutterHandle = document.getElementById('tearCutterHandle');
        this.tearPromptTag = document.getElementById('tearPromptTag');
        this.packBody = document.getElementById('packBody');
        this.packGlowBeam = document.getElementById('packGlowBeam');
        this.btnTearPack = document.getElementById('btnTearPack');
        this.packInitialActions = document.getElementById('packInitialActions');
        this.packTearFlash = document.getElementById('packTearFlash');
        this.cardStackViewport = document.getElementById('cardStackViewport');
        this.cardStack = document.getElementById('cardStack');
        this.cardProgressPill = document.getElementById('cardProgressPill');
        this.btnRevealAll = document.getElementById('btnRevealAll');
        this.cardHintText = document.getElementById('cardHintText');
        this.btnNextCard = document.getElementById('btnNextCard');
        this.btnViewStack = document.getElementById('btnViewStack');
        this.btnViewSpread = document.getElementById('btnViewSpread');
        this.btnActionFlip = document.getElementById('btnActionFlip');
        this.btnFinishSummary = document.getElementById('btnFinishSummary');
        this.summaryCardsGrid = document.getElementById('summaryCardsGrid');
        this.btnOpenNextPack = document.getElementById('btnOpenNextPack');
        this.btnReplayPack = document.getElementById('btnReplayPack');
        this.packsChooseStage = document.getElementById('packsChooseStage');
        this.packsShowcaseGrid = document.getElementById('packsShowcaseGrid');
        this.packsChooseTitle = document.getElementById('packsChooseTitle');
        this.packDisplayBtns = document.querySelectorAll('.pack-display-btn');
        this.packDisplayCountInput = document.getElementById('packDisplayCountInput');
        this.btnRerollPacks = document.getElementById('btnRerollPacks');
        this.btnBackToPacks = document.getElementById('btnBackToPacks');
        this.activePackBadge = document.getElementById('activePackBadge');
        this.packArtMascotImg = document.getElementById('packArtMascotImg');
        this.packCountBtns = document.querySelectorAll('.pack-count-btn');
        this.packCustomCountInput = document.getElementById('packCustomCountInput');
        this.packNamesList = document.getElementById('packNamesList');
        this.packNamesCount = document.getElementById('packNamesCount');
        this.btnLoadSampleNames = document.getElementById('btnLoadSampleNames');
        this.packSeriesTitle = document.getElementById('packSeriesTitle');
        this.packSubTitle = document.getElementById('packSubTitle');
        this.packBadgeCount = document.getElementById('packBadgeCount');
    }

    bindEvents() {
        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.isSpinning || this.isTearing) {
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

                if (this.packOpeningContainer) {
                    this.packOpeningContainer.classList.add('hidden');
                }

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
                    
                    this.btnSpin.classList.add('hidden');
                    document.getElementById('scratchActions').classList.remove('hidden');
                    spinConfigGroup.classList.add('hidden');
                    blacklistGroup.classList.add('hidden');
                    
                    const hasCards = document.querySelectorAll('.mystery-card').length > 0;
                    const remainingCards = document.querySelectorAll('.mystery-card:not(.scratched)').length;
                    
                    if (hasCards && remainingCards > 0) {
                        // Restore the grid view if there are still cards to scratch
                        document.getElementById('scratchGridWrapper').classList.remove('hidden');
                        scratchContainer.classList.add('hidden');
                        btnCreateScratch.classList.add('hidden');
                        document.getElementById('btnBackToGrid').classList.add('hidden');
                    } else {
                        // Reset to the initial state to create a new grid
                        document.getElementById('scratchGridWrapper').classList.add('hidden');
                        scratchContainer.classList.add('hidden');
                        btnCreateScratch.classList.remove('hidden');
                        btnCreateScratch.disabled = false;
                        document.getElementById('btnBackToGrid').classList.add('hidden');
                    }
                    spinConfigGroup.classList.add('hidden');
                    blacklistGroup.classList.add('hidden');
                } else if (this.currentMode === 'pack') {
                    if (!this.packOpeningInitialized) {
                        this.initPackOpening();
                    }

                    prizeSelectorWrapper.classList.add('hidden');
                    prizeHeading.style.display = 'none';
                    this.resultDisplay.classList.add('hidden');
                    document.getElementById('scratchGridWrapper').classList.add('hidden');
                    scratchContainer.classList.add('hidden');
                    document.getElementById('scratchActions').classList.add('hidden');
                    this.btnSpin.classList.add('hidden');
                    spinConfigGroup.classList.add('hidden');
                    blacklistGroup.classList.add('hidden');

                    if (this.packOpeningContainer) {
                        this.packOpeningContainer.classList.remove('hidden');
                        // Show 4-pack showcase if not currently in card reveal or summary
                        if (this.cardsStage && this.cardsStage.classList.contains('hidden') &&
                            this.summaryStage && this.summaryStage.classList.contains('hidden')) {
                            if (this.packStage && this.packStage.classList.contains('hidden')) {
                                if (this.packsChooseStage) this.packsChooseStage.classList.remove('hidden');
                            }
                        }
                    }
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

        const scratchFilterOdd = document.getElementById('scratchFilterOdd');
        const scratchFilterEven = document.getElementById('scratchFilterEven');
        scratchFilterOdd.addEventListener('change', () => { if (scratchFilterOdd.checked) scratchFilterEven.checked = false; });
        scratchFilterEven.addEventListener('change', () => { if (scratchFilterEven.checked) scratchFilterOdd.checked = false; });

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

        const gainNode = this.audioCtx.createGain();
        gainNode.connect(this.audioCtx.destination);

        if (type === 'tick' || type === 'win') {
            const oscillator = this.audioCtx.createOscillator();
            oscillator.connect(gainNode);

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
        } else if (type === 'scratch') {
            // Tearing / Scratching paper/cardboard effect
            const bufferSize = this.audioCtx.sampleRate * 0.12; 
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                // Chunky noise for grit and paper fibers breaking
                data[i] = (Math.random() * 2 - 1) * (Math.random() > 0.2 ? 1 : 0);
            }
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            // Bandpass filter sweeping downwards to simulate a quick "rip"
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            const startFreq = 1800 + Math.random() * 400;
            filter.frequency.setValueAtTime(startFreq, this.audioCtx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(250, this.audioCtx.currentTime + 0.12);
            filter.Q.value = 1.2;

            noise.connect(filter);
            filter.connect(gainNode);

            // Punchy attack with smooth fade out
            gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.8, this.audioCtx.currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.12);

            // Nasty sawtooth crunch at the bottom for thick ripping texture
            const osc = this.audioCtx.createOscillator();
            const oscGain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100 + Math.random() * 50, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(30, this.audioCtx.currentTime + 0.08);
            
            osc.connect(oscGain);
            oscGain.connect(this.audioCtx.destination);
            
            oscGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
            oscGain.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.01);
            oscGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

            osc.start(this.audioCtx.currentTime);
            osc.stop(this.audioCtx.currentTime + 0.08);
            
            noise.start(this.audioCtx.currentTime);
            noise.stop(this.audioCtx.currentTime + 0.12);
        } else if (type === 'packTear') {
            // Foil Crinkle / Metallic paper tear SFX
            const now = this.audioCtx.currentTime;
            const bufferSize = this.audioCtx.sampleRate * 0.45;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                // Crunchy metallic foil tear with crackling fiber bursts
                const crackle = Math.random() > 0.88 ? (Math.random() * 2 - 1) * 1.6 : (Math.random() * 2 - 1) * 0.4;
                data[i] = crackle;
            }
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3200, now);
            filter.frequency.exponentialRampToValueAtTime(550, now + 0.4);
            filter.Q.value = 3.2;

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.75, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.44);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            noise.start(now);
            noise.stop(now + 0.45);
        } else if (type === 'beamBurst') {
            // Radiant light beam whoosh
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const oscGain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(1400, now + 0.6);

            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(0.35, now + 0.1);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

            osc.connect(oscGain);
            oscGain.connect(this.audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.7);
        } else if (type === 'cardFlip') {
            // Quick card swish / paper whoosh
            const now = this.audioCtx.currentTime;
            const bufferSize = this.audioCtx.sampleRate * 0.14;
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.5;
            }
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(900, now);
            filter.frequency.exponentialRampToValueAtTime(2600, now + 0.07);
            filter.frequency.exponentialRampToValueAtTime(350, now + 0.14);
            filter.Q.value = 1.6;

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.6, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            noise.start(now);
            noise.stop(now + 0.14);
        } else if (type === 'holoShimmer') {
            // Sparkling crystal chimes
            const now = this.audioCtx.currentTime;
            const notes = [1318.51, 1567.98, 1975.53, 2637.02]; // E6, G6, B6, E7
            notes.forEach((freq, idx) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.06);

                gain.gain.setValueAtTime(0, now + idx * 0.06);
                gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.06 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.45);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now + idx * 0.06);
                osc.stop(now + idx * 0.06 + 0.45);
            });
        } else if (type === 'ultraReveal') {
            // Triumphant power chord + ascending glitter glissando
            const now = this.audioCtx.currentTime;
            const chord = [293.66, 369.99, 440.00, 587.33]; // D4, F#4, A4, D5
            chord.forEach(freq => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);

                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 1.2);
            });
            [1760, 2217, 2637, 3520].forEach((freq, idx) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + 0.2 + idx * 0.08);

                gain.gain.setValueAtTime(0, now + 0.2 + idx * 0.08);
                gain.gain.linearRampToValueAtTime(0.12, now + 0.2 + idx * 0.08 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2 + idx * 0.08 + 0.5);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now + 0.2 + idx * 0.08);
                osc.stop(now + 0.2 + idx * 0.08 + 0.5);
            });
        } else if (type === 'secretFanfare') {
            // Royal Victory Fanfare Trumpet melody (C5 - E5 - G5 - C6 - G5 - C6)
            const now = this.audioCtx.currentTime;
            const melody = [
                { f: 523.25, d: 0.12, t: 0.00 }, // C5
                { f: 659.25, d: 0.12, t: 0.12 }, // E5
                { f: 783.99, d: 0.14, t: 0.24 }, // G5
                { f: 1046.50, d: 0.35, t: 0.40 }, // C6
                { f: 783.99, d: 0.14, t: 0.80 }, // G5
                { f: 1046.50, d: 0.75, t: 0.95 }, // C6 final
            ];
            melody.forEach(note => {
                const osc = this.audioCtx.createOscillator();
                const filter = this.audioCtx.createBiquadFilter();
                const gain = this.audioCtx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(note.f, now + note.t);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(note.f * 3.5, now + note.t);

                gain.gain.setValueAtTime(0, now + note.t);
                gain.gain.linearRampToValueAtTime(0.24, now + note.t + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc.start(now + note.t);
                osc.stop(now + note.t + note.d);
            });
        } else if (type === 'deckShuffle') {
            // Tactile Card Deck Gathering & Riffle Shuffle SFX
            const now = this.audioCtx.currentTime;
            for (let i = 0; i < 4; i++) {
                const t = now + i * 0.055;
                const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.08);
                const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let j = 0; j < bufferSize; j++) {
                    data[j] = (Math.random() * 2 - 1) * 0.45;
                }
                const noise = this.audioCtx.createBufferSource();
                noise.buffer = buffer;
                const filter = this.audioCtx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1400 + i * 220, t);
                filter.Q.value = 2.2;

                const gain = this.audioCtx.createGain();
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.32, t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.audioCtx.destination);
                noise.start(t);
                noise.stop(t + 0.08);
            }
            // Final solid deck tap / snap
            const snapOsc = this.audioCtx.createOscillator();
            const snapGain = this.audioCtx.createGain();
            snapOsc.type = 'triangle';
            snapOsc.frequency.setValueAtTime(340, now + 0.22);
            snapOsc.frequency.exponentialRampToValueAtTime(90, now + 0.28);
            snapGain.gain.setValueAtTime(0.3, now + 0.22);
            snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);
            snapOsc.connect(snapGain);
            snapGain.connect(this.audioCtx.destination);
            snapOsc.start(now + 0.22);
            snapOsc.stop(now + 0.29);
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

        // Prepare display area without wiping the prizeHeading
        const slotsContainer = document.getElementById('slotsContainer');
        slotsContainer.innerHTML = '';
        const slots = [];

        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.className = 'result-item';
            slot.textContent = '...';
            slotsContainer.appendChild(slot);
            slots.push(slot);
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

        let lastSoundTime = 0;

        const handleScratch = (e) => {
            if (!isDrawing) return;
            e.preventDefault(); // Prevent scroll on mobile

            const { x, y } = getCoordinates(e);

            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
            ctx.fill();

            const now = Date.now();
            if (now - lastSoundTime > 80) { // Throttle sound
                this.playSound('scratch');
                lastSoundTime = now;
            }
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

            if (clearedPercentage > 40) {
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
            if (item.mode === 'MỞ PACK') {
                el.className = `history-item pack-history-item rarity-${item.rarity || 'common'}`;
                const rarityBadge = item.rarityBadge || '⚪ Thường';
                const tierName = item.tier || 'Gói Pokémon';
                el.innerHTML = `
                    <div class="history-pack-header">
                        <span class="history-rarity-badge ${item.rarity || 'common'}">${rarityBadge}</span>
                        <span class="history-pack-name">${tierName}</span>
                    </div>
                    <div class="history-time">${item.time} - [MỞ PACK]</div>
                    <div class="history-val">${item.value}</div>
                `;
            } else {
                el.className = 'history-item';
                const modeText = item.mode === 'number' ? 'SỐ' : (item.mode === 'scratch' || item.mode === 'MẢNG CÀO' ? 'THẺ CÀO' : 'TÊN');
                const tierHTML = item.tier ? `<strong style="color:var(--primary); display:block; margin-bottom: 5px;">${item.tier}</strong>` : '';
                el.innerHTML = `
                    ${tierHTML}
                    <div class="history-time">${item.time} - [${modeText}]</div>
                    <div class="history-val">${item.value}</div>
                `;
            }
            this.historyList.appendChild(el);
        });
    }

    exportCSV() {
        if (this.history.length === 0) return alert('Không có lịch sử nào để xuất!');

        let csvContent = "Thời gian,Hạng giải,Chế độ,Kết quả\n";
        this.history.forEach(row => {
            const tierEscape = row.tier ? row.tier.replace(/"/g, '""') : '';
            let modeDisplay = 'Số';
            if (row.mode === 'MỞ PACK') modeDisplay = 'Mở Pack';
            else if (row.mode === 'name') modeDisplay = 'Tên';
            else if (row.mode === 'scratch' || row.mode === 'MẢNG CÀO') modeDisplay = 'Thẻ cào';
            csvContent += `"${row.time}","${tierEscape}","${modeDisplay}","${row.value}"\n`;
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

    // ====================================================
    // POKÉMON BOOSTER PACK OPENING ENGINE
    // ====================================================

    prewarmPackOpening() {
        if (this.packOpeningInitialized) return;
        this.initPackOpening();

        // Preload the initial showcase mascot images so they appear with 0ms latency
        if (Array.isArray(this.displayedPacks)) {
            this.displayedPacks.forEach(packItem => {
                if (packItem && packItem.mascot && packItem.mascot.image) {
                    const img = new Image();
                    img.decoding = 'async';
                    img.src = packItem.mascot.image;
                }
            });
        }
    }

    initPackOpening() {
        if (this.packOpeningInitialized) return;
        this.packOpeningInitialized = true;

        this.packTheme = 'gold';
        this.packCardCount = 5;
        this.packsDisplayCount = 4;
        this.isTearing = false;
        this.currentPackCards = [];
        this.activeCardIndex = 0;
        this.revealedCardsCount = 0;
        this.maxRarity = 'common';
        this.displayedPacks = [];
        this.selectedPackData = null;

        this.initPackPools();
        this.bindPackEvents();
        this.setPackCount(5);
        this.generateShowcasePacks();
        this.updatePackNamesCount();
    }

    initPackPools() {
        const pokemonList = [
            { id: 1, name: "Bulbasaur" }, { id: 2, name: "Ivysaur" }, { id: 3, name: "Venusaur" },
            { id: 4, name: "Charmander" }, { id: 5, name: "Charmeleon" }, { id: 6, name: "Charizard" },
            { id: 7, name: "Squirtle" }, { id: 8, name: "Wartortle" }, { id: 9, name: "Blastoise" },
            { id: 10, name: "Caterpie" }, { id: 11, name: "Metapod" }, { id: 12, name: "Butterfree" },
            { id: 13, name: "Weedle" }, { id: 14, name: "Kakuna" }, { id: 15, name: "Beedrill" },
            { id: 16, name: "Pidgey" }, { id: 17, name: "Pidgeotto" }, { id: 18, name: "Pidgeot" },
            { id: 19, name: "Rattata" }, { id: 20, name: "Raticate" }, { id: 21, name: "Spearow" },
            { id: 22, name: "Fearow" }, { id: 23, name: "Ekans" }, { id: 24, name: "Arbok" },
            { id: 25, name: "Pikachu" }, { id: 26, name: "Raichu" }, { id: 27, name: "Sandshrew" },
            { id: 28, name: "Sandslash" }, { id: 29, name: "Nidoran♀" }, { id: 30, name: "Nidorina" },
            { id: 31, name: "Nidoqueen" }, { id: 32, name: "Nidoran♂" }, { id: 33, name: "Nidorino" },
            { id: 34, name: "Nidoking" }, { id: 35, name: "Clefairy" }, { id: 36, name: "Clefable" },
            { id: 37, name: "Vulpix" }, { id: 38, name: "Ninetales" }, { id: 39, name: "Jigglypuff" },
            { id: 40, name: "Wigglytuff" }, { id: 41, name: "Zubat" }, { id: 42, name: "Golbat" },
            { id: 43, name: "Oddish" }, { id: 44, name: "Gloom" }, { id: 45, name: "Vileplume" },
            { id: 46, name: "Paras" }, { id: 47, name: "Parasect" }, { id: 48, name: "Venonat" },
            { id: 49, name: "Venomoth" }, { id: 50, name: "Diglett" }, { id: 51, name: "Dugtrio" },
            { id: 52, name: "Meowth" }, { id: 53, name: "Persian" }, { id: 54, name: "Psyduck" },
            { id: 55, name: "Golduck" }, { id: 56, name: "Mankey" }, { id: 57, name: "Primeape" },
            { id: 58, name: "Growlithe" }, { id: 59, name: "Arcanine" }, { id: 60, name: "Poliwag" },
            { id: 61, name: "Poliwhirl" }, { id: 62, name: "Poliwrath" }, { id: 63, name: "Abra" },
            { id: 64, name: "Kadabra" }, { id: 65, name: "Alakazam" }, { id: 66, name: "Machop" },
            { id: 67, name: "Machoke" }, { id: 68, name: "Machamp" }, { id: 69, name: "Bellsprout" },
            { id: 70, name: "Weepinbell" }, { id: 71, name: "Victreebel" }, { id: 72, name: "Tentacool" },
            { id: 73, name: "Tentacruel" }, { id: 74, name: "Geodude" }, { id: 75, name: "Graveler" },
            { id: 76, name: "Golem" }, { id: 77, name: "Ponyta" }, { id: 78, name: "Rapidash" },
            { id: 79, name: "Slowpoke" }, { id: 80, name: "Slowbro" }, { id: 81, name: "Magnemite" },
            { id: 82, name: "Magneton" }, { id: 83, name: "Farfetch'd" }, { id: 84, name: "Doduo" },
            { id: 85, name: "Dodrio" }, { id: 86, name: "Seel" }, { id: 87, name: "Dewgong" },
            { id: 88, name: "Grimer" }, { id: 89, name: "Muk" }, { id: 90, name: "Shellder" },
            { id: 91, name: "Cloyster" }, { id: 92, name: "Gastly" }, { id: 93, name: "Haunter" },
            { id: 94, name: "Gengar" }, { id: 95, name: "Onix" }, { id: 96, name: "Drowzee" },
            { id: 97, name: "Hypno" }, { id: 98, name: "Krabby" }, { id: 99, name: "Kingler" },
            { id: 100, name: "Voltorb" }, { id: 101, name: "Electrode" }, { id: 102, name: "Exeggcute" },
            { id: 103, name: "Exeggutor" }, { id: 104, name: "Cubone" }, { id: 105, name: "Marowak" },
            { id: 106, name: "Hitmonlee" }, { id: 107, name: "Hitmonchan" }, { id: 108, name: "Lickitung" },
            { id: 109, name: "Koffing" }, { id: 110, name: "Weezing" }, { id: 111, name: "Rhyhorn" },
            { id: 112, name: "Rhydon" }, { id: 113, name: "Chansey" }, { id: 114, name: "Tangela" },
            { id: 115, name: "Kangaskhan" }, { id: 116, name: "Horsea" }, { id: 117, name: "Seadra" },
            { id: 118, name: "Goldeen" }, { id: 119, name: "Seaking" }, { id: 120, name: "Staryu" },
            { id: 121, name: "Starmie" }, { id: 122, name: "Mr. Mime" }, { id: 123, name: "Scyther" },
            { id: 124, name: "Jynx" }, { id: 125, name: "Electabuzz" }, { id: 126, name: "Magmar" },
            { id: 127, name: "Pinsir" }, { id: 128, name: "Tauros" }, { id: 129, name: "Magikarp" },
            { id: 130, name: "Gyarados" }, { id: 131, name: "Lapras" }, { id: 132, name: "Ditto" },
            { id: 133, name: "Eevee" }, { id: 134, name: "Vaporeon" }, { id: 135, name: "Jolteon" },
            { id: 136, name: "Flareon" }, { id: 137, name: "Porygon" }, { id: 138, name: "Omanyte" },
            { id: 139, name: "Omastar" }, { id: 140, name: "Kabuto" }, { id: 141, name: "Kabutops" },
            { id: 142, name: "Aerodactyl" }, { id: 143, name: "Snorlax" }, { id: 144, name: "Articuno" },
            { id: 145, name: "Zapdos" }, { id: 146, name: "Moltres" }, { id: 147, name: "Dratini" },
            { id: 148, name: "Dragonair" }, { id: 149, name: "Dragonite" }, { id: 150, name: "Mewtwo" },
            { id: 151, name: "Mew" },
            { id: 152, name: "Chikorita" }, { id: 155, name: "Cyndaquil" }, { id: 158, name: "Totodile" },
            { id: 172, name: "Pichu" }, { id: 175, name: "Togepi" }, { id: 179, name: "Mareep" },
            { id: 183, name: "Marill" }, { id: 196, name: "Espeon" }, { id: 197, name: "Umbreon" },
            { id: 202, name: "Wobbuffet" }, { id: 212, name: "Scizor" }, { id: 214, name: "Heracross" },
            { id: 216, name: "Teddiursa" }, { id: 249, name: "Lugia" }, { id: 250, name: "Ho-Oh" },
            { id: 251, name: "Celebi" }, { id: 252, name: "Treecko" }, { id: 255, name: "Torchic" },
            { id: 258, name: "Mudkip" }, { id: 280, name: "Ralts" }, { id: 282, name: "Gardevoir" },
            { id: 300, name: "Skitty" }, { id: 302, name: "Sableye" }, { id: 359, name: "Absol" },
            { id: 380, name: "Latias" }, { id: 381, name: "Latios" }, { id: 382, name: "Kyogre" },
            { id: 383, name: "Groudon" }, { id: 384, name: "Rayquaza" }, { id: 385, name: "Jirachi" },
            { id: 387, name: "Turtwig" }, { id: 390, name: "Chimchar" }, { id: 393, name: "Piplup" },
            { id: 403, name: "Shinx" }, { id: 447, name: "Riolu" }, { id: 448, name: "Lucario" },
            { id: 470, name: "Leafeon" }, { id: 471, name: "Glaceon" }, { id: 492, name: "Shaymin" },
            { id: 493, name: "Arceus" }, { id: 494, name: "Victini" }, { id: 501, name: "Oshawott" },
            { id: 570, name: "Zorua" }, { id: 571, name: "Zoroark" }, { id: 658, name: "Greninja" },
            { id: 700, name: "Sylveon" }, { id: 778, name: "Mimikyu" }, { id: 810, name: "Grookey" },
            { id: 813, name: "Scorbunny" }, { id: 816, name: "Sobble" }, { id: 888, name: "Zacian" },
            { id: 906, name: "Sprigatito" }, { id: 909, name: "Fuecoco" }, { id: 912, name: "Quaxly" }
        ];

        this.cuteMascotsPool = pokemonList.map(p => ({
            id: p.id,
            name: p.name,
            image: `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${p.id}.png`,
            fallbackImage: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`
        }));
    }

    generateThemesPool(count) {
        const baseThemes = [
            { key: 'gold', name: 'Gói Vàng Kim', series: 'LUCKY GOLD', sub: 'Phiên Bản Hoàng Kim', gradient: 'linear-gradient(145deg, #451a03 0%, #92400e 30%, #f59e0b 70%, #fef08a 100%)', glow: 'rgba(245, 158, 11, 0.5)', pillBg: 'rgba(180, 83, 9, 0.85)', pillBorder: '#fef08a' },
            { key: 'red', name: 'Gói Đỏ Hỏa Long', series: 'CRIMSON BLAZE', sub: 'Phiên Bản Hỏa Long', gradient: 'linear-gradient(145deg, #450a0a 0%, #991b1b 30%, #ef4444 70%, #fca5a5 100%)', glow: 'rgba(239, 68, 68, 0.5)', pillBg: 'rgba(153, 27, 27, 0.85)', pillBorder: '#fca5a5' },
            { key: 'blue', name: 'Gói Hải Dương', series: 'OCEAN WAVE', sub: 'Phiên Bản Hải Dương', gradient: 'linear-gradient(145deg, #0f172a 0%, #1e40af 30%, #3b82f6 70%, #93c5fd 100%)', glow: 'rgba(59, 130, 246, 0.5)', pillBg: 'rgba(30, 64, 175, 0.85)', pillBorder: '#93c5fd' },
            { key: 'green', name: 'Gói Lục Bảo', series: 'EMERALD GROVE', sub: 'Phiên Bản Lục Bảo', gradient: 'linear-gradient(145deg, #022c22 0%, #065f46 30%, #10b981 70%, #6ee7b7 100%)', glow: 'rgba(16, 185, 129, 0.5)', pillBg: 'rgba(6, 95, 70, 0.85)', pillBorder: '#6ee7b7' },
            { key: 'purple', name: 'Gói Tím Vũ Trụ', series: 'COSMIC MYSTIC', sub: 'Phiên Bản Vũ Trụ', gradient: 'linear-gradient(145deg, #2e1065 0%, #581c87 30%, #a855f7 70%, #d8b4fe 100%)', glow: 'rgba(168, 85, 247, 0.5)', pillBg: 'rgba(88, 28, 135, 0.85)', pillBorder: '#d8b4fe' },
            { key: 'pink', name: 'Gói Hồng Anh Đào', series: 'SAKURA DREAMS', sub: 'Phiên Bản Ngọt Ngào', gradient: 'linear-gradient(145deg, #4c0519 0%, #9d174d 30%, #f43f5e 70%, #fbcfe8 100%)', glow: 'rgba(244, 63, 94, 0.5)', pillBg: 'rgba(157, 23, 77, 0.85)', pillBorder: '#fbcfe8' },
            { key: 'cyan', name: 'Gói Băng Tuyết', series: 'GLACIER ICE', sub: 'Phiên Bản Băng Giá', gradient: 'linear-gradient(145deg, #083344 0%, #0e7490 30%, #06b6d4 70%, #a5f3fc 100%)', glow: 'rgba(6, 182, 212, 0.5)', pillBg: 'rgba(14, 116, 144, 0.85)', pillBorder: '#a5f3fc' },
            { key: 'orange', name: 'Gói Cam Mặt Trời', series: 'SOLAR FLARE', sub: 'Phiên Bản Mặt Trời', gradient: 'linear-gradient(145deg, #431407 0%, #9a3412 30%, #f97316 70%, #fed7aa 100%)', glow: 'rgba(249, 115, 22, 0.5)', pillBg: 'rgba(154, 52, 18, 0.85)', pillBorder: '#fed7aa' },
            { key: 'silver', name: 'Gói Bạch Kim', series: 'PLATINUM SHINE', sub: 'Phiên Bản Bạch Kim', gradient: 'linear-gradient(145deg, #1e293b 0%, #475569 30%, #94a3b8 70%, #f1f5f9 100%)', glow: 'rgba(203, 213, 225, 0.5)', pillBg: 'rgba(71, 85, 105, 0.85)', pillBorder: '#f1f5f9' },
            { key: 'dark', name: 'Gói Hắc Ám VIP', series: 'SHADOW OBSIDIAN', sub: 'Phiên Bản Bóng Đêm', gradient: 'linear-gradient(145deg, #09090b 0%, #18181b 30%, #3f3f46 70%, #71717a 100%)', glow: 'rgba(113, 113, 122, 0.5)', pillBg: 'rgba(24, 24, 27, 0.85)', pillBorder: '#a1a1aa' },
            { key: 'lime', name: 'Gói Xanh Neon', series: 'CYBER LIME', sub: 'Phiên Bản Công Nghệ', gradient: 'linear-gradient(145deg, #052e16 0%, #166534 30%, #84cc16 70%, #d9f99d 100%)', glow: 'rgba(132, 204, 22, 0.5)', pillBg: 'rgba(21, 128, 61, 0.85)', pillBorder: '#d9f99d' },
            { key: 'bronze', name: 'Gói Đồng Cổ Điển', series: 'ANCIENT BRONZE', sub: 'Phiên Bản Cổ Điển', gradient: 'linear-gradient(145deg, #291204 0%, #78350f 30%, #d97706 70%, #fde68a 100%)', glow: 'rgba(217, 119, 6, 0.5)', pillBg: 'rgba(120, 53, 15, 0.85)', pillBorder: '#fde68a' }
        ];

        const themes = [...baseThemes];
        const goldenRatio = 137.50776405;

        for (let i = baseThemes.length; i < count; i++) {
            const hue = Math.round((i * goldenRatio) % 360);
            const hue2 = (hue + 20) % 360;
            const hue3 = (hue + 45) % 360;

            let titleVi = 'Gói Sắc Màu';
            let seriesEn = 'PRISMATIC EDITION';
            if (hue >= 345 || hue < 15) { titleVi = 'Gói Hồng Ngọc'; seriesEn = 'RUBY FLAME'; }
            else if (hue < 40) { titleVi = 'Gói Hỏa Long'; seriesEn = 'CRIMSON BLAZE'; }
            else if (hue < 65) { titleVi = 'Gói Hổ Phách'; seriesEn = 'SOLAR AMBER'; }
            else if (hue < 90) { titleVi = 'Gói Hoàng Kim'; seriesEn = 'LUCKY GOLD'; }
            else if (hue < 130) { titleVi = 'Gói Xanh Lime'; seriesEn = 'CYBER LIME'; }
            else if (hue < 165) { titleVi = 'Gói Lục Bảo'; seriesEn = 'EMERALD GROVE'; }
            else if (hue < 190) { titleVi = 'Gói Ngọc Bích'; seriesEn = 'AQUA JADE'; }
            else if (hue < 225) { titleVi = 'Gói Băng Tuyết'; seriesEn = 'GLACIER CYAN'; }
            else if (hue < 255) { titleVi = 'Gói Hải Dương'; seriesEn = 'OCEAN WAVE'; }
            else if (hue < 280) { titleVi = 'Gói Lam Bảo'; seriesEn = 'SAPPHIRE DEEP'; }
            else if (hue < 315) { titleVi = 'Gói Tím Vũ Trụ'; seriesEn = 'COSMIC VOID'; }
            else { titleVi = 'Gói Hoa Anh Đào'; seriesEn = 'SAKURA BLOOM'; }

            themes.push({
                key: `custom_${i}`,
                name: `${titleVi} #${i + 1}`,
                series: seriesEn,
                sub: `Phiên Bản May Mắn`,
                gradient: `linear-gradient(145deg, hsl(${hue}, 75%, 14%) 0%, hsl(${hue2}, 80%, 28%) 30%, hsl(${hue3}, 85%, 52%) 70%, hsl(${hue}, 90%, 82%) 100%)`,
                glow: `hsla(${hue}, 85%, 55%, 0.5)`,
                pillBg: `hsla(${hue}, 75%, 22%, 0.88)`,
                pillBorder: `hsl(${hue}, 90%, 75%)`
            });
        }

        return themes;
    }

    shuffleArray(array) {
        const copy = [...array];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = CryptoRandomUtils.getRandomInt(0, i);
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    generateShowcasePacks() {
        const count = Math.max(1, Math.min(200, this.packsDisplayCount || 4));
        const generatedThemes = this.generateThemesPool(count);
        const shuffledThemes = this.shuffleArray(generatedThemes);
        const shuffledMascots = this.shuffleArray(this.cuteMascotsPool);

        this.displayedPacks = [];
        for (let i = 0; i < count; i++) {
            const theme = shuffledThemes[i % shuffledThemes.length];
            const mascot = shuffledMascots[i % shuffledMascots.length];
            this.displayedPacks.push({
                index: i,
                theme: theme,
                mascot: mascot
            });
        }

        if (this.packsChooseTitle) {
            this.packsChooseTitle.innerHTML = `<i class="fa-solid fa-sparkles"></i> CHỌN 1 TRONG ${count} GÓI BÀI MAY MẮN`;
        }

        this.renderShowcasePacks();
    }

    renderShowcasePacks() {
        if (!this.packsShowcaseGrid) return;

        const fragment = document.createDocumentFragment();

        this.displayedPacks.forEach((packItem, idx) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'pack-showcase-card booster-pack-card';
            cardEl.dataset.theme = packItem.theme.key;
            cardEl.dataset.index = idx;

            // Apply dynamic metallic gradient and glow
            if (packItem.theme.gradient) {
                cardEl.style.background = packItem.theme.gradient;
            }
            if (packItem.theme.glow) {
                cardEl.style.boxShadow = `0 12px 28px rgba(0, 0, 0, 0.6), 0 0 20px ${packItem.theme.glow}`;
            }

            const pillStyle = packItem.theme.pillBg ? `style="background: ${packItem.theme.pillBg}; border-color: ${packItem.theme.pillBorder};"` : '';
            const fallbackSrc = packItem.mascot.fallbackImage || '';

            cardEl.innerHTML = `
                <div class="pack-card-crimp crimp-top"></div>
                <div class="pack-card-body">
                    <div class="pack-card-topbar">
                        <span class="pack-theme-pill ${packItem.theme.pillClass || ''}" ${pillStyle}>${packItem.theme.name}</span>
                        <span class="pack-card-count-badge showcase-count-badge">${this.packCardCount} THẺ</span>
                    </div>
                    <div class="pack-card-mascot">
                        <div class="mascot-shimmer-placeholder"></div>
                        <img src="${packItem.mascot.image}" alt="${packItem.mascot.name}" decoding="async" loading="lazy" onload="this.classList.add('loaded'); const p = this.previousElementSibling; if (p) p.style.opacity = '0';" onerror="this.onerror=null; if ('${fallbackSrc}') this.src='${fallbackSrc}'; this.classList.add('loaded');">
                    </div>
                    <div class="pack-card-footer">
                        <div class="pack-card-title">${packItem.theme.series}</div>
                        <div class="pack-card-sub">${packItem.mascot.name} Edition</div>
                        <button type="button" class="btn-select-pack"><i class="fa-solid fa-hand-pointer"></i> CHỌN GÓI NÀY</button>
                    </div>
                </div>
                <div class="pack-card-crimp crimp-bottom"></div>
            `;

            cardEl.addEventListener('click', () => {
                this.choosePackByData(packItem);
            });

            const btn = cardEl.querySelector('.btn-select-pack');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.choosePackByData(packItem);
                });
            }

            fragment.appendChild(cardEl);
        });

        this.packsShowcaseGrid.innerHTML = '';
        this.packsShowcaseGrid.appendChild(fragment);

        // Immediate check: if image is already cached by browser, reveal without waiting
        this.packsShowcaseGrid.querySelectorAll('.pack-card-mascot img').forEach(img => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('loaded');
                const p = img.previousElementSibling;
                if (p) p.style.opacity = '0';
            }
        });
    }

    choosePackByData(packItem) {
        if (!packItem) return;
        this.selectedPackData = packItem;
        this.packTheme = packItem.theme.key;

        if (this.boosterPack) {
            this.boosterPack.dataset.theme = packItem.theme.key;
            if (packItem.theme.glow) {
                this.boosterPack.style.boxShadow = `0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 45px ${packItem.theme.glow}`;
            } else {
                this.boosterPack.style.boxShadow = '';
            }
        }
        if (this.packBody) {
            if (packItem.theme.gradient) {
                this.packBody.style.background = packItem.theme.gradient;
            } else {
                this.packBody.style.background = '';
            }
        }
        if (this.packArtMascotImg) {
            this.packArtMascotImg.decoding = 'async';
            this.packArtMascotImg.src = packItem.mascot.image;
            this.packArtMascotImg.alt = packItem.mascot.name;
            this.packArtMascotImg.onerror = () => {
                if (packItem.mascot.fallbackImage) {
                    this.packArtMascotImg.src = packItem.mascot.fallbackImage;
                }
            };
        }
        if (this.packSeriesTitle) {
            this.packSeriesTitle.textContent = packItem.theme.series;
        }
        if (this.packSubTitle) {
            this.packSubTitle.textContent = `${packItem.mascot.name} Edition`;
        }
        if (this.activePackBadge) {
            this.activePackBadge.textContent = `${packItem.theme.name} - ${packItem.mascot.name}`;
        }
        if (this.packBadgeCount) {
            this.packBadgeCount.textContent = `${this.packCardCount} THẺ`;
        }

        if (this.packsChooseStage) this.packsChooseStage.classList.add('hidden');
        if (this.packStage) this.packStage.classList.remove('hidden');
        if (this.cardsStage) this.cardsStage.classList.add('hidden');
        if (this.summaryStage) this.summaryStage.classList.add('hidden');

        // Reset tear visuals on the selected pack
        if (this.packTopCrimp) this.packTopCrimp.classList.remove('torn');
        if (this.packGlowBeam) this.packGlowBeam.className = 'pack-glow-beam';
        if (this.packBody) this.packBody.classList.remove('sliding');
        if (this.packInitialActions) this.packInitialActions.classList.remove('hiding');
        if (this.boosterPack) this.boosterPack.classList.remove('is-tearing-impact');
        if (this.tearCutterHandle) this.tearCutterHandle.style.left = '0px';
        if (this.tearProgressFill) this.tearProgressFill.style.width = '0%';
        this.isTearing = false;

        this.playSound('tick');
    }

    initPokemonDeck() {
        // Deck items are dynamically generated from user prizes in drawCardForTheme
    }

    bindPackEvents() {
        // Back to packs selection
        if (this.btnBackToPacks) {
            this.btnBackToPacks.addEventListener('click', () => {
                this.backToPackSelection();
            });
        }

        // Pack Display Count selector buttons (4 Gói, 6 Gói, 8 Gói)
        if (this.packDisplayBtns) {
            this.packDisplayBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.packDisplayBtns.forEach(b => b.classList.remove('active'));
                    const countBtn = e.currentTarget;
                    countBtn.classList.add('active');
                    const count = parseInt(countBtn.dataset.count) || 4;
                    if (this.packDisplayCountInput) this.packDisplayCountInput.value = count;
                    this.packsDisplayCount = count;
                    this.generateShowcasePacks();
                    this.playSound('tick');
                });
            });
        }

        // Pack Display Count Input (or custom stepper)
        if (this.packDisplayCountInput) {
            this.packDisplayCountInput.addEventListener('input', (e) => {
                let val = parseInt(e.target.value) || 1;
                if (val < 1) val = 1;
                if (val > 200) val = 200;
                if (this.packDisplayBtns) {
                    this.packDisplayBtns.forEach(b => {
                        if (parseInt(b.dataset.count) === val) {
                            b.classList.add('active');
                        } else {
                            b.classList.remove('active');
                        }
                    });
                }
                this.packsDisplayCount = val;
                this.generateShowcasePacks();
            });
        }

        // Reroll packs button (shuffle random packs)
        if (this.btnRerollPacks) {
            this.btnRerollPacks.addEventListener('click', () => {
                this.generateShowcasePacks();
                this.playSound('whoosh');
            });
        }

        // Count selector buttons (3 Cards, 5 Cards, Custom)
        if (this.packCountBtns) {
            this.packCountBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.packCountBtns.forEach(b => b.classList.remove('active'));
                    const countBtn = e.currentTarget;
                    countBtn.classList.add('active');
                    const count = parseInt(countBtn.dataset.count) || 5;
                    if (this.packCustomCountInput) this.packCustomCountInput.value = count;
                    this.setPackCount(count);
                });
            });
        }

        // Custom card count input stepper
        if (this.packCustomCountInput) {
            this.packCustomCountInput.addEventListener('input', (e) => {
                let val = parseInt(e.target.value) || 1;
                if (val < 1) val = 1;
                if (val > 50) val = 50;
                if (this.packCountBtns) {
                    this.packCountBtns.forEach(b => {
                        if (parseInt(b.dataset.count) === val) {
                            b.classList.add('active');
                        } else {
                            b.classList.remove('active');
                        }
                    });
                }
                this.setPackCount(val);
            });
        }

        // Names List text area input listener
        if (this.packNamesList) {
            this.packNamesList.addEventListener('input', () => {
                this.updatePackNamesCount();
            });
        }

        // Load Sample Names button
        if (this.btnLoadSampleNames) {
            this.btnLoadSampleNames.addEventListener('click', () => {
                if (this.packNamesList) {
                    this.packNamesList.value = [
                        "Giải Đặc Biệt - iPhone 16 Pro Max",
                        "Giải Nhất - iPad Air M2",
                        "Giải Nhì - Apple Watch Series 10",
                        "Giải Ba - AirPods Pro 2",
                        "Voucher Mua Sắm 1.000.000đ",
                        "Voucher Mua Sắm 500.000đ",
                        "Thẻ Cào Điện Thoại 200k",
                        "Hộp Quà Bí Ẩn VIP",
                        "Thẻ Quà Tặng 100k",
                        "Chúc Bạn May Mắn Lần Sau"
                    ].join('\n');
                    this.updatePackNamesCount();
                }
            });
        }

        // 3D Parallax Tilt for Booster Pack
        this.setupPack3DParallax();

        // Drag & Swipe horizontal tear pack
        this.setupPackSwipeTear();

        // View Mode Switchers
        if (this.btnViewStack) {
            this.btnViewStack.addEventListener('click', () => {
                this.handleStackButtonClick();
            });
        }
        if (this.btnViewSpread) {
            this.btnViewSpread.addEventListener('click', () => {
                this.playSound('cardFlip');
                this.setViewMode('spread');
            });
        }

        // Wide interactive viewport click zone for opening/flipping cards
        if (this.cardStackViewport) {
            this.cardStackViewport.addEventListener('click', (e) => {
                if (this.cardsViewMode === 'stack') {
                    // Do not trigger if user clicks an interactive control button
                    if (e.target.closest('button') || e.target.closest('.cards-view-controls') || e.target.closest('.card-footer-btns') || e.target.closest('.pokemon-card')) {
                        return;
                    }
                    this.handleCardClick(this.activeCardIndex);
                }
            });
        }

        // Action Flip Button
        if (this.btnActionFlip) {
            this.btnActionFlip.addEventListener('click', () => {
                this.flipCardByIndex(this.activeCardIndex);
            });
        }

        // Finish Summary Button
        if (this.btnFinishSummary) {
            this.btnFinishSummary.addEventListener('click', () => {
                this.showSummary();
            });
        }

        // Reveal All Button
        if (this.btnRevealAll) {
            this.btnRevealAll.addEventListener('click', () => {
                this.revealAllCards();
            });
        }

        // Next Card Button
        if (this.btnNextCard) {
            this.btnNextCard.addEventListener('click', () => {
                this.nextCard();
            });
        }

        // Open Next Pack Button
        if (this.btnOpenNextPack) {
            this.btnOpenNextPack.addEventListener('click', () => {
                this.resetPackOpening();
            });
        }

        // Replay Pack Button
        if (this.btnReplayPack) {
            this.btnReplayPack.addEventListener('click', () => {
                this.replayPackCards();
            });
        }
    }

    choosePack(theme) {
        let packItem = this.displayedPacks ? this.displayedPacks.find(p => p.theme.key === theme) : null;
        if (!packItem && this.packThemesPool) {
            const foundTheme = this.packThemesPool.find(t => t.key === theme) || this.packThemesPool[0];
            const foundMascot = (this.cuteMascotsPool && this.cuteMascotsPool[0]) || {
                name: 'Pikachu',
                image: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/25.png',
                fallbackImage: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png'
            };
            packItem = { index: 0, theme: foundTheme, mascot: foundMascot };
        }
        this.choosePackByData(packItem);
    }

    backToPackSelection() {
        if (this.packStage) this.packStage.classList.add('hidden');
        if (this.cardsStage) this.cardsStage.classList.add('hidden');
        if (this.summaryStage) this.summaryStage.classList.add('hidden');
        if (this.packsChooseStage) this.packsChooseStage.classList.remove('hidden');
        if (this.packInitialActions) this.packInitialActions.classList.remove('hiding');
        if (this.boosterPack) this.boosterPack.classList.remove('is-tearing-impact');
        this.isTearing = false;
        this.playSound('tick');
    }

    setPackTheme(theme) {
        this.packTheme = theme || 'gold';
        if (this.boosterPack) {
            this.boosterPack.dataset.theme = this.packTheme;
        }

        const foundTheme = this.packThemesPool ? this.packThemesPool.find(t => t.key === this.packTheme) : null;
        if (foundTheme) {
            if (this.packSeriesTitle) this.packSeriesTitle.textContent = foundTheme.series;
            if (this.packSubTitle) this.packSubTitle.textContent = foundTheme.sub;
            if (this.activePackBadge) this.activePackBadge.textContent = foundTheme.name;
        }
    }

    setPackCount(count) {
        this.packCardCount = count;
        if (this.packBadgeCount) {
            this.packBadgeCount.textContent = `${count} THẺ`;
        }
        if (this.packsShowcaseGrid) {
            this.packsShowcaseGrid.querySelectorAll('.showcase-count-badge').forEach(b => {
                b.textContent = `${count} THẺ`;
            });
        }
    }

    getValidPackNames() {
        if (!this.packNamesList) return [];
        return this.packNamesList.value
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
    }

    updatePackNamesCount() {
        if (this.packNamesCount) {
            const count = this.getValidPackNames().length;
            this.packNamesCount.textContent = `${count} mục`;
        }
    }

    setupPack3DParallax() {
        if (!this.packPerspectiveWrap) return;

        const onMove = (e) => {
            if (this.isTearing) return;
            const rect = this.packPerspectiveWrap.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            if (!clientX || !clientY) return;

            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

            const tiltX = (y - 0.5) * -18;
            const tiltY = (x - 0.5) * 18;

            if (this.boosterPack) {
                this.boosterPack.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
            }
        };

        const onLeave = () => {
            if (this.boosterPack) {
                this.boosterPack.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
            }
        };

        this.packPerspectiveWrap.addEventListener('mousemove', onMove);
        this.packPerspectiveWrap.addEventListener('mouseleave', onLeave);
        this.packPerspectiveWrap.addEventListener('touchmove', onMove, { passive: true });
        this.packPerspectiveWrap.addEventListener('touchend', onLeave);
    }

    setupPackSwipeTear() {
        let isDragging = false;
        let startX = 0;
        let currentX = 0;

        const getTrackBounds = () => {
            if (this.tearTrack) {
                const rect = this.tearTrack.getBoundingClientRect();
                return { left: rect.left, width: rect.width || 240 };
            }
            if (this.packTopCrimp) {
                const rect = this.packTopCrimp.getBoundingClientRect();
                return { left: rect.left, width: rect.width || 240 };
            }
            return { left: 0, width: 240 };
        };

        const updateProgress = (ratio) => {
            const clamped = Math.max(0, Math.min(1, ratio));
            const bounds = getTrackBounds();
            const cutterWidth = (this.tearCutterHandle && this.tearCutterHandle.offsetWidth) || 44;
            const maxTravel = Math.max(0, bounds.width - cutterWidth);
            const leftPx = clamped * maxTravel;

            if (this.tearCutterHandle) {
                this.tearCutterHandle.style.left = `${leftPx}px`;
            }
            if (this.tearProgressFill) {
                this.tearProgressFill.style.width = `${clamped * 100}%`;
            }
        };

        const onStart = (e) => {
            if (this.isTearing) return;
            const pointer = e.touches ? e.touches[0] : e;
            isDragging = true;
            startX = pointer.clientX;
            currentX = pointer.clientX;

            if (this.tearGuide) this.tearGuide.classList.add('is-dragging');
            if (this.tearTrack) this.tearTrack.classList.add('is-dragging');

            const bounds = getTrackBounds();
            const ratio = (pointer.clientX - bounds.left) / bounds.width;
            updateProgress(ratio);
        };

        const onMove = (e) => {
            if (!isDragging || this.isTearing) return;
            const pointer = e.touches ? e.touches[0] : e;
            currentX = pointer.clientX;

            const bounds = getTrackBounds();
            const ratio = (currentX - bounds.left) / bounds.width;
            updateProgress(ratio);

            // Trigger automatically when dragged past 60%
            if (ratio >= 0.60) {
                isDragging = false;
                if (this.tearGuide) this.tearGuide.classList.remove('is-dragging');
                if (this.tearTrack) this.tearTrack.classList.remove('is-dragging');
                updateProgress(1);
                this.startPackTear();
            }
        };

        const onEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            if (this.tearGuide) this.tearGuide.classList.remove('is-dragging');
            if (this.tearTrack) this.tearTrack.classList.remove('is-dragging');

            const bounds = getTrackBounds();
            const ratio = (currentX - bounds.left) / bounds.width;
            const deltaX = currentX - startX;

            if (ratio >= 0.40 || deltaX > 50) {
                updateProgress(1);
                this.startPackTear();
            } else {
                updateProgress(0);
            }
        };

        if (this.packTopCrimp) {
            this.packTopCrimp.addEventListener('mousedown', onStart);
            this.packTopCrimp.addEventListener('touchstart', onStart, { passive: true });
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);

        if (this.btnTearPack) {
            this.btnTearPack.addEventListener('click', () => {
                updateProgress(1);
                this.startPackTear();
            });
        }
    }

    pickRandomRarity(isClimaxSlot = false) {
        const rand = Math.random() * 100;
        if (isClimaxSlot) {
            if (rand < 15) return 'secret'; // 15%
            if (rand < 55) return 'ultra';  // 40%
            return 'rare';                  // 45%
        }
        if (rand < 3) return 'secret';      // 3%
        if (rand < 15) return 'ultra';      // 12%
        if (rand < 40) return 'rare';       // 25%
        return 'common';                    // 60%
    }

    drawCardForTheme(rarity, customName = null) {
        let displayName = customName;
        if (!displayName) {
            displayName = "Giải Thưởng May Mắn";
        }
        const parts = displayName.split('|').map(p => p.trim());
        const prizeTitle = parts[0];
        let itemRarity = rarity;
        if (parts[1] && ['common', 'rare', 'ultra', 'secret'].includes(parts[1].toLowerCase())) {
            itemRarity = parts[1].toLowerCase();
        }

        let rankTitle = 'GIẢI MAY MẮN';
        let rankIcon = '✨';
        let badge = '⚪ Thường';
        let rarityLabel = 'Common';

        if (itemRarity === 'rare') {
            rankTitle = 'GIẢI NHÌ';
            rankIcon = '🌟';
            badge = '🔵 Rare Holo';
            rarityLabel = 'Rare Holo';
        } else if (itemRarity === 'ultra') {
            rankTitle = 'GIẢI NHẤT';
            rankIcon = '⭐';
            badge = '🟡 Ultra Rare';
            rarityLabel = 'Ultra Rare';
        } else if (itemRarity === 'secret') {
            rankTitle = 'GIẢI ĐẶC BIỆT';
            rankIcon = '👑';
            badge = '🌈 Crown Rare';
            rarityLabel = 'Crown Rare';
        }

        // Auto-detect rank if name explicitly starts with Giải Đặc Biệt / Giải Nhất / etc.
        const lowerName = prizeTitle.toLowerCase();
        if (lowerName.includes('đặc biệt') || lowerName.includes('dac biet')) {
            rankTitle = 'GIẢI ĐẶC BIỆT';
            rankIcon = '👑';
        } else if (lowerName.includes('giải nhất') || lowerName.includes('giai nhat')) {
            rankTitle = 'GIẢI NHẤT';
            rankIcon = '⭐';
        } else if (lowerName.includes('giải nhì') || lowerName.includes('giai nhi')) {
            rankTitle = 'GIẢI NHÌ';
            rankIcon = '🌟';
        } else if (lowerName.includes('giải ba') || lowerName.includes('giai ba')) {
            rankTitle = 'GIẢI BA';
            rankIcon = '🎁';
        }

        return {
            name: prizeTitle,
            rarity: itemRarity,
            rarityBadge: badge,
            rarityLabel: rarityLabel,
            rankTitle: rankTitle,
            rankIcon: rankIcon,
            theme: this.packTheme
        };
    }

    generatePackCards() {
        this.currentPackCards = [];
        const count = this.packCardCount || 5;
        let customNames = this.getValidPackNames();
        if (customNames.length === 0) {
            customNames = Array.from({ length: Math.max(10, count) }, (_, idx) => `Thẻ May Mắn #${idx + 1}`);
        }

        const requireUnique = document.getElementById('uniqueToggle') ? document.getElementById('uniqueToggle').checked : false;

        let namePool = [...customNames];
        if (requireUnique && this.drawnPool) {
            namePool = namePool.filter(n => !this.drawnPool.has(n));
            if (namePool.length === 0) namePool = [...customNames];
        }

        for (let i = 0; i < count; i++) {
            const isClimax = (i === count - 1);
            const rarity = this.pickRandomRarity(isClimax);

            let drawnCard = null;
            if (namePool.length > 0) {
                const nameIdx = CryptoRandomUtils.getRandomInt(0, namePool.length - 1);
                const chosenName = namePool[nameIdx];
                if (requireUnique || namePool.length >= count) {
                    namePool.splice(nameIdx, 1);
                }
                drawnCard = this.drawCardForTheme(rarity, chosenName);
            } else {
                drawnCard = this.drawCardForTheme(rarity);
            }

            this.currentPackCards.push(drawnCard);
        }

        // Calculate max rarity in this pack for spoiler beam
        if (this.currentPackCards.some(c => c.rarity === 'secret')) {
            this.maxRarity = 'secret';
        } else if (this.currentPackCards.some(c => c.rarity === 'ultra')) {
            this.maxRarity = 'ultra';
        } else if (this.currentPackCards.some(c => c.rarity === 'rare')) {
            this.maxRarity = 'rare';
        } else {
            this.maxRarity = 'common';
        }
    }

    async startPackTear() {
        if (this.isTearing) return;
        this.isTearing = true;

        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        this.generatePackCards();

        // 1. Immediately fade out tear action button smoothly
        if (this.packInitialActions) {
            this.packInitialActions.classList.add('hiding');
        }

        // 2. Tactile foil impact vibration on the booster pack
        if (this.boosterPack) {
            this.boosterPack.classList.remove('is-tearing-impact');
            void this.boosterPack.offsetWidth;
            this.boosterPack.classList.add('is-tearing-impact');
        }

        // 3. Sound: Foil tearing crinkle
        this.playSound('packTear');

        // 4. Laser seam flash along the cut line
        if (this.packTearFlash) {
            this.packTearFlash.classList.remove('ignite');
            void this.packTearFlash.offsetWidth;
            this.packTearFlash.classList.add('ignite');
        }

        // 5. Visual: Crimp tears off organically
        if (this.packTopCrimp) {
            this.packTopCrimp.classList.add('torn');
        }

        // 6. Visual: Multi-layer cinematic light flare erupts from tear seam
        if (this.packGlowBeam) {
            this.packGlowBeam.className = 'pack-glow-beam bursting ' + this.maxRarity;
        }

        // 7. Sound: Resonant beam burst / chime
        setTimeout(() => {
            this.playSound('beamBurst');
        }, 110);

        // 8. Secret Rare Celebration: micro-burst sparkles on flare
        if (this.maxRarity === 'secret' && typeof confetti === 'function') {
            confetti({
                particleCount: 30,
                spread: 60,
                origin: { y: 0.45 },
                colors: ['#f43f5e', '#fbbf24', '#34d399', '#60a5fa', '#c084fc']
            });
        }

        // 9. Visual: Pack wrapper slides down smoothly into dissipation
        setTimeout(() => {
            if (this.packBody) {
                this.packBody.classList.add('sliding');
            }
        }, 420);

        // 10. Smooth transition to cards stage
        setTimeout(() => {
            if (this.packStage) this.packStage.classList.add('hidden');
            if (this.cardsStage) this.cardsStage.classList.remove('hidden');
            if (this.summaryStage) this.summaryStage.classList.add('hidden');

            this.renderCardStack();
            this.isTearing = false;
        }, 820);
    }

    createCardElement(card, index) {
        const cardEl = document.createElement('div');
        cardEl.className = `pokemon-card rarity-${card.rarity}`;
        cardEl.dataset.index = index;

        // Determine font size class according to text length
        const textLen = (card.name || '').length;
        const sizeClass = textLen <= 4 ? 'text-huge' : (textLen <= 18 ? 'text-large' : (textLen <= 40 ? 'text-medium' : 'text-compact'));

        cardEl.innerHTML = `
            <!-- Card Back: Elegant Mystery Question Mark Logo -->
            <div class="card-face card-back">
                <div class="card-back-frame">
                    <div class="card-back-title">THẺ MAY MẮN</div>
                    <div class="card-back-mystery-logo">
                        <div class="back-mystery-orb">
                            <span class="back-mystery-qmark">?</span>
                        </div>
                        <div class="back-mystery-stars">
                            <i class="fa-solid fa-star"></i>
                            <i class="fa-solid fa-star"></i>
                            <i class="fa-solid fa-star"></i>
                        </div>
                    </div>
                    <div class="card-back-footer-text">LUCKY PRIZE CARD</div>
                </div>
            </div>

            <!-- Card Front: Strictly ONLY the prize content from Danh Sách Giải Thưởng -->
            <div class="card-face card-front">
                <div class="card-content-wrap card-prize-only-wrap">
                    <div class="card-prize-only-text ${sizeClass}" title="${card.name}">
                        ${card.name}
                    </div>
                </div>
                <div class="card-glare"></div>
                <div class="card-foil"></div>
            </div>
        `;

        return cardEl;
    }

    setupCardTiltAndFoil(cardEl) {
        const onMove = (e) => {
            if (this.cardsViewMode === 'spread' && !cardEl.classList.contains('flipped')) return;
            const rect = cardEl.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            if (!clientX || !clientY) return;

            const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

            const tiltX = (y - 0.5) * -18;
            const tiltY = (x - 0.5) * 18;
            const glareX = x * 100;
            const glareY = y * 100;
            const foilAngle = Math.round(Math.atan2(y - 0.5, x - 0.5) * (180 / Math.PI) + 180);

            cardEl.style.setProperty('--tilt-x', `${tiltX}deg`);
            cardEl.style.setProperty('--tilt-y', `${tiltY}deg`);
            cardEl.style.setProperty('--glare-x', `${glareX}%`);
            cardEl.style.setProperty('--glare-y', `${glareY}%`);
            cardEl.style.setProperty('--foil-angle', `${foilAngle}deg`);
            cardEl.style.setProperty('--foil-opacity', '0.85');

            if (this.cardsViewMode === 'stack') {
                if (cardEl.classList.contains('flipped')) {
                    cardEl.style.transform = `rotateY(180deg) rotateX(${tiltX}deg) rotateZ(${-tiltY * 0.25}deg)`;
                } else {
                    cardEl.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
                }
            } else {
                if (cardEl.classList.contains('flipped')) {
                    cardEl.style.transform = `rotateY(180deg) translateY(-8px) rotateX(${tiltX * 0.5}deg) rotateZ(${-tiltY * 0.2}deg)`;
                }
            }
        };

        const onLeave = () => {
            cardEl.style.setProperty('--foil-opacity', '0.35');
            if (this.cardsViewMode === 'stack') {
                if (cardEl.classList.contains('flipped')) {
                    cardEl.style.transform = 'rotateY(180deg)';
                } else {
                    cardEl.style.transform = 'translateZ(0px) translateY(0px) scale(1)';
                }
            } else {
                if (cardEl.classList.contains('flipped')) {
                    cardEl.style.transform = 'rotateY(180deg)';
                } else {
                    cardEl.style.transform = 'none';
                }
            }
        };

        cardEl.addEventListener('mousemove', onMove);
        cardEl.addEventListener('mouseleave', onLeave);
    }

    renderCardStack() {
        if (!this.cardStack) return;
        this.cardStack.innerHTML = '';
        this.activeCardIndex = 0;
        this.revealedCardsCount = 0;
        this.cardsViewMode = 'stack';

        if (this.btnViewStack) this.btnViewStack.classList.add('active');
        if (this.btnViewSpread) this.btnViewSpread.classList.remove('active');
        this.cardStack.className = 'card-stack view-stack';

        const fragment = document.createDocumentFragment();
        this.currentPackCards.forEach((card, i) => {
            const cardEl = this.createCardElement(card, i);
            fragment.appendChild(cardEl);
        });
        this.cardStack.appendChild(fragment);

        this.applyCardStackTransforms();
        this.setupCardEventListeners();
        this.updateCardStageUI();
    }

    setupCardEventListeners() {
        if (!this.cardStack) return;
        const cards = this.cardStack.querySelectorAll('.pokemon-card');

        cards.forEach((cardEl, i) => {
            let startX = 0;
            let startY = 0;
            let moved = false;

            const onStart = (e) => {
                const pt = e.touches ? e.touches[0] : e;
                startX = pt.clientX;
                startY = pt.clientY;
                moved = false;
            };

            const onMove = (e) => {
                const pt = e.touches ? e.touches[0] : e;
                if (!startX || !startY) return;
                const dist = Math.hypot(pt.clientX - startX, pt.clientY - startY);
                if (dist > 8) moved = true;
            };

            const onEnd = (e) => {
                const pt = e.changedTouches ? e.changedTouches[0] : e;
                const deltaX = pt.clientX - startX;
                const deltaY = pt.clientY - startY;
                const dist = Math.hypot(deltaX, deltaY);

                if (dist < 14) {
                    // Tap / Click action!
                    this.handleCardClick(i);
                } else if (deltaX < -45 || deltaY < -45) {
                    // Swipe Left or Up
                    if (!cardEl.classList.contains('flipped')) {
                        this.flipCardByIndex(i);
                    } else if (this.cardsViewMode === 'stack') {
                        this.nextCard();
                    }
                }
            };

            // Touch events for mobile
            cardEl.addEventListener('touchstart', onStart, { passive: true });
            cardEl.addEventListener('touchmove', onMove, { passive: true });
            cardEl.addEventListener('touchend', onEnd);

            // Mouse click fallback for desktop
            cardEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.pointerType !== 'touch') {
                    this.handleCardClick(i);
                }
            });

            // Parallax tilt shader on hover
            this.setupCardTiltAndFoil(cardEl);
        });
    }

    handleCardClick(index) {
        const cards = this.cardStack.querySelectorAll('.pokemon-card');
        const cardEl = cards[index];
        if (!cardEl) return;

        if (this.cardsViewMode === 'spread') {
            // In Spread mode: player can click ANY card to flip it in any order!
            if (!cardEl.classList.contains('flipped')) {
                this.flipCardByIndex(index);
            }
        } else {
            // In Stack mode:
            if (index === this.activeCardIndex) {
                if (!cardEl.classList.contains('flipped')) {
                    this.flipCardByIndex(index);
                } else {
                    this.nextCard();
                }
            } else if (index > this.activeCardIndex) {
                this.flipCardByIndex(this.activeCardIndex);
            }
        }
    }

    flipCardByIndex(index, isBatch = false) {
        const cards = this.cardStack.querySelectorAll('.pokemon-card');
        const cardEl = cards[index];
        if (!cardEl || cardEl.classList.contains('flipped')) return;

        cardEl.classList.add('flipping-pop', 'flipped');
        cardEl.style.transform = 'rotateY(180deg)';

        setTimeout(() => {
            if (cardEl) cardEl.classList.remove('flipping-pop');
        }, 700);

        this.playSound('cardFlip');

        const cardData = this.currentPackCards[index];
        if (cardData) {
            if (cardData.rarity === 'rare') {
                this.playSound('holoShimmer');
                cardEl.classList.add('sweep-shimmer');
            } else if (cardData.rarity === 'ultra') {
                this.playSound('ultraReveal');
                cardEl.classList.add('sweep-shimmer');
            } else if (cardData.rarity === 'secret') {
                this.playSound('secretFanfare');
                if (this.appContainer) {
                    this.appContainer.classList.add('screen-shake');
                    setTimeout(() => this.appContainer.classList.remove('screen-shake'), 650);
                }
                this.triggerConfetti();
            }
        }

        this.updateCardStageUI();
    }

    nextCard() {
        const cards = this.cardStack.querySelectorAll('.pokemon-card');
        const currentEl = cards[this.activeCardIndex];
        if (!currentEl) return;

        if (!currentEl.classList.contains('flipped')) {
            this.flipCardByIndex(this.activeCardIndex);
            return;
        }

        this.playSound('cardFlip');
        this.activeCardIndex++;

        if (this.activeCardIndex < this.currentPackCards.length) {
            this.applyCardStackTransforms();
            this.updateCardStageUI();
        } else {
            this.showSummary();
        }
    }

    setViewMode(mode) {
        this.cardsViewMode = mode;
        if (this.btnViewStack) this.btnViewStack.classList.toggle('active', mode === 'stack');
        if (this.btnViewSpread) this.btnViewSpread.classList.toggle('active', mode === 'spread');

        if (this.cardStack) {
            this.cardStack.className = `card-stack view-${mode}`;
        }
        this.applyCardStackTransforms();
        this.updateCardStageUI();
    }

    handleStackButtonClick() {
        if (!this.cardStack) return;

        // Button tactile animation & icon flip
        if (this.btnViewStack) {
            this.btnViewStack.classList.remove('is-shuffling');
            void this.btnViewStack.offsetWidth;
            this.btnViewStack.classList.add('is-shuffling');
            setTimeout(() => {
                if (this.btnViewStack) this.btnViewStack.classList.remove('is-shuffling');
            }, 550);
        }

        // Play authentic card deck shuffle / gather SFX
        this.playSound('deckShuffle');

        const wasSpread = (this.cardsViewMode === 'spread');

        if (wasSpread) {
            // Case 1: Transition smoothly from Spread to Stack with 3D Cascade Gathering
            this.animateSpreadToStack();
        } else {
            // Case 2: Already in Stack mode -> perform 3D Deck Riffle / Fan Out & Snap
            this.animateStackRiffleShuffle();
        }
    }

    animateSpreadToStack() {
        if (!this.cardStack) return;
        const cards = Array.from(this.cardStack.querySelectorAll('.pokemon-card'));
        if (cards.length === 0) {
            this.setViewMode('stack');
            return;
        }

        // 1. Record starting positions in spread view (FLIP - First)
        const firstRects = cards.map(c => c.getBoundingClientRect());

        // 2. Set mode to stack and update UI
        this.cardsViewMode = 'stack';
        if (this.btnViewStack) this.btnViewStack.classList.add('active');
        if (this.btnViewSpread) this.btnViewSpread.classList.remove('active');
        this.cardStack.className = 'card-stack view-stack is-gathering';
        this.updateCardStageUI();

        // 3. Immediately capture new stack positions (FLIP - Last)
        const lastRects = cards.map(c => c.getBoundingClientRect());

        // 4. Invert transforms (FLIP - Invert)
        cards.forEach((cardEl, i) => {
            const deltaX = firstRects[i].left - lastRects[i].left;
            const deltaY = firstRects[i].top - lastRects[i].top;
            const isFlipped = cardEl.classList.contains('flipped');
            const rotY = isFlipped ? 'rotateY(180deg)' : '';
            const tilt = (i - Math.floor(cards.length / 2)) * 6;

            cardEl.style.transition = 'none';
            cardEl.style.transform = `${rotY} translate3d(${deltaX}px, ${deltaY}px, 60px) scale(0.68) rotateZ(${tilt}deg)`;
            cardEl.style.zIndex = `${30 + i}`;
        });

        // 5. Play animation to target stack positions with staggered cascade (FLIP - Play)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                cards.forEach((cardEl, i) => {
                    const delay = i * 45;
                    cardEl.style.transition = `transform 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms, box-shadow 0.4s ease ${delay}ms`;
                    const isFlipped = cardEl.classList.contains('flipped');
                    const rotY = isFlipped ? 'rotateY(180deg)' : '';

                    if (i < this.activeCardIndex) {
                        cardEl.classList.remove('active-card');
                        cardEl.classList.add('dismissed');
                        cardEl.style.transform = 'translateX(135%) rotate(25deg) scale(0.85)';
                        cardEl.style.zIndex = '1';
                    } else if (i === this.activeCardIndex) {
                        cardEl.classList.remove('dismissed');
                        cardEl.classList.add('active-card');
                        cardEl.style.transform = isFlipped ? 'rotateY(180deg)' : 'translateZ(0px) translateY(0px) scale(1)';
                        cardEl.style.zIndex = '50';
                    } else {
                        const diff = i - this.activeCardIndex;
                        const zOffset = diff * -12;
                        const yOffset = diff * 4;
                        const scale = 1 - diff * 0.025;
                        cardEl.classList.remove('active-card', 'dismissed');
                        cardEl.style.transform = `${rotY} translateZ(${zOffset}px) translateY(${yOffset}px) scale(${scale})`;
                        cardEl.style.zIndex = `${50 - diff}`;
                    }
                });

                // 6. Settle and snap impact bounce
                setTimeout(() => {
                    if (this.cardStack) {
                        this.cardStack.classList.remove('is-gathering');
                        this.cardStack.classList.add('stack-snapped');
                        setTimeout(() => {
                            if (this.cardStack) this.cardStack.classList.remove('stack-snapped');
                        }, 350);
                    }
                    this.applyCardStackTransforms();
                }, cards.length * 45 + 530);
            });
        });
    }

    animateStackRiffleShuffle() {
        if (!this.cardStack) return;
        const cards = Array.from(this.cardStack.querySelectorAll('.pokemon-card'));
        if (cards.length === 0) return;

        this.cardStack.classList.add('is-shuffling');

        const unDismissed = cards.filter((_, i) => i >= this.activeCardIndex);
        const count = unDismissed.length;

        // Phase 1: 3D Accordion Fan Out
        unDismissed.forEach((cardEl, idx) => {
            const isFlipped = cardEl.classList.contains('flipped');
            const rotY = isFlipped ? 'rotateY(180deg)' : '';
            const factor = idx - (count - 1) / 2;
            const fanX = factor * 80;
            const fanRotZ = factor * 8.5;
            const fanZ = (count - idx) * 12;

            cardEl.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)';
            cardEl.style.transform = `${rotY} translate3d(${fanX}px, -18px, ${fanZ}px) rotateZ(${fanRotZ}deg) scale(1.025)`;
        });

        // Phase 2: Snap back in sequence with card riffle
        setTimeout(() => {
            unDismissed.forEach((cardEl, idx) => {
                const delay = idx * 35;
                cardEl.style.transition = `transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`;
            });
            this.applyCardStackTransforms();

            setTimeout(() => {
                if (this.cardStack) {
                    this.cardStack.classList.remove('is-shuffling');
                    this.cardStack.classList.add('stack-snapped');
                    setTimeout(() => {
                        if (this.cardStack) this.cardStack.classList.remove('stack-snapped');
                    }, 350);
                }
            }, count * 35 + 380);
        }, 260);
    }

    applyCardStackTransforms() {
        if (!this.cardStack) return;
        const cards = this.cardStack.querySelectorAll('.pokemon-card');

        cards.forEach((cardEl, i) => {
            if (this.cardsViewMode === 'spread') {
                cardEl.classList.remove('dismissed', 'active-card');
                if (cardEl.classList.contains('flipped')) {
                    cardEl.style.transform = 'rotateY(180deg)';
                } else {
                    cardEl.style.transform = 'none';
                }
                cardEl.style.zIndex = '10';
            } else {
                // Stack view
                if (i < this.activeCardIndex) {
                    cardEl.classList.remove('active-card');
                    cardEl.classList.add('dismissed');
                    cardEl.style.transform = 'translateX(135%) rotate(25deg) scale(0.85)';
                    cardEl.style.zIndex = '1';
                } else if (i === this.activeCardIndex) {
                    cardEl.classList.remove('dismissed');
                    cardEl.classList.add('active-card');
                    if (cardEl.classList.contains('flipped')) {
                        cardEl.style.transform = 'rotateY(180deg)';
                    } else {
                        cardEl.style.transform = 'translateZ(0px) translateY(0px) scale(1)';
                    }
                    cardEl.style.zIndex = '50';
                } else {
                    const diff = i - this.activeCardIndex;
                    const zOffset = diff * -12;
                    const yOffset = diff * 4;
                    const scale = 1 - diff * 0.025;
                    cardEl.classList.remove('active-card', 'dismissed');
                    cardEl.style.transform = `translateZ(${zOffset}px) translateY(${yOffset}px) scale(${scale})`;
                    cardEl.style.zIndex = `${50 - diff}`;
                }
            }
        });
    }

    updateCardStageUI() {
        const cards = this.cardStack ? Array.from(this.cardStack.querySelectorAll('.pokemon-card')) : [];
        const total = this.currentPackCards.length;
        const flippedCount = cards.filter(c => c.classList.contains('flipped')).length;
        const allFlipped = total > 0 && flippedCount === total;
        const activeCard = cards[this.activeCardIndex];
        const isActiveFlipped = activeCard ? activeCard.classList.contains('flipped') : false;

        if (this.cardProgressPill) {
            this.cardProgressPill.innerHTML = `<i class="fa-solid fa-layer-group"></i> Đã lật: ${flippedCount} / ${total}`;
        }

        if (allFlipped) {
            if (this.cardHintText) {
                this.cardHintText.innerHTML = '<span style="color:#fbbf24; font-weight:800;">🎉 Đã lật trọn vẹn toàn bộ các thẻ! Bấm "Xem tổng kết" để chiêm ngưỡng bộ sưu tập.</span>';
            }
            if (this.btnActionFlip) this.btnActionFlip.classList.add('hidden');
            if (this.btnNextCard) this.btnNextCard.classList.add('hidden');
            if (this.btnFinishSummary) this.btnFinishSummary.classList.remove('hidden');
            return;
        }

        if (this.cardsViewMode === 'spread') {
            if (this.cardHintText) {
                this.cardHintText.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Bấm vào thẻ bất kỳ bạn muốn lật trước!';
            }
            if (this.btnActionFlip) this.btnActionFlip.classList.add('hidden');
            if (this.btnNextCard) this.btnNextCard.classList.add('hidden');
            if (this.btnFinishSummary) this.btnFinishSummary.classList.add('hidden');
        } else {
            // Stack view:
            if (!isActiveFlipped) {
                if (this.cardHintText) {
                    this.cardHintText.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Nhấn vào thẻ hoặc vuốt để lật bài';
                }
                if (this.btnActionFlip) this.btnActionFlip.classList.remove('hidden');
                if (this.btnNextCard) this.btnNextCard.classList.add('hidden');
                if (this.btnFinishSummary) this.btnFinishSummary.classList.add('hidden');
            } else {
                if (this.activeCardIndex < total - 1) {
                    if (this.cardHintText) {
                        this.cardHintText.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Bấm "Thẻ tiếp theo" hoặc gạt thẻ sang bên để mở tiếp';
                    }
                    if (this.btnActionFlip) this.btnActionFlip.classList.add('hidden');
                    if (this.btnNextCard) this.btnNextCard.classList.remove('hidden');
                    if (this.btnFinishSummary) this.btnFinishSummary.classList.add('hidden');
                } else {
                    if (this.btnActionFlip) this.btnActionFlip.classList.add('hidden');
                    if (this.btnNextCard) this.btnNextCard.classList.add('hidden');
                    if (this.btnFinishSummary) this.btnFinishSummary.classList.remove('hidden');
                }
            }
        }
    }

    revealAllCards() {
        const cards = Array.from(this.cardStack.querySelectorAll('.pokemon-card'));
        const unflipped = cards.filter(c => !c.classList.contains('flipped'));
        if (unflipped.length === 0) {
            this.showSummary();
            return;
        }

        // 1. Switch to Spread view so all cards are visible in parallel
        this.setViewMode('spread');

        // 2. Cascade flip each unflipped card with whoosh and particles
        let delay = 0;
        cards.forEach((cardEl, idx) => {
            if (!cardEl.classList.contains('flipped')) {
                setTimeout(() => {
                    this.flipCardByIndex(idx, true);
                }, delay);
                delay += 160;
            }
        });

        // 3. Keep cards displayed for the user to admire, then update hints and show "Xem tổng kết"
        setTimeout(() => {
            this.updateCardStageUI();
        }, delay + 250);
    }

    showSummary() {
        if (this.cardsStage) this.cardsStage.classList.add('hidden');
        if (this.packStage) this.packStage.classList.add('hidden');
        if (this.summaryStage) this.summaryStage.classList.remove('hidden');

        if (!this.summaryCardsGrid) return;
        this.summaryCardsGrid.innerHTML = '';

        const summarySubtitle = document.getElementById('summarySubtitle');
        if (summarySubtitle) {
            if (this.maxRarity === 'secret') {
                summarySubtitle.innerHTML = '<span style="color:#f43f5e; font-weight:800;">🌈 CHÚC MỪNG! Bạn đã mở được thẻ Crown Rare siêu phẩm!</span>';
            } else if (this.maxRarity === 'ultra') {
                summarySubtitle.innerHTML = '<span style="color:#fbbf24; font-weight:800;">✨ TUYỆT VỜI! Bạn đã mở được thẻ Ultra Rare EX vàng kim!</span>';
            } else if (this.maxRarity === 'rare') {
                summarySubtitle.innerHTML = '<span style="color:#38bdf8; font-weight:700;">🌟 May mắn! Bạn có thẻ Rare Holo lấp lánh!</span>';
            } else {
                summarySubtitle.textContent = 'Gói bài gồm các thẻ Pokémon thân quen!';
            }
        }

        if (this.maxRarity === 'secret' || this.maxRarity === 'ultra') {
            this.triggerConfetti();
        }

        const fragment = document.createDocumentFragment();
        this.currentPackCards.forEach((card, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'summary-card-wrapper';

            const cardEl = this.createCardElement(card, idx);
            cardEl.classList.add('flipped');
            this.setupCardTiltAndFoil(cardEl);

            wrap.appendChild(cardEl);
            fragment.appendChild(wrap);
        });
        this.summaryCardsGrid.appendChild(fragment);

        // Record to History
        const now = new Date().toLocaleString('vi-VN');
        const packTitle = this.selectedPackData
            ? `${this.selectedPackData.theme.name} (${this.selectedPackData.mascot.name})`
            : (this.packTheme ? `Gói ${this.packTheme.toUpperCase()}` : 'Gói May Mắn');
        const requireUnique = document.getElementById('uniqueToggle') ? document.getElementById('uniqueToggle').checked : false;

        this.currentPackCards.forEach(card => {
            if (requireUnique && this.drawnPool) {
                this.drawnPool.add(card.name);
            }
            this.history.unshift({
                time: now,
                mode: 'MỞ PACK',
                tier: packTitle,
                rarity: card.rarity,
                rarityBadge: card.rarityBadge,
                value: card.name
            });
        });

        this.saveHistory();
        this.renderHistory();
    }

    resetPackOpening() {
        this.generateShowcasePacks();
        this.backToPackSelection();
    }

    replayPackCards() {
        if (this.summaryStage) this.summaryStage.classList.add('hidden');
        if (this.packStage) this.packStage.classList.add('hidden');
        if (this.cardsStage) this.cardsStage.classList.remove('hidden');

        this.renderCardStack();
    }

    updateCardProgress() {
        if (this.cardProgressPill) {
            const current = Math.min(this.currentPackCards.length, this.activeCardIndex + 1);
            const total = this.currentPackCards.length;
            this.cardProgressPill.innerHTML = `<i class="fa-solid fa-layer-group"></i> Thẻ ${current} / ${total}`;
        }
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
