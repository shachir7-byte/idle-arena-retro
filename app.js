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
            currentMonster: { name: '', hp: 0, maxHp: 0, icon: '', imgFile: '', attackDmg: 0, isMiniBoss: false },
            isWaitingNextLevel: false,
            lastReward: 0,
            isShaking: false,
            autoOn: false,
            autoInterval: null,
            ultReady: true,
            ultTimer: 0,
            quotes: [
                "враг повержен, но впереди новые испытания.",
                "твоя сила растет с каждым ударом.",
                "осторожно, следующие враги опаснее.",
                "золото любит смелых."
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
        // проверка на босса (каждые 5 уровней)
        isBossLevel() {
            return this.gameState.level % 5 === 0;
        },
        // текущая цитата
        currentQuote() {
            if (this.isWaitingNextLevel) {
                return this.quotes[this.gameState.level % this.quotes.length];
            }
            return "";
        },
        // топ игроков
        leaderboard() {
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            return db.sort((a, b) => b.level - a.level).slice(0, 5);
        },
        // путь к картинке
        enemyImage() {
            if (!this.currentMonster.imgFile) return null;
            return 'templates/' + this.currentMonster.imgFile;
        },
        // флаг админа
        isAdmin() {
            const name = this.gameState.user.name.toLowerCase();
            return name === 'admin' || name === 'админ';
        }
    },
    methods: {
        // --- методы для HTML (фикс ошибки) ---
        isBossActive() {
            return this.isBossLevel || (this.currentMonster && this.currentMonster.isMiniBoss);
        },
        isMiniBossActive() {
            return this.currentMonster && this.currentMonster.isMiniBoss;
        },
        // -------------------------------------------

        // вход в игру
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
                // если админ - даем много хп для теста, но статы базовые
                if (this.isAdmin) {
                    this.gameState.player.hp = 100000;
                    this.gameState.player.maxHp = 100000;
                    this.gameState.player.clickDmg = 358079; // урон админа
                    this.gameState.player.def = 1000;
                    this.gameState.user.gold = 999999;
                    this.gameState.user.statPoints = 999;
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

        // синхрон инвентаря
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

        // спавн моба
        spawnMonster() {
            this.isWaitingNextLevel = false;
            let lvl = this.gameState.level;
            let m = { name: '', icon: '', imgFile: '', hp: 0, maxHp: 0, attackDmg: 0, isMiniBoss: false };

            // логика спавна
            if (lvl <= 25) {
                // обычная иерархия до 25
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
                // после 25 этажа: рандом или мини-босс
                let isMini = Math.random() < 0.2; // 20% шанс
                if (isMini) {
                    m.isMiniBoss = true;
                    const pool = [
                        {n:'Демон', i:'👿', f:'DEMON.png'}, 
                        {n:'Дракон', i:'🐉', f:'DRAGON.png'}, 
                        {n:'Призрак', i:'👻', f:'PRIZRAK.png'}
                    ];
                    let rnd = pool[Math.floor(Math.random() * pool.length)];
                    m.name = rnd.n + ' (Ур. ' + lvl + ')'; 
                    m.icon = rnd.i; 
                    m.imgFile = rnd.f;
                    // мини-боссы жирнее
                    let scale = Math.pow(1.35, lvl - 1);
                    m.hp = Math.floor(1000 * scale);
                    m.attackDmg = Math.floor(20 + (lvl * 4));
                } else {
                    // обычный моб (рандом из пула 1-25 без боссов)
                    const mobs = [
                        {n:'Слизень', f:'slime.png'}, {n:'Крыса', f:'rat.png'}, 
                        {n:'Гоблин', f:'goblin.png'}, {n:'Кабан', f:'kaban.png'}, 
                        {n:'Скелет', f:'skeleton.png'}
                    ];
                    let rnd = mobs[Math.floor(Math.random() * mobs.length)];
                    m.name = rnd.n + ' ' + lvl + ' ур.';
                    m.imgFile = rnd.f;
                    m.icon = '❓'; // заглушка, если нет картинки
                }
            }

            // если статы не заданы (для обычных мобов до 25 и некоторых рандомных…)
            if (m.hp === 0) {
                let scale = Math.pow(1.35, lvl - 1);
                let baseHp = (lvl % 5 === 0) ? 800 : 150;
                m.hp = Math.floor(baseHp * scale);
                m.attackDmg = Math.floor(8 + (lvl * 3));
            }
            
            m.maxHp = m.hp;
            this.currentMonster = m;
        },

        // удар игрока
        playerAttack() {
            if (this.isWaitingNextLevel || this.currentMonster.hp <= 0) return;
            
            this.isShaking = true;
            setTimeout(() => this.isShaking = false, 100);

            this.currentMonster.hp -= this.gameState.player.clickDmg;
            
            if (this.currentMonster.hp <= 0) {
                this.monsterDie();
            }
        },

        // ультиматум (игрок x15, админ ваншот)
        useUltimate() {
            if (!this.ultReady || this.isWaitingNextLevel) return;
            
            // если админ - просто убиваем сразу
            if (this.isAdmin) {
                this.currentMonster.hp = 0;
                this.monsterDie();
                return;
            }

            // для обычных - урон x15
            this.currentMonster.hp -= (this.gameState.player.clickDmg * 15);
            if (this.currentMonster.hp <= 0) this.monsterDie();
            
            this.ultReady = false;
            this.ultTimer = 20;
            let timerId = setInterval(() => {
                this.ultTimer--;
                if (this.ultTimer <= 0) {
                    this.ultReady = true;
                    clearInterval(timerId);
                }
            }, 1000);
        },

        // мгновенное убийство (только админ)
        instantKill() {
            if (!this.isAdmin) return;
            this.currentMonster.hp = 0;
            this.monsterDie();
        },

        // смерть монстра
        monsterDie() {
            this.currentMonster.hp = 0;
            this.isWaitingNextLevel = true;
            
            let baseGold = 10 * this.gameState.level;
            if (this.isBossLevel) baseGold *= 5;
            if (this.currentMonster.isMiniBoss) baseGold *= 10; // мини-босс дает больше
            if (this.gameState.mode === 'hardcore' && !this.isAdmin) baseGold *= 2;
            
            this.lastReward = baseGold;
            
            // админ не фармит золото реально, но для вида можно добавить
            if (!this.isAdmin) {
                this.gameState.user.gold += baseGold;
                this.gameState.user.statPoints += 3;
                this.checkLegendaryDrop();
            } else {
                this.lastReward = 99999; // фейк награда для админа
            }

            this.save();
        },

        // дроп легандарок
        checkLegendaryDrop() {
            let lvl = this.gameState.level;
            
            // 5 эт - ядро
            if (lvl === 5 && !this.gameState.inventory.includes(105)) {
                this.gameState.inventory.push(105);
                this.gameState.player.clickDmg += 15;
                alert('выпало: Ядро Короля Слизней (+15 Урона)');
                this.syncWeapons();
            }
            
            // 10 эт - клык
            if (lvl === 10 && !this.gameState.inventory.includes(110)) {
                this.gameState.inventory.push(110);
                this.gameState.player.clickDmg += 30;
                alert('выпало: Клык Барона (+30 Урона)');
                this.syncWeapons();
            }

            // 15 эт - посох
            if (lvl === 15 && !this.gameState.inventory.includes(115)) {
                this.gameState.inventory.push(115);
                this.gameState.player.clickDmg += 50;
                alert('выпало: Посох Байкал (+50 Урона)');
                this.syncWeapons();
            }

            // 20 эт - броня
            if (lvl === 20 && !this.gameState.inventory.includes(120)) {
                this.gameState.inventory.push(120);
                this.gameState.player.def += 80;
                alert('выпало: Меха-броня (+80 Защиты)');
                this.syncWeapons();
            }

            // 25 эт - клинок
            if (lvl === 25 && !this.gameState.inventory.includes(125)) {
                this.gameState.inventory.push(125);
                this.gameState.player.clickDmg += 100;
                alert('выпало: Клинок Смерти (+100 Урона)');
                this.syncWeapons();
            }
        },

        // след уровень
        nextLevel() {
            this.gameState.level++;
            this.spawnMonster();
        },

        // прокачка статов
        upgradeStat(type) {
            // админ качает без ограничений
            if (!this.isAdmin && this.gameState.user.statPoints <= 0) return;
            
            if (!this.isAdmin) this.gameState.user.statPoints--;
            
            if (type === 'str') this.gameState.player.clickDmg += 5;
            else if (type === 'vit') { 
                this.gameState.player.maxHp += 25; 
                this.gameState.player.hp = this.gameState.player.maxHp; 
            }
            else if (type === 'def') this.gameState.player.def += 2;
            
            this.save();
        },

        // покупка оружия
        buyWeapon(w) {
            if (this.isAdmin || (this.gameState.user.gold >= w.price && !w.owned)) {
                if (!this.isAdmin) this.gameState.user.gold -= w.price;
                this.gameState.player.clickDmg += w.dmg;
                w.owned = true;
                this.gameState.inventory.push(w.id);
                this.save();
            }
        },

        // цикл боя (разделен на авто и ответку)
        startCombatLoop() {
            // быстрый цикл для авто-атаки (100мс)
            setInterval(() => {
                if (this.gameState.isAuth && !this.isWaitingNextLevel && this.autoOn) {
                    this.playerAttack();
                }
            }, 100);

            // медленный цикл для атаки монстра (2000мс)
            setInterval(() => {
                if (this.gameState.isAuth && !this.isWaitingNextLevel && this.gameState.player.hp > 0) {
                    let dmg = Math.max(1, this.currentMonster.attackDmg - this.gameState.player.def);
                    // админ почти не получает урона
                    if (this.isAdmin) dmg = 1; 
                    
                    this.gameState.player.hp -= dmg;
                    if (this.gameState.player.hp <= 0) this.playerDie();
                }
            }, 2000);
        },

        // вкл/выкл авто
        toggleAuto() {
            this.autoOn = !this.autoOn;
            // если включили авто, делаем первый клик сразу
            if (this.autoOn && !this.isWaitingNextLevel) this.playerAttack();
        },

        // смерть игрока
        playerDie() {
            this.gameState.player.hp = 0;
            if (this.gameState.mode === 'hardcore' && !this.isAdmin) {
                alert('GAME OVER! Хардкор завершен.');
                localStorage.removeItem('arena_db');
                location.reload();
            } else {
                alert('вы погибли. хп восстановлено.');
                this.gameState.player.hp = this.gameState.player.maxHp;
                this.spawnMonster();
                this.save();
            }
        },

        // сохранение
        save() {
            if (this.isAdmin) return; // админ не сохраняется
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            let idx = db.findIndex(u => u.user.name === this.gameState.user.name && u.mode === this.gameState.mode);
            if (idx > -1) db[idx] = JSON.parse(JSON.stringify(this.gameState));
            else db.push(JSON.parse(JSON.stringify(this.gameState)));
            localStorage.setItem('arena_db', JSON.stringify(db));
        },

        // выход
        logout() {
            location.reload();
        }
    }
}).mount('#app');