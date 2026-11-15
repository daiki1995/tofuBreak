
        /* ===================================================================
         *  1. SOUND ENGINE (Web Audio API による効果音合成)
         * =================================================================== */
        class SoundEngine {
            constructor() {
                this.ctx = null;
            }

            init() {
                if (!this.ctx) {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
            }

            // ぷるん！ (豆腐打撃小)
            playPurun() {
                if (!this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(220, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);
                
                gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start();
                osc.stop(this.ctx.currentTime + 0.15);
            }

            // ドカッ！ (重打撃)
            playHit(heavy = false) {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                // ノイズ生成 (爆発感)
                const bufferSize = this.ctx.sampleRate * (heavy ? 0.3 : 0.15);
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(heavy ? 600 : 1200, now);
                filter.frequency.linearRampToValueAtTime(100, now + (heavy ? 0.3 : 0.15));

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(heavy ? 0.8 : 0.4, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + (heavy ? 0.3 : 0.15));

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                noise.start(now);

                // 重低音のトーン追加
                const osc = this.ctx.createOscillator();
                const oscGain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(heavy ? 150 : 250, now);
                osc.frequency.exponentialRampToValueAtTime(30, now + (heavy ? 0.35 : 0.2));

                oscGain.gain.setValueAtTime(heavy ? 0.6 : 0.3, now);
                oscGain.gain.exponentialRampToValueAtTime(0.01, now + (heavy ? 0.35 : 0.2));

                osc.connect(oscGain);
                oscGain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + (heavy ? 0.35 : 0.2));
            }

            // 溜め音
            playCharge() {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.linearRampToValueAtTime(400, now + 0.8);

                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.3, now + 0.8);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.85);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(now);
                osc.stop(now + 0.85);
            }

            // 完全崩壊大爆発
            playDestroy() {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;

                const bufferSize = this.ctx.sampleRate * 1.5;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }

                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(800, now);
                filter.frequency.exponentialRampToValueAtTime(40, now + 1.5);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(1.0, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                noise.start(now);
            }
        }

        const sound = new SoundEngine();


        /* ===================================================================
         *  2. 3D VISUAL ENGINE (Three.js による豆腐・演出描画)
         * =================================================================== */
        let scene, camera, renderer;
        let tofuMesh, tofuGeometry, tofuMaterial;
        let originalVertices = [];
        let particles = [];
        let playerMesh;

        // 豆腐の物理変形用パラメータ
        let squishFactor = 0;
        let wobbleTime = 0;

        function init3D() {
            const container = document.getElementById('canvas-container');
            
            // シーン
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x111827, 0.03);

            // カメラ
            camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 3, 11);
            camera.lookAt(0, 0, 0);

            // レンダラー
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            container.appendChild(renderer.domElement);

            // ライティング
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);

            const dirLight = new THREE.DirectionalLight(0xfffaed, 0.8);
            dirLight.position.set(5, 12, 8);
            dirLight.castShadow = true;
            scene.add(dirLight);

            const pointLight = new THREE.PointLight(0xffaa00, 1, 15);
            pointLight.position.set(-4, 2, 4);
            scene.add(pointLight);

            // 床
            const floorGeo = new THREE.PlaneGeometry(30, 30);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.y = -2;
            floor.receiveShadow = true;
            scene.add(floor);

            // 巨大豆腐の作成
            createTofu();

            // トッピング (きざみネギ & 醤油トレイ風)
            createToppings();

            // プレイヤーキャラクター (コミカルな突進球体/シルエット)
            createPlayer();

            // リサイズイベント
            window.addEventListener('resize', onWindowResize);
        }

        // 巨大豆腐メッシュ生成
        function createTofu() {
            // 細分化したボックスジオメトリ (ぷるぷる変形用)
            tofuGeometry = new THREE.BoxGeometry(4, 3.2, 4, 12, 10, 12);
            
            // 頂点の初期位置を保存
            const pos = tofuGeometry.attributes.position;
            originalVertices = [];
            for (let i = 0; i < pos.count; i++) {
                originalVertices.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
            }

            // 豆腐マテリアル (すこし透け感と光沢のある質感)
            tofuMaterial = new THREE.MeshStandardMaterial({
                color: 0xfaf8f5,
                roughness: 0.2,
                metalness: 0.05,
                flatShading: false,
            });

            tofuMesh = new THREE.Mesh(tofuGeometry, tofuMaterial);
            tofuMesh.position.set(0, 0, 0);
            tofuMesh.castShadow = true;
            tofuMesh.receiveShadow = true;
            scene.add(tofuMesh);
        }

        // 豆腐の上のネギ & 醤油
        let toppingsGroup;
        function createToppings() {
            toppingsGroup = new THREE.Group();

            // 醤油のかかった質感 (上の薄い層)
            const soyGeo = new THREE.PlaneGeometry(3.2, 3.2);
            const soyMat = new THREE.MeshBasicMaterial({ color: 0x2b1810, transparent: true, opacity: 0.75 });
            const soy = new THREE.Mesh(soyGeo, soyMat);
            soy.rotation.x = -Math.PI / 2;
            soy.position.y = 1.61;
            toppingsGroup.add(soy);

            // ネギ (小さな緑の円柱多数)
            const negiGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);
            const negiMat = new THREE.MeshLambertMaterial({ color: 0x22c55e });

            for (let i = 0; i < 35; i++) {
                const negi = new THREE.Mesh(negiGeo, negiMat);
                negi.position.set(
                    (Math.random() - 0.5) * 2.6,
                    1.65,
                    (Math.random() - 0.5) * 2.6
                );
                negi.rotation.x = Math.random() * 0.4;
                negi.rotation.z = Math.random() * 0.4;
                toppingsGroup.add(negi);
            }

            scene.add(toppingsGroup);
        }

        // プレイヤーアバター
        function createPlayer() {
            const group = new THREE.Group();
            
            // ヒーロー感のある赤い突進オーラ/球体
            const bodyGeo = new THREE.SphereGeometry(0.7, 16, 16);
            const bodyMat = new THREE.MeshStandardMaterial({ 
                color: 0xef4444, 
                emissive: 0x991b1b,
                roughness: 0.3 
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            group.add(body);

            group.position.set(-5, -0.5, 3);
            playerMesh = group;
            scene.add(playerMesh);
        }

        // ウィンドウリサイズ対応
        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        // パーティクル発生 (豆腐くず・ネギ・醤油)
        function spawnImpactParticles(position, count, isHeavy = false) {
            for (let i = 0; i < count; i++) {
                let mesh;
                const type = Math.random();

                if (type < 0.6) {
                    // 豆腐の白い破片
                    const size = 0.1 + Math.random() * (isHeavy ? 0.4 : 0.2);
                    const geo = new THREE.BoxGeometry(size, size, size);
                    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
                    mesh = new THREE.Mesh(geo, mat);
                } else if (type < 0.8) {
                    // 刻みネギ
                    const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6);
                    const mat = new THREE.MeshLambertMaterial({ color: 0x16a34a });
                    mesh = new THREE.Mesh(geo, mat);
                } else {
                    // 醤油のしずく
                    const geo = new THREE.SphereGeometry(0.08, 8, 8);
                    const mat = new THREE.MeshBasicMaterial({ color: 0x3b1a0e });
                    mesh = new THREE.Mesh(geo, mat);
                }

                mesh.position.copy(position);
                mesh.position.x += (Math.random() - 0.5) * 1.5;
                mesh.position.y += (Math.random() - 0.5) * 1.5;

                const velocity = new THREE.Vector3(
                    (Math.random() - 0.3) * (isHeavy ? 12 : 6),
                    Math.random() * (isHeavy ? 10 : 5) + 2,
                    (Math.random() - 0.5) * (isHeavy ? 10 : 5)
                );

                scene.add(mesh);
                particles.push({
                    mesh: mesh,
                    velocity: velocity,
                    rotSpeed: new THREE.Vector3(Math.random()*0.2, Math.random()*0.2, Math.random()*0.2),
                    life: 1.0
                });
            }
        }


        /* ===================================================================
         *  3. GAME LOGIC & STATE (タイムアタック・攻撃処理)
         * =================================================================== */
        const STAGE_TOTAL = 3;
        const STAGE_TWO_TIERS = [
            {
                maxClearTimeMs: 15000,
                stage: {
                    name: '鉄豆腐',
                    hp: 2400000,
                    color: 0x9ca3af,
                    roughness: 0.24,
                    metalness: 0.8,
                    scale: 1.05
                }
            },
            {
                maxClearTimeMs: 25000,
                stage: {
                    name: 'プラスチック豆腐',
                    hp: 1800000,
                    color: 0x87e8ff,
                    roughness: 0.12,
                    metalness: 0.22,
                    scale: 1.05
                }
            },
            {
                maxClearTimeMs: 40000,
                stage: {
                    name: '胡麻豆腐',
                    hp: 1200000,
                    color: 0x85745f,
                    roughness: 0.38,
                    metalness: 0.12,
                    scale: 1
                }
            },
            {
                stage: {
                    name: '卵豆腐',
                    hp: 900000,
                    color: 0xffe6a3,
                    roughness: 0.28,
                    metalness: 0,
                    scale: 0.95
                }
            }
        ];
        const FINAL_BOSS_TIERS = [
            {
                maxClearTimeMs: 20000,
                stage: {
                    name: '最強豆腐・覚醒形態',
                    hp: 4000000,
                    color: 0x87e8ff,
                    roughness: 0.08,
                    metalness: 0.45,
                    scale: 1.25
                }
            },
            {
                maxClearTimeMs: 40000,
                stage: {
                    name: '最強豆腐・真の力',
                    hp: 3200000,
                    color: 0x87e8ff,
                    roughness: 0.1,
                    metalness: 0.32,
                    scale: 1.2
                }
            },
            {
                stage: {
                    name: '最強豆腐',
                    hp: 2600000,
                    color: 0x87e8ff,
                    roughness: 0.12,
                    metalness: 0.22,
                    scale: 1.15
                }
            }
        ];
        const NORMAL_TOFU = {
            name: '通常豆腐',
            hp: 600000,
            color: 0xfaf8f5,
            roughness: 0.2,
            metalness: 0.05,
            scale: 1
        };
        let stageSequence = [NORMAL_TOFU, null, null];
        let currentStageIndex = 0;
        let currentStage = stageSequence[currentStageIndex];
        let currentHp = currentStage.hp;
        let isPlaying = false;
        let isStageTransitioning = false;
        let stageStartTime = 0;
        let elapsedTime = 0;
        let timerInterval = null;
        let pendingStageIndex = null;

        let combo = 0;
        let comboResetTimer = null;
        let feverGauge = 0;
        let isFever = false;

        let isCharging = false;
        let chargeStartTime = 0;
        let chargePower = 0;

        const BEST_TIME_KEY = 'tofu_campaign_best_time';
        let bestTime = localStorage.getItem(BEST_TIME_KEY) || null;

        // UIエレメント参照
        const hpBar = document.getElementById('hp-bar');
        const hpBarCatchup = document.getElementById('hp-bar-catchup');
        const hpText = document.getElementById('hp-text');
        const stageDisplay = document.getElementById('stage-display');
        const tofuName = document.getElementById('tofu-name');
        const timerDisplay = document.getElementById('timer-display');
        const comboContainer = document.getElementById('combo-container');
        const comboCount = document.getElementById('combo-count');
        const feverBar = document.getElementById('fever-bar');
        const feverBox = document.getElementById('fever-box');
        
        const modalScreen = document.getElementById('modal-screen');
        const startPanel = document.getElementById('start-panel');
        const resultPanel = document.getElementById('result-panel');
        const challengePanel = document.getElementById('challenge-panel');
        const challengeStage = document.getElementById('challenge-stage');
        const challengeTitle = document.getElementById('challenge-title');
        const challengeDetails = document.getElementById('challenge-details');
        const bestTimeDisplay = document.getElementById('best-time-display');
        const resultHeading = document.getElementById('result-heading');
        const resultMessage = document.getElementById('result-message');

        // ハイスコア初期表示
        if (bestTime) {
            bestTimeDisplay.textContent = `BEST TIME: ${formatTime(parseFloat(bestTime))}`;
        }

        // ゲーム開始
        function startGame() {
            sound.init();
            stageSequence = [NORMAL_TOFU, null, null];
            currentStageIndex = 0;
            currentStage = stageSequence[currentStageIndex];
            currentHp = currentStage.hp;
            combo = 0;
            feverGauge = 0;
            isFever = false;
            isPlaying = true;
            isStageTransitioning = false;
            elapsedTime = 0;
            stageStartTime = performance.now();
            pendingStageIndex = null;

            document.body.classList.remove('fever-bg');
            loadStage(currentStageIndex);
            updateComboUI();
            feverBar.style.width = '0%';

            modalScreen.classList.add('hidden');
            startPanel.classList.add('hidden');
            challengePanel.classList.add('hidden');
            resultPanel.classList.add('hidden');

            timerInterval = requestAnimationFrame(updateTimer);
        }

        function loadStage(stageIndex) {
            currentStageIndex = stageIndex;
            currentStage = stageSequence[stageIndex];
            currentHp = currentStage.hp;
            stageDisplay.textContent = `STAGE ${stageIndex + 1} / ${STAGE_TOTAL}`;
            tofuName.textContent = `${currentStage.name} HP`;

            tofuMaterial.color.setHex(currentStage.color);
            tofuMaterial.roughness = currentStage.roughness;
            tofuMaterial.metalness = currentStage.metalness;
            tofuMesh.scale.setScalar(currentStage.scale);
            tofuMesh.visible = true;
            toppingsGroup.visible = true;

            hpBarCatchup.style.width = '100%';
            updateHpUI();
        }

        // タイマー更新
        function updateTimer() {
            if (!isPlaying) return;
            const activeStageTime = stageStartTime ? performance.now() - stageStartTime : 0;
            timerDisplay.textContent = formatTime(elapsedTime + activeStageTime);
            timerInterval = requestAnimationFrame(updateTimer);
        }

        function selectTier(tiers, clearTimeMs) {
            return tiers.find(tier => tier.maxClearTimeMs === undefined || clearTimeMs <= tier.maxClearTimeMs).stage;
        }

        function formatTime(ms) {
            const totalSec = ms / 1000;
            const min = Math.floor(totalSec / 60);
            const sec = Math.floor(totalSec % 60);
            const milli = Math.floor(ms % 1000);
            return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
        }

        // ダメージ計算 & 攻撃実行
        function attack(baseDamage, attackType = 'normal', titleText = '') {
            if (!isPlaying || isStageTransitioning) return;

            // フィーバー補正
            const multiplier = isFever ? 2.5 : 1.0;
            const comboBonus = 1 + Math.min(combo * 0.02, 1.5);
            const totalDamage = Math.floor(baseDamage * multiplier * comboBonus);

            currentHp = Math.max(0, currentHp - totalDamage);
            updateHpUI();

            // コンボ増加
            combo++;
            updateComboUI();

            // フィーバーゲージ増加
            if (!isFever) {
                feverGauge = Math.min(100, feverGauge + 4);
                feverBar.style.width = `${feverGauge}%`;
                if (feverGauge >= 100) {
                    activateFever();
                }
            }

            // 豆腐の振動・変形トリガー
            squishFactor = attackType === 'heavy' ? 0.8 : 0.4;
            wobbleTime = 0;

            // プレイヤーアバターの突進アニメーション
            animatePlayerAttack();

            // 演出 & 音響
            if (attackType === 'heavy') {
                sound.playHit(true);
                triggerScreenShake('lg');
                spawnImpactParticles(new THREE.Vector3(0, 0, 1), 35, true);
                if (titleText) showCutin(titleText);
            } else {
                sound.playHit(false);
                sound.playPurun();
                triggerScreenShake('sm');
                spawnImpactParticles(new THREE.Vector3(0, 0, 1), 12, false);
            }

            // 撃破判定
            if (currentHp <= 0) {
                defeatCurrentStage();
            }
        }

        // HPバー更新
        function updateHpUI() {
            const percent = (currentHp / currentStage.hp) * 100;
            hpBar.style.width = `${percent}%`;
            hpText.textContent = `${currentHp.toLocaleString()} / ${currentStage.hp.toLocaleString()}`;
            setTimeout(() => {
                hpBarCatchup.style.width = `${percent}%`;
            }, 100);
        }

        // コンボUI更新
        function updateComboUI() {
            comboCount.textContent = combo;
            comboContainer.classList.remove('opacity-0');
            
            clearTimeout(comboResetTimer);
            comboResetTimer = setTimeout(() => {
                combo = 0;
                comboContainer.classList.add('opacity-0');
            }, 2000);
        }

        // フィーバーモード発動
        function activateFever() {
            isFever = true;
            document.body.classList.add('fever-bg');
            showCutin("超FEVER MODE!!");
            
            let feverTimeLeft = 5000;
            const feverInterval = setInterval(() => {
                feverTimeLeft -= 100;
                feverBar.style.width = `${(feverTimeLeft / 5000) * 100}%`;
                if (feverTimeLeft <= 0 || !isPlaying) {
                    clearInterval(feverInterval);
                    isFever = false;
                    feverGauge = 0;
                    document.body.classList.remove('fever-bg');
                }
            }, 100);
        }

        // 画面揺れ & フラッシュ
        function triggerScreenShake(type) {
            const body = document.body;
            body.classList.remove('shake-sm', 'shake-lg');
            void body.offsetWidth; // リフロー
            body.classList.add(type === 'lg' ? 'shake-lg' : 'shake-sm');

            if (type === 'lg') {
                const flash = document.createElement('div');
                flash.className = 'impact-flash';
                document.getElementById('overlay-flash').appendChild(flash);
                setTimeout(() => flash.remove(), 150);
            }
        }

        // テキストカットイン表示
        function showCutin(text) {
            const cutinText = document.getElementById('cutin-text');
            cutinText.textContent = text;
            cutinText.classList.remove('scale-0');
            cutinText.classList.add('scale-100');

            setTimeout(() => {
                cutinText.classList.remove('scale-100');
                cutinText.classList.add('scale-0');
            }, 600);
        }

        // プレイヤーの突進モーション
        function animatePlayerAttack() {
            if (!playerMesh) return;
            playerMesh.position.set(-1.5, 0, 1.5);
            setTimeout(() => {
                playerMesh.position.set(-5, -0.5, 3);
            }, 100);
        }

        function defeatCurrentStage() {
            const stageClearTimeMs = performance.now() - stageStartTime;
            elapsedTime += stageClearTimeMs;
            stageStartTime = 0;
            sound.playDestroy();

            tofuMesh.visible = false;
            toppingsGroup.visible = false;
            spawnImpactParticles(
                new THREE.Vector3(0, 0, 0),
                currentStageIndex === STAGE_TOTAL - 1 ? 180 : 100,
                true
            );
            triggerScreenShake('lg');

            if (currentStageIndex < STAGE_TOTAL - 1) {
                isStageTransitioning = true;
                pendingStageIndex = currentStageIndex + 1;
                stageSequence[pendingStageIndex] = pendingStageIndex === 1
                    ? selectTier(STAGE_TWO_TIERS, stageClearTimeMs)
                    : selectTier(FINAL_BOSS_TIERS, stageClearTimeMs);
                showChallengePanel(stageSequence[pendingStageIndex], stageClearTimeMs);
                return;
            }

            finishGame();
        }

        function showChallengePanel(nextStage, previousClearTimeMs) {
            challengeStage.textContent = `STAGE ${pendingStageIndex + 1} / ${STAGE_TOTAL}`;
            challengeTitle.textContent = `${nextStage.name} 登場！！`;
            challengeDetails.textContent =
                `前の豆腐を ${formatTime(previousClearTimeMs)} で撃破！挑戦する？`;
            modalScreen.classList.remove('hidden');
            startPanel.classList.add('hidden');
            resultPanel.classList.add('hidden');
            challengePanel.classList.remove('hidden');
            challengePanel.classList.add('flex');
        }

        function startNextStage() {
            if (!isPlaying || !isStageTransitioning || pendingStageIndex === null) return;
            loadStage(pendingStageIndex);
            pendingStageIndex = null;
            isStageTransitioning = false;
            stageStartTime = performance.now();
            challengePanel.classList.add('hidden');
            challengePanel.classList.remove('flex');
            modalScreen.classList.add('hidden');
        }

        // 全ステージのクリア処理
        function finishGame() {
            isPlaying = false;
            isStageTransitioning = false;
            cancelAnimationFrame(timerInterval);

            // ランク算出
            const timeInSec = elapsedTime / 1000;
            let rank = 'C';
            if (timeInSec < 40.0) rank = 'S';
            else if (timeInSec < 60.0) rank = 'A';
            else if (timeInSec < 90.0) rank = 'B';

            // ベストタイム保存
            let isNewRecord = false;
            if (!bestTime || elapsedTime < parseFloat(bestTime)) {
                bestTime = elapsedTime;
                localStorage.setItem(BEST_TIME_KEY, bestTime);
                isNewRecord = true;
            }

            // モーダル表示
            setTimeout(() => {
                document.getElementById('result-time').textContent = formatTime(elapsedTime);
                document.getElementById('rank-badge').textContent = rank;
                document.getElementById('new-record-tag').classList.toggle('hidden', !isNewRecord);
                resultHeading.textContent = 'ALL STAGES CLEARED!';
                resultMessage.textContent = '最強豆腐 完全破砕！';

                modalScreen.classList.remove('hidden');
                resultPanel.classList.remove('hidden');
                resultPanel.classList.add('flex');
            }, 1000);
        }


        /* ===================================================================
         *  4. CONTROLS & EVENT LISTENERS (キーボード & タッチ操作)
         * =================================================================== */
        
        // 技の定義
        const SKILLS = {
            attack1: { damage: 18000, name: "体当たり", type: "normal" },
            attack2: { damage: 28000, name: "スライディング", type: "normal" },
            attack3: { damage: 45000, name: "ドロップキック", type: "heavy" },
            chargeMax: { damage: 150000, name: "超絶極太突進！", type: "heavy" }
        };

        // ボタンのイベント割り当て
        document.getElementById('btn-attack-1').addEventListener('click', () => attack(SKILLS.attack1.damage, SKILLS.attack1.type));
        document.getElementById('btn-attack-2').addEventListener('click', () => attack(SKILLS.attack2.damage, SKILLS.attack2.type));
        document.getElementById('btn-attack-3').addEventListener('click', () => attack(SKILLS.attack3.damage, SKILLS.attack3.type, "ドロップキック！"));

        // 溜め技 (ボタン長押し & キー長押し)
        const btnCharge = document.getElementById('btn-charge');
        const chargeProgress = document.getElementById('charge-progress');

        function startCharge() {
            if (!isPlaying || isStageTransitioning || isCharging) return;
            isCharging = true;
            chargeStartTime = performance.now();
            sound.playCharge();
            updateChargeLoop();
        }

        function releaseCharge() {
            if (!isCharging) return;
            isCharging = false;
            const duration = performance.now() - chargeStartTime;
            chargeProgress.style.width = '0%';

            if (duration >= 700) {
                // 最大溜め発動
                attack(SKILLS.chargeMax.damage, SKILLS.chargeMax.type, SKILLS.chargeMax.name);
            } else {
                // 溜め足りない通常攻撃
                attack(SKILLS.attack1.damage * 1.5, "normal");
            }
        }

        function updateChargeLoop() {
            if (!isCharging) return;
            const duration = performance.now() - chargeStartTime;
            const progress = Math.min(100, (duration / 700) * 100);
            chargeProgress.style.width = `${progress}%`;

            if (duration < 700) {
                requestAnimationFrame(updateChargeLoop);
            }
        }

        // タッチ / マウスイベント
        btnCharge.addEventListener('mousedown', startCharge);
        btnCharge.addEventListener('mouseup', releaseCharge);
        btnCharge.addEventListener('mouseleave', releaseCharge);
        btnCharge.addEventListener('touchstart', (e) => { e.preventDefault(); startCharge(); });
        btnCharge.addEventListener('touchend', (e) => { e.preventDefault(); releaseCharge(); });

        // キーボード操作対応
        const keyState = {};
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            keyState[e.code] = true;

            if (e.code === 'KeyZ' || e.code === 'ArrowLeft') {
                attack(SKILLS.attack1.damage, SKILLS.attack1.type);
            } else if (e.code === 'KeyX' || e.code === 'ArrowRight') {
                attack(SKILLS.attack2.damage, SKILLS.attack2.type);
            } else if (e.code === 'KeyC' || e.code === 'ArrowUp') {
                attack(SKILLS.attack3.damage, SKILLS.attack3.type, "ドロップキック！");
            } else if (e.code === 'Space') {
                startCharge();
            }
        });

        window.addEventListener('keyup', (e) => {
            keyState[e.code] = false;
            if (e.code === 'Space') {
                releaseCharge();
            }
        });

        // UIボタン (スタート・リトライ・SNS共有)
        document.getElementById('btn-start').addEventListener('click', startGame);
        document.getElementById('btn-retry').addEventListener('click', startGame);
        document.getElementById('btn-challenge').addEventListener('click', startNextStage);
        
        document.getElementById('btn-share').addEventListener('click', () => {
            const timeStr = formatTime(elapsedTime);
            const text = `全3ステージを制覇！最強豆腐を【${timeStr}】で完全破砕しました！！\nランク: ${document.getElementById('rank-badge').textContent}\n#爆砕巨大豆腐 #タイムアタック #ゲーム`;
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        });


        /* ===================================================================
         *  5. ANIMATION LOOP (3D レンダリング & 物理・ぷるぷるアニメーション)
         * =================================================================== */
        function animate() {
            requestAnimationFrame(animate);

            // 豆腐のぷるぷる物理変形
            if (tofuMesh && tofuGeometry) {
                wobbleTime += 0.15;
                squishFactor *= 0.92; // 減衰

                const pos = tofuGeometry.attributes.position;
                const hpRatio = currentHp / currentStage.hp;

                for (let i = 0; i < pos.count; i++) {
                    const orig = originalVertices[i];
                    
                    // 1. 打撃による変形 (潰れ)
                    const wave = Math.sin(wobbleTime + orig.y * 2) * squishFactor * 0.3;
                    
                    // 2. HP低下によるヒビ・崩れ歪み
                    const damageDeform = (1 - hpRatio) * (Math.sin(i * 99) * 0.25);

                    pos.setX(i, orig.x + wave * (orig.x * 0.5) + damageDeform);
                    pos.setY(i, orig.y - squishFactor * 0.2 + damageDeform);
                    pos.setZ(i, orig.z + wave * (orig.z * 0.5) + damageDeform);
                }
                tofuGeometry.computeVertexNormals();
                tofuGeometry.attributes.position.needsUpdate = true;

                // 豆腐自体のゆっくりした浮遊/揺れ
                tofuMesh.rotation.y = Math.sin(Date.now() * 0.001) * 0.05;
                toppingsGroup.rotation.y = tofuMesh.rotation.y;
            }

            // パーティクルの物理移動・減衰
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.mesh.position.addScaledVector(p.velocity, 0.016);
                p.velocity.y -= 0.25; // 重力
                p.mesh.rotation.x += p.rotSpeed.x;
                p.mesh.rotation.y += p.rotSpeed.y;
                p.life -= 0.02;

                if (p.life <= 0) {
                    scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mesh.material.dispose();
                    particles.splice(i, 1);
                }
            }

            renderer.render(scene, camera);
        }

        // 初期化実行 & 描画開始
        window.onload = () => {
            init3D();
            animate();
        };

    