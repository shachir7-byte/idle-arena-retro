const { createApp } = Vue;

createApp({
    data() {
        return {
            secretClick: 0,
            auth: { login: '', pass: '' },
            lbTab: 'normal',
            isShaking: false,
            showCrit: false,
            isWaitingNextLevel: false,
            adminMode: false,
            autoClickerInterval: null,
            ultReady: true,
            ultTimer: 0,
            
            gameState: {
                isAuth: false,
                mode: 'normal',
                user: { name: '', pass: '', gold: 0, statPoints: 0 },
                player: { hp: 100, maxHp: 100, clickDmg: 5, def: 0 },
                level: 1,
                inventory: []
            },

            currentMonster: { name: '', hp: 0, maxHp: 0, icon: '', attackDmg: 0 },
            
            weaponsStore: [
                { id: 1, name: 'Ржавый нож', dmg: 3, price: 50, owned: false },
                { id: 2, name: 'Дубовая палица', dmg: 8, price: 150, owned: false },
                { id: 3, name: 'Железный меч', dmg: 15, price: 400, owned: false },
                { id: 4, name: 'Стальной топор', dmg: 25, price: 1000, owned: false },
                { id: 5, name: 'Булава Ярости', dmg: 40, price: 2500, owned: false },
                { id: 6, name: 'Копье Рыцаря', dmg: 65, price: 6000, owned: false },
                { id: 7, name: 'Волкобой', dmg: 100, price: 15000, owned: false }
            ],

            legendaries: [],
            quotes: ["Ты выжил... пока что.", "Следующий враг будет хуже.", "Азарт растет!", "Твоя защита крепка, но надолго ли?"]
        }
    },
    computed: {
        isBossLevel() { return this.gameState.level % 5 === 0; },
        getLeaderboard() {
            let db = JSON.parse(localStorage.getItem('game_db') || '[]');
            return db.filter(u => u.mode === this.lbTab).sort((a, b) => b.level - a.level).slice(0, 5);
        },
        getLevelQuote() {
            return this.quotes[this.gameState.level % this.quotes.length];
        }
    },
    methods: {
        handleAuth(mode) {
            if (!this.auth.login) return alert("LOGIN REQUIRED");
            let db = JSON.parse(localStorage.getItem('game_db') || '[]');
            let saved = db.find(u => u.user.name === this.auth.login && u.mode === mode);
            
            if (saved) {
                if (saved.user.pass !== this.auth.pass) return alert("НЕВЕРНЫЙ ПАРОЛЬ (GAME OVER)");
                this.gameState = saved;
                this.syncWeapons();
            } else {
                this.gameState.user.name = this.auth.login;
                this.gameState.user.pass = this.auth.pass;
                this.gameState.mode = mode;
            }
            this.gameState.isAuth = true;
            this.spawnMonster();
            this.startCombatLoop();
        },

        syncWeapons() {
            this.weaponsStore.forEach(w => {
                if (this.gameState.inventory.includes(w.id)) w.owned = true;
            });
            this.legendaries = this.gameState.inventory.filter(id => id > 100).map(id => {
                if (id === 105) return { name: 'Ядро Короля Слизней' };
                if (id === 110) return { name: 'Клык Чумной Крысы' };
                if (id === 115) return { name: 'Амулет Шамана' };
                if (id === 120) return { name: 'Пластина Кабана-киборга' };
                if (id === 125) return { name: 'Клинок Смерти' };
            });
        },

        spawnMonster() {
            this.isWaitingNextLevel = false;
            let lvl = this.gameState.level;
            let m = { name: '', icon: '', hp: 0, dmg: 0 };

            if (lvl <= 4) { m.name = 'Малый слизень'; m.icon = '🦠'; }
            else if (lvl === 5) { m.name = 'БОСС: Король Слизней'; m.icon = '👑🦠'; }
            else if (lvl <= 9) { m.name = 'Чумная крыса'; m.icon = '🐀'; }
            else if (lvl === 10) { m.name = 'БОСС: Крысиный Барон'; m.icon = '👺🐀'; }
            else if (lvl <= 14) { m.name = 'Гоблин-вор'; m.icon = '👺'; }
            else if (lvl === 15) { m.name = 'БОСС: Гоблин-Шаман'; m.icon = '🔮👺'; }
            else if (lvl <= 19) { m.name = 'Дикий Кабан'; m.icon = '🐗'; }
            else if (lvl === 20) { m.name = 'БОСС: Кабан-киборг'; m.icon = '🤖🐗'; }
            else if (lvl <= 24) { m.name = 'Скелет-воин'; m.icon = '💀'; }
            else if (lvl === 25) { m.name = 'БОСС: Рыцарь Смерти'; m.icon = '🐎💀'; }
            else {
                const pool = [{n:'Демон Ада', i:'👿'}, {n:'Дракон Бездны', i:'🐉'}, {n:'Древний Дух', i:'👻'}];
                let rnd = pool[lvl % pool.length];
                m.name = rnd.n; m.icon = rnd.i;
            }

            let scale = Math.pow(1.33, lvl - 1);
            let baseHp = (lvl % 5 === 0) ? 500 : 100;
            m.hp = Math.floor(hpBase * scale);
            m.maxHp = m.hp;
            m.attackDmg = 5 + (lvl * 3);
            this.currentMonster = m;
        },

        playerAttack() {
            if (this.isWaitingNextLevel || this.currentMonster.hp <= 0) return;
            this.isShaking = true;
            setTimeout(() => this.isShaking = false, 50);
            this.currentMonster.hp -= this.gameState.player.clickDmg;
            this.checkDeath();
        },

        checkDeath() {
            if (this.currentMonster.hp <= 0) {
                this.currentMonster.hp = 0;
                this.isWaitingNextLevel = true;
                let reward = 10 * this.gameState.level * (this.gameState.level % 5 === 0 ? 5 : 1);
                this.gameState.user.gold += (this.gameState.mode === 'hardcore' ? reward * 2 : reward);
                this.gameState.user.statPoints += 3;
                this.dropLegendary();
                this.save();
            }
            if (this.gameState.player.hp <= 0) {
                this.gameState.player.hp = 0;
                this.handlePlayerDeath();
            }
        },

        handlePlayerDeath() {
            if (this.gameState.mode === 'hardcore') {
                alert("GAME OVER! Хардкор беспощаден.");
                this.gameState.level = 1;
                this.gameState.user.statPoints = 0;
                this.gameState.gameState.user.gold = 0;
                this.gameState.player.clickDmg = 5;
                this.gameState.inventory = [];
                location.reload(); 
            } else {
                alert("Game Over! Начинай этаж сначала.");
                this.gameState.player.hp = this.gameState.player.maxHp;
                this.spawnMonster();
            }
        },

        dropLegendary() {
            let lvl = this.gameState.level;
            if ([5, 10, 15, 20, 25].includes(lvl) && !this.gameState.inventory.includes(lvl + 100)) {
                this.gameState.inventory.push(lvl + 100);
                this.gameState.player.clickDmg += (lvl * 3); // Существенный прирост урона
                alert("INSERTED COIN -> ВЫПАЛ ТРОФЕЙ!");
                this.syncWeapons();
            }
        },

        nextLevel() { this.gameState.level++; this.spawnMonster(); this.save(); },

        upgradeStat(type) {
            if (this.gameState.user.statPoints <= 0) return;
            this.gameState.user.statPoints--;
            if (type === 'str') this.gameState.player.clickDmg += 5;
            if (type === 'def') this.gameState.player.def += 2;
            if (type === 'vit') { this.gameState.player.maxHp += 25; this.gameState.player.hp = this.gameState.player.maxHp; }
            this.save();
        },

        buyWeapon(wpn) {
            if (this.gameState.user.gold >= wpn.price) {
                this.gameState.user.gold -= wpn.price;
                this.gameState.player.clickDmg += wpn.dmg;
                wpn.owned = true;
                this.gameState.inventory.push(wpn.id);
                this.save();
            }
        },

        startCombatLoop() {
            setInterval(() => {
                if (this.gameState.isAuth && !this.isWaitingNextLevel && this.gameState.player.hp > 0) {
                    let d = Math.max(1, this.currentMonster.attackDmg - this.gameState.player.def);
                    this.gameState.player.hp -= d;
                    this.checkDeath();
                }
            }, 2000);
        },

        useUltimate() {
            if (!this.ultReady) return;
            this.currentMonster.hp -= this.gameState.player.clickDmg * 15;
            this.ultReady = false; this.ultTimer = 20;
            let t = setInterval(() => { this.ultTimer--; if(this.ultTimer <= 0){ this.ultReady = true; clearInterval(t); }}, 1000);
            this.checkDeath();
        },

        toggleAdmin() {
            this.adminMode = !this.adminMode;
            if (this.adminMode) this.autoClickerInterval = setInterval(() => this.playerAttack(), 150);
            else clearInterval(this.autoClickerInterval);
        },

        save() {
            let db = JSON.parse(localStorage.getItem('game_db') || '[]');
            let i = db.findIndex(u => u.user.name === this.gameState.user.name && u.mode === this.gameState.mode);
            if (i > -1) db[i] = JSON.parse(JSON.stringify(this.gameState));
            else db.push(JSON.parse(JSON.stringify(this.gameState)));
            localStorage.setItem('game_db', JSON.stringify(db));
        },

        logout() { location.reload(); }
    }
}).mount('#app');