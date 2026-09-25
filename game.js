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

let score = 0;
let gameOver = false;
let enemies = [];
let bullets = [];
let shootCooldown = 0;
let enemySpawnTimer = 0;

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

function spawnCoin() {
    coin.x = coin.radius + Math.random() * (canvas.width - coin.radius * 2);
    coin.y = coin.radius + Math.random() * (canvas.height - coin.radius * 2);
}

function spawnEnemy() {
    if (enemies.length >= 8) return;

    let x, y;
    do {
        x = 40 + Math.random() * (canvas.width - 80);
        y = 40 + Math.random() * (canvas.height - 80);
    } while (Math.hypot(x - player.x, y - player.y) < 150);

    enemies.push({
        x: x,
        y: y,
        size: 30,
        speed: 60 + Math.random() * 60,
        maxHp: 1,
        hp: 1,
        flash: 0
    });
}

function shoot() {
    if (gameOver || shootCooldown > 0) return;
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
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function resetGame() {
    player.x = 280;
    player.y = 180;
    player.hp = player.maxHp;
    player.invincible = 0;
    player.dirX = 1;
    player.dirY = 0;
    score = 0;
    gameOver = false;
    enemies = [];
    bullets = [];
    shootCooldown = 0;
    enemySpawnTimer = 0;
    spawnCoin();
}

let lastTime = 0;

function update(dt) {
    if (gameOver) return;

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

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    if (player.invincible > 0) {
        player.invincible -= dt;
    }
    if (shootCooldown > 0) {
        shootCooldown -= dt;
    }

    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;

    const cdx = cx - coin.x;
    const cdy = cy - coin.y;
    const coinDist = Math.sqrt(cdx * cdx + cdy * cdy);

    if (coinDist < player.size / 2 + coin.radius) {
        score++;
        playCoinSound();
        spawnCoin();
    }

    enemySpawnTimer -= dt;
    if (enemySpawnTimer <= 0) {
        spawnEnemy();
        enemySpawnTimer = Math.max(0.8, 2.5 - score * 0.05);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.dirX * b.speed * dt;
        b.y += b.dirY * b.speed * dt;

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.size / 2) {
                e.hp--;
                e.flash = 0.1;
                playHitSound();
                if (e.hp <= 0) {
                    score++;
                    playEnemyDeathSound();
                    enemies.splice(j, 1);
                }
                bullets.splice(i, 1);
                hit = true;
                break;
            }
        }
        if (hit) continue;
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

        if (e.flash > 0) {
            e.flash -= dt;
        }

        if (Math.hypot(cx - e.x, cy - e.y) < player.size / 2 + e.size / 2 && player.invincible <= 0) {
            player.hp--;
            player.invincible = 1;
            playHitSound();
            if (player.hp <= 0) {
                player.hp = 0;
                gameOver = true;
                playGameOverSound();
            }
        }
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'gold';
    ctx.fill();

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
    });

    if (player.invincible <= 0 || Math.floor(player.invincible * 8) % 2 === 0) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(player.x, player.y, player.size, player.size);
    }

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Очки: ' + score, 10, 30);

    ctx.font = '18px Arial';
    for (let i = 0; i < player.maxHp; i++) {
        ctx.fillStyle = i < player.hp ? 'red' : '#555';
        ctx.fillText('♥', 10 + i * 22, 55);
    }

    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Игра окончена!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '18px Arial';
        ctx.fillText('Нажми R, чтобы начать заново', canvas.width / 2, canvas.height / 2 + 20);
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

spawnCoin();
requestAnimationFrame(loop);