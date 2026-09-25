const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const player = {
    x: 280,
    y: 180,
    size: 40,
    speed: 250
};

const coin = {
    x: 0,
    y: 0,
    radius: 10
};

let score = 0;

let audioCtx = null;

function playCoinSound() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
}

function spawnCoin() {
    coin.x = coin.radius + Math.random() * (canvas.width - coin.radius * 2);
    coin.y = coin.radius + Math.random() * (canvas.height - coin.radius * 2);
}

const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

let lastTime = 0;

function update(dt) {
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

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;

    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));

    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;
    const cdx = cx - coin.x;
    const cdy = cy - coin.y;
    const dist = Math.sqrt(cdx * cdx + cdy * cdy);

    if (dist < player.size / 2 + coin.radius) {
        score++;
        if (score >= 30) {
            score = 0;
        }
        playCoinSound();
        spawnCoin();
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();

    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.size, player.size);

    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Очки: ' + score, 10, 30);
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