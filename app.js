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
            currentMonster: { name: '', hp: 0, maxHp: 0, icon: '', attackDmg: 0, imgFile: '', isMiniBoss: false },
            isWaitingNextLevel: false,
            lastReward: 0,
            isShaking: false,
            showEmoji: false,
            
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
        isAdmin() {
            const name = this.gameState.user.name.toLowerCase();
            return name === 'admin' || name === 'админ';
        },
        isBossLevel() {
            return this.gameState.level % 5 === 0 && this.gameState.level <= 25;
        },
        currentQuote() {
            if (this.isWaitingNextLevel) {
                return this.quotes[this.gameState.level % this.quotes.length];
            }
            return "";
        },
        leaderboard() {
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            // Админы не попадают в таблицу лидеров
            return db.filter(u => {
                const n = u.user.name.toLowerCase();
                return n !== 'admin' && n !== 'админ';
            }).sort((a, b) => b.level - a.level).slice(0, 5);
        },
        enemyImage() {
            if (!this.currentMonster.imgFile) return null;
            return 'templates/' + this.currentMonster.imgFile;
        }
    },
    methods: {
        // Возвращает объект классов для заголовка (безопасно для Vue)
        getHeaderClass() {
            return {
                'boss-text': this.isBossLevel || this.currentMonster.isMiniBoss
            };
        },
        isBossActive() {
            return this.isBossLevel || this.currentMonster.isMiniBoss;
        },
        isMiniBossActive() {
            return this.currentMonster.isMiniBoss;
        },
        getHpPercent() {
            return (this.gameState.player.hp / this.gameState.player.maxHp) * 100;
        },
        getEnemyHpPercent() {
            if (this.currentMonster.maxHp === 0) return 0;
            return (this.currentMonster.hp / this.currentMonster.maxHp) * 100;
        },
        formatNumber(num) {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num;
        },

        handleAuth(mode) {
            if (!this.auth.login.trim()) return alert('введи имя игрока');
            
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            let saved = db.find(u => u.user.name === this.auth.login && u.mode === mode);
            
            if (saved) {
                this.gameState = JSON.parse(JSON.stringify(saved));
                this.syncWeapons();
            } else {
                this.gameState.user.name = this.auth.login;
                this.gameState.mode = mode;
                // Если админ - даем много ХП для теста, но обычный старт
                if (this.isAdmin) {
                    this.gameState.player = { hp: 100000, maxHp: 100000, clickDmg: 1000000000, def: 9999 };
                } else {
                    this.gameState.player = { hp: 100, maxHp: 100, clickDmg: 5, def: 0 };
                    this.gameState.level = 1;
                    this.gameState.user.gold = 0;
                    this.gameState.user.statPoints = 0;
                    this.gameState.inventory = [];
                    this.legendaries = [];
                    this.weaponsStore.forEach(w => w.owned = false);
                }
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
            if (this.gameState.inventory.includes(115)) this.legendaries.push({name: 'Посох Байкал'});
            if (this.gameState.inventory.includes(120)) this.legendaries.push({name: 'Меха-броня'});
            if (this.gameState.inventory.includes(125)) this.legendaries.push({name: 'Клинок Смерти'});
        },

        spawnMonster() {
            this.isWaitingNextLevel = false;
            this.showEmoji = false;
            let lvl = this.gameState.level;
            let m = { name: '', icon: '', imgFile: '', hp: 0, maxHp: 0, attackDmg: 0, isMiniBoss: false };

            // Логика спавна
            if (lvl <= 25) {
                // Обычная иерархия до 25
                if (lvl <= 4) { m.name = 'Малый слизень'; m.icon = '🦠'; m.imgFile = 'slime.png'; }
                else if (lvl === 5) { m.name = 'БОСС: Король Слизней'; m.icon = '👑🦠'; m.imgFile = 'BOSS_slime.png'; }
                else if (lvl <= 9) { m.name = 'Чумная крыса'; m.icon = '🐀'; m.imgFile = 'rat.png'; }
                else if (lvl === 10) { m.name = 'БОСС: Крысиный Барон'; m.icon = '👺🐀'; m.imgFile = 'BOSS_rat.png'; }
                else if (lvl <= 14) { m.name = 'Гоблин-вор'; m.icon = '👺'; m.imgFile = 'goblin.png'; }
                else if (lvl === 15) { m.name = 'БОСС: Гоблин-Шаман'; m.icon = '🔮👺'; m.imgFile = 'BOSS_goblin.png'; }
                else if (lvl <= 19) { m.name = 'Дикий Кабан'; m.icon = '🐗'; m.imgFile = 'kaban.png'; }
                else if (lvl === 20) { m.name = 'БОСС: Меха-Кабан'; m.icon = '🤖🐗'; m.imgFile = 'BOSS_kaban.png'; }
                else if (lvl <= 24) { m.name = 'Скелет-воин'; m.icon = '💀'; m.imgFile = 'skeleton.png'; }
                else if (lvl === 25) { m.name = 'БОСС: Рыцарь Смерти'; m.icon = '🐎💀'; m.imgFile = 'BOSS_final.png'; }
            } else {
                // После 25 этажа: 20% мини-босс, 80% обычный моб
                let isMini = Math.random() < 0.2;
                
                if (isMini) {
                    m.isMiniBoss = true;
                    const pool = [
                        {n:'Демон', i:'👿', f:'DEMON.png'}, 
                        {n:'Дракон', i:'🐉', f:'DRAGON.png'}, 
                        {n:'Призрак', i:'👻', f:'PRIZRAK.png'}
                    ];
                    let rnd = pool[lvl % 3];
                    m.name =rnd.n + ' (Ур. ' + lvl + ')'; 
                    m.icon = rnd.i; 
                    m.imgFile = rnd.f;
                    // Мини-боссы жирнее
                    let scale = Math.pow(1.5, lvl - 1);
                    m.hp = Math.floor(2000 * scale);
                    m.attackDmg = Math.floor(50 + (lvl * 10));
                } else {
                    // Обычный моб (рандом из пула 1-25 без боссов)
                    const mobs = [
                        {n:'Слизень', i:'🦠', f:'slime.png'}, {n:'Крыса', i:'🐀', f:'rat.png'},
                        {n:'Гоблин', i:'👺', f:'goblin.png'}, {n:'Кабан', i:'🐗', f:'kaban.png'},
                        {n:'Скелет', i:'💀', f:'skeleton.png'}
                    ];
                    let rnd = mobs[lvl % mobs.length];
                    m.name = rnd.n + ' ' + lvl + ' ур.'; 
                    m.icon = rnd.i; 
                    m.imgFile = rnd.f;
                    let scale = Math.pow(1.35, lvl - 1);
                    m.hp = Math.floor(150 * scale);
                    m.attackDmg = Math.floor(10 + (lvl * 4));
                }
            }

            // Если не задано вручную (для обычных до 25)
            if (m.hp === 0) {
                let scale = Math.pow(1.35, lvl - 1);
                let baseHp = (lvl % 5 === 0) ? 800 : 150;
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

            // Урон
            let dmg = this.gameState.player.clickDmg;
            this.currentMonster.hp -= dmg;
            
            if (this.currentMonster.hp <= 0) {
                this.monsterDie();
            }
        },

        // УБИЙСТВО АДМИНОМ (ВАНШОТ)
        godModeKill() {
            if (this.isWaitingNextLevel) return;
            this.currentMonster.hp = 0;
            this.monsterDie();
        },

        monsterDie() {
            this.currentMonster.hp = 0;
            this.isWaitingNextLevel = true;
            
            let baseGold = 10 * this.gameState.level;
            if (this.isBossLevel) baseGold *= 5;
            if (this.currentMonster.isMiniBoss) baseGold *= 10; // Мини-босс дает больше
            if (this.gameState.mode === 'hardcore') baseGold *= 2;
            
            this.lastReward = baseGold;
            this.gameState.user.gold += baseGold;
            this.gameState.user.statPoints += 3;

            this.checkLegendaryDrop();
            
            // Сохраняем только если НЕ админ
            if (!this.isAdmin) {
                this.save();
            }
        },

        checkLegendaryDrop() {
            let lvl = this.gameState.level;
            if (lvl === 5 && !this.gameState.inventory.includes(105)) {
                this.gameState.inventory.push(105);
                this.gameState.player.clickDmg += 15;
                alert('ВЫПАЛО: Ядро Короля Слизней!');
                this.syncWeapons();
            }
            if (lvl === 10 && !this.gameState.inventory.includes(110)) {
                this.gameState.inventory.push(110);
                this.gameState.player.clickDmg += 30;
                alert('ВЫПАЛО: Клык Барона!');
                this.syncWeapons();
            }
            if (lvl === 15 && !this.gameState.inventory.includes(115)) {
                this.gameState.inventory.push(115);
                this.gameState.player.clickDmg += 50;
                alert('ВЫПАЛО: Посох Байкал!');
                this.syncWeapons();
            }
            if (lvl === 20 && !this.gameState.inventory.includes(120)) {
                this.gameState.inventory.push(120);
                this.gameState.player.def += 80;
                alert('ВЫПАЛО: Меха-броня!');
                this.syncWeapons();
            }
            if (lvl === 25 && !this.gameState.inventory.includes(125)) {
                this.gameState.inventory.push(125);
                this.gameState.player.clickDmg += 100;
                alert('ВЫПАЛО: Клинок Смерти!');
                this.syncWeapons();
            }
        },

        nextLevel() {
            this.gameState.level++;
            this.spawnMonster();
        },

        upgradeStat(type) {
            if (this.gameState.user.statPoints <= 0 || this.isAdmin) return;
            this.gameState.user.statPoints--;
            if (type === 'str') this.gameState.player.clickDmg += 5;
            if (type === 'vit') { 
                this.gameState.player.maxHp += 25; 
                this.gameState.player.hp = this.gameState.player.maxHp; 
            }
            if (type === 'def') this.gameState.player.def += 2;
            this.save();
        },

        buyWeapon(w) {
            if (this.gameState.user.gold >= w.price && !w.owned) {
                this.gameState.user.gold -= w.price;
                this.gameState.player.clickDmg += w.dmg;
                w.owned = true;
                this.gameState.inventory.push(w.id);
                if (!this.isAdmin) this.save();
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
            if (this.gameState.mode === 'hardcore' && !this.isAdmin) {
                alert('GAME OVER! Хардкор завершен.');
                localStorage.removeItem('arena_db');
                location.reload();
            } else {
                alert('ВЫ ПОГИБЛИ! Здоровье восстановлено.');
                this.gameState.player.hp = this.gameState.player.maxHp;
                this.spawnMonster();
                if (!this.isAdmin) this.save();
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
                    if (!this.isWaitingNextLevel) {
                        if (this.isAdmin) {
                            this.godModeKill(); // Админ ваншотит на авто
                        } else {
                            this.playerAttack();
                        }
                    }
                }, 300);
            } else {
                clearInterval(this.autoInterval);
            }
        },

        save() {
            if (this.isAdmin) return; // Админ не сохраняется
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            let idx = db.findIndex(u => u.user.name === this.gameState.user.name && u.mode === this.gameState.mode);
            if (idx > -1) db[idx] = JSON.parse(JSON.stringify(this.gameState));
            else db.push(JSON.parse(JSON.stringify(this.gameState)));
            localStorage.setItem('arena_db', JSON.stringify(db));
        },

        logout() {
            location.reload();
        }
    }
}).mount('#app');