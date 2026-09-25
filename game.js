const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
    x: 280,
    y: 180,
    size: 40,
    speed: 250,
    maxHp: 3,
    hp: 3,
    dirX: 1,
    dirY: 0,
    invincible: 0
};

const coin = {
    x: 0,
    y: 0,
    radius: 10
};

const levels = [
    { name: 'Лес', theme: 'forest', coinsNeeded: 6, enemySpeedMin: 60, enemySpeedMax: 90, enemyHp: 1, spawnInterval: 2.2, obstacles: 6 },
    { name: 'Пустыня', theme: 'desert', coinsNeeded: 8, enemySpeedMin: 75, enemySpeedMax: 105, enemyHp: 1, spawnInterval: 1.9, obstacles: 6 },
    { name: 'Снега', theme: 'snow', coinsNeeded: 10, enemySpeedMin: 55, enemySpeedMax: 80, enemyHp: 2, spawnInterval: 1.7, obstacles: 5 },
    { name: 'Вулкан', theme: 'volcano', coinsNeeded: 12, enemySpeedMin: 90, enemySpeedMax: 120, enemyHp: 2, spawnInterval: 1.4, obstacles: 5 },
    { name: 'Космос', theme: 'space', coinsNeeded: 0, boss: true, obstacles: 6 }
];

let score = 0;
let levelIndex = 0;
let coinsCollected = 0;
let phase = 'transition';
let transitionTimer = 0;
let enemySpawnTimer = 0;

let enemies = [];
let bullets = [];
let particles = [];
let obstacles = [];
let boss = null;
let stars = [];

let shootCooldown = 0;

let audioCtx = null;

function playTone(freqStart, freqEnd, duration, type = 'sine', volume = 0.3) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

function playCoinSound() {
    playTone(880, 1320, 0.15);
}

function playShootSound() {
    playTone(600, 300, 0.12, 'square', 0.15);
}

function playHitSound() {
    playTone(300, 150, 0.15, 'sawtooth', 0.2);
}

function playEnemyDeathSound() {
    playTone(500, 200, 0.25, 'triangle', 0.25);
}

function playGameOverSound() {
    playTone(400, 60, 0.8, 'sawtooth', 0.3);
}

function playLevelUpSound() {
    playTone(523, 523, 0.12, 'square', 0.2);
    setTimeout(() => playTone(659, 659, 0.12, 'square', 0.2), 120);
    setTimeout(() => playTone(784, 1046, 0.25, 'square', 0.2), 240);
}

function playBossDeathSound() {
    playTone(600, 120, 1.2, 'sawtooth', 0.3);
}

function getLevel() {
    return levels[levelIndex];
}

function getLevelColor() {
    const colors = {
        forest: '#4ade80',
        desert: '#fbbf24',
        snow: '#93c5fd',
        volcano: '#f87171',
        space: '#a78bfa'
    };
    return colors[getLevel().theme] || '#ffffff';
}

function clearWorld() {
    enemies = [];
    bullets = [];
    particles = [];
    obstacles = [];
    boss = null;
    coin.x = -100;
    coin.y = -100;
}

function buildStars() {
    stars = [];
    for (let i = 0; i < 60; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.8 + 0.4,
            twinkle: Math.random() * Math.PI * 2
        });
    }
}

function placeObstacles() {
    const level = getLevel();
    const count = level.boss ? 6 : level.obstacles;
    for (let i = 0; i < count; i++) {
        let x, y, radius;
        for (let attempt = 0; attempt < 50; attempt++) {
            radius = 20 + Math.random() * 18;
            x = radius + 30 + Math.random() * (canvas.width - (radius + 30) * 2);
            y = radius + 30 + Math.random() * (canvas.height - (radius + 30) * 2);
            const nearPlayer = Math.hypot(x - player.x, y - player.y) < 120;
            let overlapping = false;
            for (const o of obstacles) {
                if (Math.hypot(x - o.x, y - o.y) < radius + o.radius + 20) {
                    overlapping = true;
                    break;
                }
            }
            if (!nearPlayer && !overlapping) break;
        }
        obstacles.push({ x, y, radius });
    }
}

function spawnCoin() {
    for (let attempt = 0; attempt < 60; attempt++) {
        coin.x = coin.radius + Math.random() * (canvas.width - coin.radius * 2);
        coin.y = coin.radius + Math.random() * (canvas.height - coin.radius * 2);
        let blocked = false;
        for (const o of obstacles) {
            if (Math.hypot(coin.x - o.x, coin.y - o.y) < coin.radius + o.radius + 5) {
                blocked = true;
                break;
            }
        }
        if (!blocked) return;
    }
    coin.x = 40;
    coin.y = 40;
}

function spawnEnemy() {
    const level = getLevel();
    if (level.boss || phase !== 'playing') return;
    if (enemies.length >= 8) return;

    let x, y;
    for (let attempt = 0; attempt < 60; attempt++) {
        x = 40 + Math.random() * (canvas.width - 80);
        y = 40 + Math.random() * (canvas.height - 80);
        if (Math.hypot(x - player.x, y - player.y) >= 150) break;
    }

    enemies.push({
        x: x,
        y: y,
        size: 30,
        speed: level.enemySpeedMin + Math.random() * (level.enemySpeedMax - level.enemySpeedMin),
        maxHp: level.enemyHp,
        hp: level.enemyHp,
        flash: 0
    });
}

function spawnBoss() {
    boss = {
        x: canvas.width - 90,
        y: 80 + Math.random() * (canvas.height - 160),
        size: 80,
        maxHp: 15,
        hp: 15,
        speed: 85,
        flash: 0
    };
    playBossDeathSound();
}

function startLevel(index) {
    levelIndex = index;
    const level = getLevel();
    coinsCollected = 0;
    player.hp = player.maxHp;
    player.invincible = 0;
    player.x = 280;
    player.y = 180;

    clearWorld();
    placeObstacles();
    if (level.theme === 'space') {
        buildStars();
    }

    if (level.boss) {
        coin.x = -100;
        coin.y = -100;
        spawnBoss();
    } else {
        spawnCoin();
    }

    phase = 'transition';
    transitionTimer = 2.0;
}

function resetGame() {
    score = 0;
    shootCooldown = 0;
    startLevel(0);
}

function finishLevel() {
    if (levelIndex >= levels.length - 1) {
        phase = 'victory';
        playBossDeathSound();
        return;
    }
    playLevelUpSound();
    startLevel(levelIndex + 1);
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 130;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.5,
            maxLife: 0.5,
            color: color
        });
    }
}

function shoot() {
    if (phase !== 'playing' || shootCooldown > 0) return;
    shootCooldown = 0.25;

    bullets.push({
        x: player.x + player.size / 2,
        y: player.y + player.size / 2,
        dirX: player.dirX,
        dirY: player.dirY,
        speed: 400,
        radius: 5
    });
    playShootSound();
}

function resolveCircle(obj, radius) {
    for (const o of obstacles) {
        const dx = obj.x - o.x;
        const dy = obj.y - o.y;
        const dist = Math.hypot(dx, dy);
        const minDist = radius + o.radius;
        if (dist < minDist) {
            if (dist === 0) {
                obj.x = o.x + minDist;
                continue;
            }
            const overlap = minDist - dist;
            obj.x += (dx / dist) * overlap;
            obj.y += (dy / dist) * overlap;
        }
    }
    obj.x = Math.max(radius, Math.min(canvas.width - radius, obj.x));
    obj.y = Math.max(radius, Math.min(canvas.height - radius, obj.y));
}

const keys = {};

window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
    keys[e.key] = true;

    if (e.key === ' ') {
        shoot();
    }
    if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        resetGame();
    }
    if (e.key === 'Enter' && phase === 'transition') {
        transitionTimer = 0;
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

let lastTime = 0;

function update(dt) {
    if (phase === 'transition') {
        transitionTimer -= dt;
        if (transitionTimer <= 0) {
            phase = 'playing';
        }
        return;
    }

    if (phase === 'gameover' || phase === 'victory') {
        updateParticles(dt);
        return;
    }

    let dx = 0;
    let dy = 0;

    if (keys['ArrowUp']) dy -= 1;
    if (keys['ArrowDown']) dy += 1;
    if (keys['ArrowLeft']) dx -= 1;
    if (keys['ArrowRight']) dx += 1;

    if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
    }

    if (dx !== 0 || dy !== 0) {
        player.dirX = dx;
        player.dirY = dy;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    resolveCircle(player, player.size / 2);

    if (player.invincible > 0) {
        player.invincible -= dt;
    }
    if (shootCooldown > 0) {
        shootCooldown -= dt;
    }

    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;

    const level = getLevel();

    if (!level.boss) {
        if (Math.hypot(cx - coin.x, cy - coin.y) < player.size / 2 + coin.radius) {
            score++;
            coinsCollected++;
            playCoinSound();
            spawnParticles(coin.x, coin.y, 'gold', 10);
            spawnCoin();

            if (coinsCollected >= level.coinsNeeded) {
                finishLevel();
                return;
            }
        }

        enemySpawnTimer -= dt;
        if (enemySpawnTimer <= 0) {
            spawnEnemy();
            enemySpawnTimer = Math.max(0.4, level.spawnInterval - coinsCollected * 0.04);
        }
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.dirX * b.speed * dt;
        b.y += b.dirY * b.speed * dt;

        let removed = false;

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }

        for (const o of obstacles) {
            if (Math.hypot(b.x - o.x, b.y - o.y) < b.radius + o.radius) {
                spawnParticles(b.x, b.y, '#888', 4);
                bullets.splice(i, 1);
                removed = true;
                break;
            }
        }
        if (removed) continue;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.size / 2) {
                e.hp--;
                e.flash = 0.1;
                playHitSound();
                if (e.hp <= 0) {
                    score++;
                    spawnParticles(e.x, e.y, 'red', 10);
                    playEnemyDeathSound();
                    enemies.splice(j, 1);
                }
                bullets.splice(i, 1);
                removed = true;
                break;
            }
        }
        if (removed) continue;

        if (boss && Math.hypot(b.x - boss.x, b.y - boss.y) < b.radius + boss.size / 2) {
            boss.hp--;
            boss.flash = 0.1;
            spawnParticles(b.x, b.y, getLevelColor(), 6);
            playHitSound();
            bullets.splice(i, 1);
            if (boss.hp <= 0) {
                score += 20;
                spawnParticles(boss.x, boss.y, getLevelColor(), 30);
                playBossDeathSound();
                boss = null;
                finishLevel();
                return;
            }
        }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const edx = cx - e.x;
        const edy = cy - e.y;
        const dist = Math.hypot(edx, edy);

        if (dist > 0) {
            e.x += (edx / dist) * e.speed * dt;
            e.y += (edy / dist) * e.speed * dt;
        }
        resolveCircle(e, e.size / 2);

        if (e.flash > 0) {
            e.flash -= dt;
        }

        if (Math.hypot(cx - e.x, cy - e.y) < player.size / 2 + e.size / 2 && player.invincible <= 0) {
            player.hp--;
            player.invincible = 1;
            playHitSound();
            if (player.hp <= 0) {
                player.hp = 0;
                phase = 'gameover';
                playGameOverSound();
                return;
            }
        }
    }

    for (let i = 0; i < enemies.length; i++) {
        for (let j = i + 1; j < enemies.length; j++) {
            const a = enemies[i];
            const b = enemies[j];
            const sdx = b.x - a.x;
            const sdy = b.y - a.y;
            const sd = Math.hypot(sdx, sdy);
            const min = a.size / 2 + b.size / 2;
            if (sd < min && sd > 0) {
                const push = (min - sd) / 2;
                a.x -= (sdx / sd) * push;
                a.y -= (sdy / sd) * push;
                b.x += (sdx / sd) * push;
                b.y += (sdy / sd) * push;
            }
        }
    }

    if (boss) {
        const bdx = cx - boss.x;
        const bdy = cy - boss.y;
        const bdist = Math.hypot(bdx, bdy);
        if (bdist > 0) {
            boss.x += (bdx / bdist) * boss.speed * dt;
            boss.y += (bdy / bdist) * boss.speed * dt;
        }
        resolveCircle(boss, boss.size / 2);
        if (boss.flash > 0) {
            boss.flash -= dt;
        }
        if (Math.hypot(cx - boss.x, cy - boss.y) < player.size / 2 + boss.size / 2 && player.invincible <= 0) {
            player.hp--;
            player.invincible = 1;
            playHitSound();
            if (player.hp <= 0) {
                player.hp = 0;
                phase = 'gameover';
                playGameOverSound();
                return;
            }
        }
    }

    updateParticles(dt);
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawBackground() {
    const level = getLevel();
    const theme = level.theme;

    let gradient;
    switch (theme) {
        case 'forest':
            gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#14532d');
            gradient.addColorStop(1, '#0a2a14');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'desert':
            gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#fde68a');
            gradient.addColorStop(1, '#d97706');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(canvas.width - 80, 70, 35, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'snow':
            gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#cfe8ff');
            gradient.addColorStop(1, '#e8f4ff');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'volcano':
            gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#450a0a');
            gradient.addColorStop(1, '#1c0505');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            break;
        case 'space':
            gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#0b1026');
            gradient.addColorStop(1, '#1a0b2e');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            stars.forEach((s) => {
                const alpha = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 600 + s.twinkle));
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            break;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function drawObstacle(o) {
    const theme = getLevel().theme;
    const x = o.x;
    const y = o.y;
    const r = o.radius;

    switch (theme) {
        case 'forest':
            ctx.fillStyle = '#5b3a1e';
            ctx.fillRect(x - 5, y - 5, 10, 16);
            ctx.fillStyle = '#16a34a';
            ctx.beginPath();
            ctx.arc(x, y - 12, r * 0.85, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.arc(x - 10, y + 4, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + 10, y + 4, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'desert':
            ctx.fillStyle = '#92400e';
            ctx.fillRect(x - 4, y + 6, 8, 16);
            ctx.fillStyle = '#65a30d';
            ctx.beginPath();
            ctx.ellipse(x, y, r * 0.7, r * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x - r * 0.6, y - r * 0.2, r * 0.45, r * 0.3, -0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x + r * 0.6, y - r * 0.1, r * 0.4, r * 0.28, 0.6, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'snow':
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(x, y + r * 0.6, r * 0.7, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y - r * 0.2, r * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y - r * 0.8, r * 0.33, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.arc(x - r * 0.12, y - r * 0.85, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + r * 0.12, y - r * 0.85, 2.5, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'volcano':
            ctx.fillStyle = '#292524';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f97316';
            ctx.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 400 + x));
            ctx.beginPath();
            ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
        case 'space':
            ctx.fillStyle = '#4b5563';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#6b7280';
            ctx.beginPath();
            ctx.ellipse(x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.25, 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;
    }
}

function render() {
    drawBackground();

    obstacles.forEach(drawObstacle);

    if (getLevel().theme === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 25; i++) {
            const sx = (i * 97) % canvas.width;
            const sy = (i * 53) % canvas.height;
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (getLevel().theme === 'volcano') {
        ctx.fillStyle = 'rgba(255,140,0,0.12)';
        for (let i = 0; i < 8; i++) {
            const gy = 40 + i * 48;
            ctx.beginPath();
            ctx.arc(Math.sin(i * 2.4 + performance.now() / 900) * 120 + canvas.width / 2, gy, 8 + (i % 3) * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (!getLevel().boss) {
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'gold';
        ctx.fill();
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow';
        ctx.fill();
    });

    enemies.forEach((e) => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = e.flash > 0 ? 'orange' : 'red';
        ctx.fill();
        ctx.strokeStyle = '#7a0000';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👾', e.x, e.y + 5);

        if (e.maxHp > 1) {
            ctx.fillStyle = '#333';
            ctx.fillRect(e.x - 12, e.y - e.size / 2 - 8, 24, 5);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(e.x - 12, e.y - e.size / 2 - 8, 24 * (e.hp / e.maxHp), 5);
        }
    });

    if (boss) {
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, boss.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = boss.flash > 0 ? '#fff7ed' : '#7c2d12';
        ctx.fill();
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('💀', boss.x, boss.y + 10);

        ctx.fillStyle = '#111';
        ctx.fillRect(boss.x - 50, boss.y - boss.size / 2 - 20, 100, 10);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(boss.x - 50, boss.y - boss.size / 2 - 20, 100 * (boss.hp / boss.maxHp), 10);
    }

    if (player.invincible <= 0 || Math.floor(player.invincible * 8) % 2 === 0) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(player.x, player.y, player.size, player.size);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(player.x, player.y, player.size, player.size);
    }

    particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    drawHud();
    drawOverlay();
}

function drawHud() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Очки: ' + score, 10, 30);

    ctx.font = '18px Arial';
    for (let i = 0; i < player.maxHp; i++) {
        ctx.fillStyle = i < player.hp ? 'red' : 'rgba(255,255,255,0.3)';
        ctx.fillText('♥', 10 + i * 22, 55);
    }

    const level = getLevel();

    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = getLevelColor();
    ctx.fillText('Уровень ' + (levelIndex + 1) + ': ' + level.name, canvas.width / 2, 25);

    if (!level.boss) {
        const barW = 140;
        const progress = Math.min(1, coinsCollected / level.coinsNeeded);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(canvas.width / 2 - barW / 2, 34, barW, 8);
        ctx.fillStyle = 'gold';
        ctx.fillRect(canvas.width / 2 - barW / 2, 34, barW * progress, 8);
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('Монеты: ' + coinsCollected + ' / ' + level.coinsNeeded, canvas.width / 2, 52);
    } else if (boss) {
        ctx.font = '14px Arial';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText('Уничтожьте босса!', canvas.width / 2, 52);
    }

    ctx.textAlign = 'left';
}

function drawOverlay() {
    if (phase === 'transition') {
        const level = getLevel();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.font = '34px Arial';
        ctx.fillStyle = getLevelColor();
        ctx.fillText('Уровень ' + (levelIndex + 1) + ': ' + level.name, canvas.width / 2, canvas.height / 2 - 24);

        ctx.font = '18px Arial';
        ctx.fillStyle = 'white';
        if (level.boss) {
            ctx.fillText('Финальный босс — уничтожьте его!', canvas.width / 2, canvas.height / 2 + 16);
        } else {
            ctx.fillText('Соберите монеты: ' + level.coinsNeeded + ', не дайте врагам вас убить!', canvas.width / 2, canvas.height / 2 + 16);
        }
        ctx.fillText('Нажмите Enter, чтобы начать', canvas.width / 2, canvas.height / 2 + 46);
        ctx.textAlign = 'left';
    }

    if (phase === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.font = '32px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('Игра окончена!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '18px Arial';
        ctx.fillText('Счёт: ' + score, canvas.width / 2, canvas.height / 2 + 16);
        ctx.fillText('Нажми R, чтобы начать заново', canvas.width / 2, canvas.height / 2 + 46);
        ctx.textAlign = 'left';
    }

    if (phase === 'victory') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = 'center';
        ctx.font = '36px Arial';
        ctx.fillStyle = 'gold';
        ctx.fillText('🏆 Победа!', canvas.width / 2, canvas.height / 2 - 30);
        ctx.font = '22px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('Вы прошли все уровни!', canvas.width / 2, canvas.height / 2 + 6);
        ctx.fillText('Итоговый счёт: ' + score, canvas.width / 2, canvas.height / 2 + 38);
        ctx.font = '16px Arial';
        ctx.fillText('Нажми R, чтобы сыграть ещё раз', canvas.width / 2, canvas.height / 2 + 72);
        ctx.textAlign = 'left';
    }
}

function loop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(loop);
}

startLevel(0);
requestAnimationFrame(loop);