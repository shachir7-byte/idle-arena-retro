const { createApp } = Vue;

createApp({
    data() {
        return {
            auth: { login: '' },
            gameState: {
                isAuth: false,
                mode: 'normal',
                user: { name: '', gold: 0, statPoints: 0 },
                player: { hp: 100, maxHp: 100, clickDmg: 5, def: 0 },
                level: 1,
                inventory: []
            },
            currentMonster: { name: '', hp: 0, maxHp: 0, icon: '', imgFile: '', isMiniBoss: false, attackDmg: 0 },
            isWaitingNextLevel: false,
            lastReward: 0,
            isShaking: false,
            showEnemyImage: true, // флаг: показывать ли картинку
            
            autoOn: false,
            autoInterval: null,
            ultReady: true,
            ultTimer: 0,

            quotes: [
                "Враг повержен, но впереди новые испытания.",
                "Твоя сила растет с каждым ударом.",
                "Осторожно, следующие враги опаснее.",
                "Золото любит смелых."
            ],

            weaponsStore: [
                { id: 1, name: 'Ржавый нож', dmg: 3, price: 50, owned: false },
                { id: 2, name: 'Дубовая палица', dmg: 8, price: 150, owned: false },
                { id: 3, name: 'Железный меч', dmg: 15, price: 400, owned: false },
                { id: 4, name: 'Стальной топор', dmg: 25, price: 1000, owned: false },
                { id: 5, name: 'Булава Ярости', dmg: 40, price: 2500, owned: false },
                { id: 6, name: 'Рыцарское копье', dmg: 65, price: 6000, owned: false },
                { id: 7, name: 'Волкобой', dmg: 100, price: 15000, owned: false }
            ],
            legendaries: []
        }
    },
    computed: {
        isBossLevel() {
            return this.gameState.level % 5 === 0;
        },
        currentQuote() {
            if (this.isWaitingNextLevel) return this.quotes[this.gameState.level % this.quotes.length];
            return "";
        },
        leaderboard() {
            let db = JSON.parse(localStorage.getItem('marder_db') || '[]');
            return db.sort((a, b) => b.level - a.level).slice(0, 5);
        },
        enemyImagePath() {
            if (!this.currentMonster.imgFile) return '';
            return 'templates/' + this.currentMonster.imgFile;
        }
    },
    methods: {
        handleAuth(mode) {
            if (!this.auth.login.trim()) return alert('введи имя');
            let db = JSON.parse(localStorage.getItem('marder_db') || '[]');
            let saved = db.find(u => u.user.name === this.auth.login && u.mode === mode);
            
            if (saved) {
                this.gameState = JSON.parse(JSON.stringify(saved));
                this.syncWeapons();
            } else {
                this.gameState.user.name = this.auth.login;
                this.gameState.mode = mode;
                this.gameState.player = { hp: 100, maxHp: 100, clickDmg: 5, def: 0 };
                this.gameState.level = 1;
                this.gameState.user.gold = 0;
                this.gameState.user.statPoints = 0;
                this.gameState.inventory = [];
                this.legendaries = [];
                this.weaponsStore.forEach(w => w.owned = false);
            }
            this.gameState.isAuth = true;
            this.spawnMonster();
            this.startCombatLoop();
        },

        syncWeapons() {
            this.weaponsStore.forEach(w => {
                if (this.gameState.inventory.includes(w.id)) w.owned = true;
            });
            this.legendaries = [];
            if (this.gameState.inventory.includes(105)) this.legendaries.push({name: 'Ядро Короля Слизней'});
            if (this.gameState.inventory.includes(110)) this.legendaries.push({name: 'Клык Барона'});
            if (this.gameState.inventory.includes(115)) this.legendaries.push({name: 'Посох Байкал'}); // Новый
            if (this.gameState.inventory.includes(120)) this.legendaries.push({name: 'Меха-броня'}); // Новый
            if (this.gameState.inventory.includes(125)) this.legendaries.push({name: 'Клинок Смерти'});
        },

        // Обработка ошибки загрузки картинки
        onImageError() {
            this.showEnemyImage = false;
        },

        spawnMonster() {
            this.isWaitingNextLevel = false;
            this.showEnemyImage = true; // Сброс флага при новом спавне (пытаемся грузить картинку)
            
            let lvl = this.gameState.level;
            let m = { name: '', icon: '', imgFile: '', isMiniBoss: false, hp: 0, maxHp: 0, attackDmg: 0 };
            let isBoss = (lvl % 5 === 0);
            
            // Логика мини-боссов (после 25 этажа, шанс 20%)
            let isMiniBoss = false;
            if (lvl > 25 && !isBoss && Math.random() < 0.2) {
                isMiniBoss = true;
            }

            if (isMiniBoss) {
                // Мини-боссы
                const pool = [
                    {n:'Демон', i:'👿', f:'DEMON.png'},
                    {n:'Дракон', i:'🐉', f:'DRAGON.png'},
                    {n:'Призрак', i:'👻', f:'PRIZRAK.png'}
                ];
                let rnd = pool[Math.floor(Math.random() * pool.length)];
                m.name = `МИНИ-БОСС: ${rnd.n} ${lvl} ур.`;
                m.icon = rnd.i;
                m.imgFile = rnd.f;
                m.isMiniBoss = true;
                // Мини-боссы жирнее обычных
                let scale = Math.pow(1.4, lvl - 1);
                m.hp = Math.floor(1000 * scale);
                m.attackDmg = Math.floor(15 + (lvl * 4));
            } 
            else if (lvl <= 4) { 
                m.name = 'Малый слизень'; m.icon = '🦠'; m.imgFile = 'slime.png'; 
            } else if (lvl === 5) { 
                m.name = 'БОСС: Король Слизней'; m.icon = '👑🦠'; m.imgFile = 'BOSS_slime.png'; 
            } else if (lvl <= 9) { 
                m.name = 'Чумная крыса'; m.icon = '🐀'; m.imgFile = 'rat.png'; 
            } else if (lvl === 10) { 
                m.name = 'БОСС: Крысиный Барон'; m.icon = '👺🐀'; m.imgFile = 'BOSS_rat.png'; 
            } else if (lvl <= 14) { 
                m.name = 'Гоблин-вор'; m.icon = '👺'; m.imgFile = 'goblin.png'; 
            } else if (lvl === 15) { 
                m.name = 'БОСС: Гоблин-Шаман'; m.icon = '🔮👺'; m.imgFile = 'BOSS_goblin.png'; 
            } else if (lvl <= 19) { 
                m.name = 'Дикий Кабан'; m.icon = '🐗'; m.imgFile = 'kaban.png'; 
            } else if (lvl === 20) { 
                m.name = 'БОСС: Меха-Кабан'; m.icon = '🤖🐗'; m.imgFile = 'BOSS_kaban.png'; 
            } else if (lvl <= 24) { 
                m.name = 'Скелет-воин'; m.icon = '💀'; m.imgFile = 'skeleton.png'; 
            } else if (lvl === 25) { 
                m.name = 'БОСС: Рыцарь Смерти'; m.icon = '🐎💀'; m.imgFile = 'BOSS_final.png'; 
            } else {
                // Обычные мобы после 25 (рандом из пула 1-25 без боссов)
                const normalPool = [
                    {n:'Слизень', i:'🦠', f:'slime.png'}, {n:'Крыса', i:'🐀', f:'rat.png'},
                    {n:'Гоблин', i:'👺', f:'goblin.png'}, {n:'Кабан', i:'🐗', f:'kaban.png'},
                    {n:'Скелет', i:'💀', f:'skeleton.png'}
                ];
                let rnd = normalPool[Math.floor(Math.random() * normalPool.length)];
                m.name = `${rnd.n} ${lvl} ур.`;
                m.icon = rnd.i;
                m.imgFile = rnd.f;
            }

            // Если не мини-босс и не обычный после 25, считаем статы по стандарту
            if (!isMiniBoss && !(lvl > 25 && !isBoss)) {
                let scale = Math.pow(1.35, lvl - 1);
                let baseHp = isBoss ? 800 : 150;
                m.hp = Math.floor(baseHp * scale);
                m.attackDmg = Math.floor(8 + (lvl * 3));
            }
            
            m.maxHp = m.hp;
            this.currentMonster = m;
        },

        playerAttack() {
            if (this.isWaitingNextLevel || this.currentMonster.hp <= 0) return;
            this.isShaking = true;
            setTimeout(() => this.isShaking = false, 100);
            this.currentMonster.hp -= this.gameState.player.clickDmg;
            if (this.currentMonster.hp <= 0) this.monsterDie();
        },

        monsterDie() {
            this.currentMonster.hp = 0;
            this.isWaitingNextLevel = true;
            
            let baseGold = 10 * this.gameState.level;
            if (this.isBossLevel) baseGold *= 5;
            if (this.currentMonster.isMiniBoss) baseGold *= 8; // Мини-босс дает много золота
            if (this.gameState.mode === 'hardcore') baseGold *= 2;
            
            this.lastReward = baseGold;
            this.gameState.user.gold += baseGold;
            this.gameState.user.statPoints += 3;

            this.checkLegendaryDrop();
            this.save();
        },

        checkLegendaryDrop() {
            let lvl = this.gameState.level;
            // 5 этаж
            if (lvl === 5 && !this.gameState.inventory.includes(105)) {
                this.gameState.inventory.push(105);
                this.gameState.player.clickDmg += 15;
                alert('ВЫПАЛО: Ядро Короля Слизней (+15 Урона)');
                this.syncWeapons();
            }
            // 10 этаж
            if (lvl === 10 && !this.gameState.inventory.includes(110)) {
                this.gameState.inventory.push(110);
                this.gameState.player.clickDmg += 30;
                alert('ВЫПАЛО: Клык Барона (+30 Урона)');
                this.syncWeapons();
            }
            // 15 этаж (НОВОЕ: Посох)
            if (lvl === 15 && !this.gameState.inventory.includes(115)) {
                this.gameState.inventory.push(115);
                this.gameState.player.clickDmg += 50;
                alert('ВЫПАЛО: Посох Байкал (+50 Урона)');
                this.syncWeapons();
            }
            // 20 этаж (НОВОЕ: Броня)
            if (lvl === 20 && !this.gameState.inventory.includes(120)) {
                this.gameState.inventory.push(120);
                this.gameState.player.def += 80;
                alert('ВЫПАЛО: Меха-броня (+80 Защиты)');
                this.syncWeapons();
            }
            // 25 этаж
            if (lvl === 25 && !this.gameState.inventory.includes(125)) {
                this.gameState.inventory.push(125);
                this.gameState.player.clickDmg += 100;
                alert('ВЫПАЛО: Клинок Смерти (+100 Урона)');
                this.syncWeapons();
            }
        },

        nextLevel() {
            this.gameState.level++;
            this.spawnMonster();
        },

        upgradeStat(type) {
            if (this.gameState.user.statPoints <= 0) return;
            this.gameState.user.statPoints--;
            if (type === 'str') this.gameState.player.clickDmg += 5;
            else if (type === 'vit') { 
                this.gameState.player.maxHp += 25; 
                this.gameState.player.hp = this.gameState.player.maxHp; 
            }
            else if (type === 'def') this.gameState.player.def += 2;
            this.save();
        },

        buyWeapon(w) {
            if (this.gameState.user.gold >= w.price && !w.owned) {
                this.gameState.user.gold -= w.price;
                this.gameState.player.clickDmg += w.dmg;
                w.owned = true;
                this.gameState.inventory.push(w.id);
                this.save();
            }
        },

        startCombatLoop() {
            setInterval(() => {
                if (this.gameState.isAuth && !this.isWaitingNextLevel && this.gameState.player.hp > 0) {
                    let dmg = Math.max(1, this.currentMonster.attackDmg - this.gameState.player.def);
                    this.gameState.player.hp -= dmg;
                    if (this.gameState.player.hp <= 0) this.playerDie();
                }
            }, 2000);
        },

        playerDie() {
            this.gameState.player.hp = 0;
            if (this.gameState.mode === 'hardcore') {
                alert('GAME OVER! Прогресс сброшен.');
                localStorage.removeItem('marder_db');
                location.reload();
            } else {
                alert('Вы погибли. Здоровье восстановлено.');
                this.gameState.player.hp = this.gameState.player.maxHp;
                this.spawnMonster();
                this.save();
            }
        },

        useUltimate() {
            if (!this.ultReady || this.isWaitingNextLevel) return;
            this.currentMonster.hp -= (this.gameState.player.clickDmg * 15);
            if (this.currentMonster.hp <= 0) this.monsterDie();
            this.ultReady = false;
            this.ultTimer = 20;
            let t = setInterval(() => {
                this.ultTimer--;
                if (this.ultTimer <= 0) { this.ultReady = true; clearInterval(t); }
            }, 1000);
        },

        toggleAuto() {
            this.autoOn = !this.autoOn;
            if (this.autoOn) {
                this.autoInterval = setInterval(() => {
                    if (!this.isWaitingNextLevel) this.playerAttack();
                }, 300);
            } else {
                clearInterval(this.autoInterval);
            }
        },

        save() {
            let db = JSON.parse(localStorage.getItem('marder_db') || '[]');
            let idx = db.findIndex(u => u.user.name === this.gameState.user.name && u.mode === this.gameState.mode);
            if (idx > -1) db[idx] = JSON.parse(JSON.stringify(this.gameState));
            else db.push(JSON.parse(JSON.stringify(this.gameState)));
            localStorage.setItem('marder_db', JSON.stringify(db));
        },

        logout() { location.reload(); }
    }
}).mount('#app');