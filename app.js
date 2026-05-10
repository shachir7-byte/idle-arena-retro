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
            currentMonster: { name: '', hp: 0, maxHp: 0, imgFile: '', isMiniBoss: false },
            isWaitingNextLevel: false,
            lastReward: 0,
            isShaking: false,
            autoOn: false,
            autoInterval: null,
            ultReady: true,
            ultTimer: 0,
            quotes: ["враг повержен, но впереди новые.", "сила растет.", "осторожно, дальше сложнее.", "золото любит смелых."],
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
        // проверка админа
        isAdmin() {
            const name = this.gameState.user.name.toLowerCase();
            return name === 'admin' || name === 'админ';
        },
        isBossLevel() { return this.gameState.level % 5 === 0; },
        currentQuote() { return this.isWaitingNextLevel ? this.quotes[this.gameState.level % this.quotes.length] : ""; },
        leaderboard() {
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            return db.sort((a, b) => b.level - a.level).slice(0, 5);
        },
        // путь к картинке
        enemyImage() {
            if (!this.currentMonster.imgFile) return null;
            return 'templates/' + this.currentMonster.imgFile;
        }
    },
    methods: {
        // хелпер для классов
        getHeaderClass() {
            return { 'boss-text': this.isBossLevel || this.isMiniBossActive() };
        },
        isMiniBossActive() {
            return this.currentMonster && this.currentMonster.isMiniBoss;
        },

        handleAuth(mode) {
            if (!this.auth.login.trim()) return alert('введи имя');
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            let saved = db.find(u => u.user.name === this.auth.login && u.mode === mode);
            
            if (saved) {
                this.gameState = JSON.parse(JSON.stringify(saved));
                this.syncWeapons();
            } else {
                this.gameState.user.name = this.auth.login;
                this.gameState.mode = mode;
                // сброс для нового
                this.gameState.player = { hp: 100, maxHp: 100, clickDmg: 5, def: 0 };
                this.gameState.level = 1;
                this.gameState.user.gold = 0;
                this.gameState.user.statPoints = 0;
                this.gameState.inventory = [];
                this.legendaries = [];
                this.weaponsStore.forEach(w => w.owned = false);
            }
            
            // бонусы админу
            if (this.isAdmin) {
                this.gameState.player.hp = 100000;
                this.gameState.player.maxHp = 100000;
                this.gameState.player.clickDmg = 358079; // 1/3 от хп босса 25 лвл
                alert('РЕЖИМ АДМИНИСТРАТОРА АКТИВИРОВАН. ПРОГРЕСС НЕ СОХРАНЯЕТСЯ.');
            }

            this.gameState.isAuth = true;
            this.spawnMonster();
            this.startCombatLoop();
        },

        syncWeapons() {
            this.weaponsStore.forEach(w => { if (this.gameState.inventory.includes(w.id)) w.owned = true; });
            this.legendaries = [];
            if (this.gameState.inventory.includes(105)) this.legendaries.push({name: 'Ядро Короля Слизней'});
            if (this.gameState.inventory.includes(110)) this.legendaries.push({name: 'Клык Барона'});
            if (this.gameState.inventory.includes(115)) this.legendaries.push({name: 'Посох Байкал'});
            if (this.gameState.inventory.includes(120)) this.legendaries.push({name: 'Меха-броня'});
            if (this.gameState.inventory.includes(125)) this.legendaries.push({name: 'Клинок Смерти'});
        },

        spawnMonster() {
            this.isWaitingNextLevel = false;
            let lvl = this.gameState.level;
            let m = { name: '', imgFile: '', hp: 0, maxHp: 0, attackDmg: 0, isMiniBoss: false };
            let isBoss = (lvl % 5 === 0);
            
            // логика спавна
            if (lvl <= 4) { m.name = 'Малый слизень'; m.imgFile = 'slime.png'; }
            else if (lvl === 5) { m.name = 'БОСС: Король Слизней'; m.imgFile = 'BOSS_slime.png'; }
            else if (lvl <= 9) { m.name = 'Чумная крыса'; m.imgFile = 'rat.png'; }
            else if (lvl === 10) { m.name = 'БОСС: Крысиный Барон'; m.imgFile = 'BOSS_rat.png'; }
            else if (lvl <= 14) { m.name = 'Гоблин-вор'; m.imgFile = 'goblin.png'; }
            else if (lvl === 15) { m.name = 'БОСС: Гоблин-Шаман'; m.imgFile = 'BOSS_goblin.png'; }
            else if (lvl <= 19) { m.name = 'Дикий Кабан'; m.imgFile = 'kaban.png'; }
            else if (lvl === 20) { m.name = 'БОСС: Меха-Кабан'; m.imgFile = 'BOSS_kaban.png'; }
            else if (lvl <= 24) { m.name = 'Скелет-воин'; m.imgFile = 'skeleton.png'; }
            else if (lvl === 25) { m.name = 'БОСС: Рыцарь Смерти'; m.imgFile = 'BOSS_final.png'; }
            else {
                // после 25 этажа: 20% мини-босс, 80% обычный моб
                if (Math.random() < 0.2) {
                    m.isMiniBoss = true;
                    const bosses = [{n:'Демон', f:'DEMON.png'}, {n:'Дракон', f:'DRAGON.png'}, {n:'Призрак', f:'PRIZRAK.png'}];
                    let rnd = bosses[Math.floor(Math.random() * bosses.length)];
                    m.name = 'МИНИ-БОСС: ' + rnd.n + ' (Ур.' + lvl + ')';
                    m.imgFile = rnd.f;
                } else {
                    // обычный моб из пула 1-25 (без боссов)
                    const mobs = [
                        {n:'Слизень', f:'slime.png'}, {n:'Крыса', f:'rat.png'}, 
                        {n:'Гоблин', f:'goblin.png'}, {n:'Кабан', f:'kaban.png'}, 
                        {n:'Скелет', f:'skeleton.png'}
                    ];
                    let rnd = mobs[Math.floor(Math.random() * mobs.length)];
                    m.name = rnd.n + ' (Ур.' + lvl + ')';
                    m.imgFile = rnd.f;
                }
            }

            // скалирование
            let scale = Math.pow(1.35, lvl - 1);
            let baseHp = isBoss ? 800 : 150;
            if (m.isMiniBoss) baseHp = 400; // мини-босс жирнее обычного, но слабее основного
            
            m.hp = Math.floor(baseHp * scale);
            m.maxHp = m.hp;
            m.attackDmg = Math.floor(8 + (lvl * 3));
            if (m.isMiniBoss) m.attackDmg = Math.floor(m.attackDmg * 1.5);
            
            this.currentMonster = m;
        },

        playerAttack() {
            if (this.isWaitingNextLevel || this.currentMonster.hp <= 0) return;
            this.isShaking = true;
            setTimeout(() => this.isShaking = false, 100);
            
            this.currentMonster.hp -= this.gameState.player.clickDmg;
            if (this.currentMonster.hp <= 0) this.monsterDie();
        },

        // админская фича: ваншот
        instantKill() {
            if (!this.isAdmin || this.isWaitingNextLevel) return;
            this.currentMonster.hp = 0;
            this.monsterDie();
        },

        monsterDie() {
            this.currentMonster.hp = 0;
            this.isWaitingNextLevel = true;
            let baseGold = 10 * this.gameState.level;
            if (this.isBossLevel) baseGold *= 5;
            if (this.currentMonster.isMiniBoss) baseGold *= 3;
            if (this.gameState.mode === 'hardcore') baseGold *= 2;
            
            this.lastReward = baseGold;
            this.gameState.user.gold += baseGold;
            this.gameState.user.statPoints += 3;
            
            this.checkLegendaryDrop();
            // админ не сохраняется
            if (!this.isAdmin) this.save();
        },

        checkLegendaryDrop() {
            let lvl = this.gameState.level;
            if (lvl === 5 && !this.gameState.inventory.includes(105)) {
                this.gameState.inventory.push(105); this.gameState.player.clickDmg += 15;
                alert('ВЫПАЛО: Ядро Короля Слизней!'); this.syncWeapons();
            }
            if (lvl === 10 && !this.gameState.inventory.includes(110)) {
                this.gameState.inventory.push(110); this.gameState.player.clickDmg += 30;
                alert('ВЫПАЛО: Клык Барона!'); this.syncWeapons();
            }
            if (lvl === 15 && !this.gameState.inventory.includes(115)) {
                this.gameState.inventory.push(115); this.gameState.player.clickDmg += 50;
                alert('ВЫПАЛО: Посох Байкал!'); this.syncWeapons();
            }
            if (lvl === 20 && !this.gameState.inventory.includes(120)) {
                this.gameState.inventory.push(120); this.gameState.player.def += 80;
                alert('ВЫПАЛО: Меха-броня!'); this.syncWeapons();
            }
            if (lvl === 25 && !this.gameState.inventory.includes(125)) {
                this.gameState.inventory.push(125); this.gameState.player.clickDmg += 100;
                alert('ВЫПАЛО: Клинок Смерти!'); this.syncWeapons();
            }
        },

        nextLevel() { this.gameState.level++; this.spawnMonster(); },

        upgradeStat(type) {
            if (this.gameState.user.statPoints <= 0 && !this.isAdmin) return;
            // админу поинты не нужны, но если очень хочет - можно дать бесконечно, но пока оставим как есть
            if (this.isAdmin) {
                 // админ качает бесплатно? или просто не тратит. сделаем бесплатно для теста
                 // но лучше пусть тратит, если они есть. а если 0 - то админ может иметь бесконечные?
                 // оставим проверку, админ и так сильный
                 if (this.gameState.user.statPoints <= 0) return; 
            }

            this.gameState.user.statPoints--;
            if (type === 'str') this.gameState.player.clickDmg += 5;
            else if (type === 'vit') { this.gameState.player.maxHp += 25; this.gameState.player.hp = this.gameState.player.maxHp; }
            else if (type === 'def') this.gameState.player.def += 2;
            if (!this.isAdmin) this.save();
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
            if (this.gameState.mode === 'hardcore') {
                alert('GAME OVER! Сброс.');
                localStorage.removeItem('arena_db');
                location.reload();
            } else {
                alert('Вы погибли. Респаун.');
                this.gameState.player.hp = this.gameState.player.maxHp;
                this.spawnMonster();
                if (!this.isAdmin) this.save();
            }
        },

        useUltimate() {
            if (!this.ultReady || this.isWaitingNextLevel) return;
            this.currentMonster.hp -= (this.gameState.player.clickDmg * 15);
            if (this.currentMonster.hp <= 0) this.monsterDie();
            this.ultReady = false; this.ultTimer = 20;
            let t = setInterval(() => {
                this.ultTimer--;
                if (this.ultTimer <= 0) { this.ultReady = true; clearInterval(t); }
            }, 1000);
        },

        toggleAuto() {
            this.autoOn = !this.autoOn;
            if (this.autoOn) {
                this.autoInterval = setInterval(() => { if (!this.isWaitingNextLevel) this.playerAttack(); }, 300);
            } else {
                clearInterval(this.autoInterval);
            }
        },

        save() {
            let db = JSON.parse(localStorage.getItem('arena_db') || '[]');
            let idx = db.findIndex(u => u.user.name === this.gameState.user.name && u.mode === this.gameState.mode);
            if (idx > -1) db[idx] = JSON.parse(JSON.stringify(this.gameState));
            else db.push(JSON.parse(JSON.stringify(this.gameState)));
            localStorage.setItem('arena_db', JSON.stringify(db));
        },

        logout() { location.reload(); }
    }
}).mount('#app');