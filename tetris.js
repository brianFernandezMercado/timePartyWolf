/* =========================================
   WOLF PARTY TETRIS
   Self-contained arcade module
========================================= */
(() => {
  const canvas = document.getElementById('tetrisCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('tetrisNext');
  const holdCanvas = document.getElementById('tetrisHold');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCtx = holdCanvas.getContext('2d');
  const shell = document.getElementById('tetrisShell');
  const overlay = document.getElementById('tetrisOverlay');
  const toast = document.getElementById('tetrisToast');

  const COLS = 10, ROWS = 20, CELL = 30;
  const COLORS = {
    I:'#6be7ff', O:'#ffd76b', T:'#b18cff', S:'#8dffb0',
    Z:'#ff77b7', J:'#6597ff', L:'#ffad70',
    P:'#ff5d5d', U:'#ff9e42', W:'#72f0d0', BIG:'#f0f06a', CROSS:'#ff71e8'
  };
  const SHAPES = {
    I:[[1,1,1,1]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1]],
    S:[[0,1,1],[1,1,0]],
    Z:[[1,1,0],[0,1,1]],
    J:[[1,0,0],[1,1,1]],
    L:[[0,0,1],[1,1,1]],
    P:[[1,1],[1,0],[1,1]],
    U:[[1,0,1],[1,1,1]],
    W:[[1,0,0],[1,1,0],[0,1,1]],
    BIG:[[1,1,1],[1,1,1],[1,1,1]],
    CROSS:[[0,1,0],[1,1,1],[0,1,0]]
  };
  let board, current, next, held, canHold, score, lines, level, combo, dropTimer, dropInterval, lastTime, running, paused, gameOver, shake, particles, clearFlash, toastTimer, audioCtx, earthquakeTimer, glitchTimer, screenPulse;
  let best = Number(localStorage.getItem('wolfPartyTetrisBest') || 0);
  document.getElementById('tetrisBest').textContent = format(best);

  function format(n){ return String(n).padStart(6,'0'); }
  function cloneMatrix(m){ return m.map(row => row.slice()); }
  function randomPiece(){
    const classic = ['I','O','T','S','Z','J','L'];
    const specials = ['P','U','W','BIG','CROSS'];
    const chaosChance = Math.min(0.12 + Math.max(0,level-1)*0.035, 0.42);
    const type = Math.random() < chaosChance ? specials[Math.floor(Math.random()*specials.length)] : classic[Math.floor(Math.random()*classic.length)];
    const matrix = cloneMatrix(SHAPES[type]);
    return {type, matrix, x:Math.floor(COLS/2)-Math.ceil(matrix[0].length/2), y:0};
  }
  function init(){
    board = Array.from({length:ROWS},()=>Array(COLS).fill(null));
    current = randomPiece(); next = randomPiece(); held = null; canHold = true;
    score = 0; lines = 0; level = 1; combo = -1;
    dropTimer = 0; dropInterval = 850; lastTime = 0; running = false; paused = false; gameOver = false;
    shake = 0; particles = []; clearFlash = 0; earthquakeTimer = 0; glitchTimer = 0; screenPulse = 0;
    updateHud(); draw(); drawPreview(nextCtx,next); drawPreview(holdCtx,held);
  }
  function start(){
    if(gameOver) init();
    running = true; paused = false;
    overlay.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
  function restart(){
    init(); start();
  }
  function loop(time){
    if(!running || paused || gameOver) return;
    const dt = Math.min(40,time-lastTime || 16.67); lastTime=time;
    dropTimer += dt;
    if(level>=3 && Math.random()<0.0015*dt){earthquakeTimer=180+Math.random()*260;shake=5+Math.random()*10;showToast('🌋 EARTHQUAKE!');sound(65,0.12,'sawtooth');}
    if(dropTimer >= dropInterval){
      dropTimer = 0;
      if(!move(0,1)) lockPiece();
    }
    updateEffects(dt);
    draw();
    requestAnimationFrame(loop);
  }
  function collision(piece,dx=0,dy=0,matrix=piece.matrix){
    for(let y=0;y<matrix.length;y++) for(let x=0;x<matrix[y].length;x++){
      if(!matrix[y][x]) continue;
      const bx=piece.x+x+dx, by=piece.y+y+dy;
      if(bx<0||bx>=COLS||by>=ROWS) return true;
      if(by>=0 && board[by][bx]) return true;
    }
    return false;
  }
  function move(dx,dy){
    if(collision(current,dx,dy)) return false;
    current.x+=dx; current.y+=dy;
    return true;
  }
  function rotate(matrix,dir=1){
    const h=matrix.length,w=matrix[0].length;
    const out=Array.from({length:w},()=>Array(h).fill(0));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(dir>0) out[x][h-1-y]=matrix[y][x];
      else out[w-1-x][y]=matrix[y][x];
    }
    return out;
  }
  function rotatePiece(dir=1){
    if(!running||paused||gameOver)return;
    const rotated=rotate(current.matrix,dir);
    // Lightweight wall-kick attempts
    for(const kick of [0,-1,1,-2,2]){
      if(!collision(current,kick,0,rotated)){
        current.matrix=rotated; current.x+=kick; sound(540,0.025,'square'); draw(); return;
      }
    }
  }
  function hardDrop(){
    if(!running||paused||gameOver)return;
    let distance=0;
    while(move(0,1))distance++;
    score+=distance*2;
    sound(150,0.06,'triangle');
    lockPiece();
  }
  function holdPiece(){
    if(!running||paused||gameOver||!canHold)return;
    const old=current.type;
    if(held){
      current={type:held,matrix:cloneMatrix(SHAPES[held]),x:Math.floor(COLS/2)-Math.ceil(SHAPES[held][0].length/2),y:0};
      held=old;
    }else{
      held=old; current=next; next=randomPiece();
    }
    canHold=false;
    drawPreview(nextCtx,next);drawPreview(holdCtx,held);
    if(collision(current)) endGame();
    sound(360,0.04,'square');draw();
  }
  function lockPiece(){
    if(['BIG','CROSS','P','U','W'].includes(current.type)){shake=Math.max(shake,8+level);screenPulse=0.18;showToast(current.type==='BIG'?'⚠ MEGA BLOCK!':current.type==='CROSS'?'✖ CROSS CHAOS!':'⚡ CHAOS PIECE!');sound(90+level*8,0.13,'sawtooth');}
    current.matrix.forEach((row,y)=>row.forEach((v,x)=>{
      if(v){
        const by=current.y+y,bx=current.x+x;
        if(by>=0)board[by][bx]=current.type;
      }
    }));
    const cleared=[];
    for(let y=ROWS-1;y>=0;y--){
      if(board[y].every(Boolean)){cleared.push(y);board.splice(y,1);board.unshift(Array(COLS).fill(null));y++;}
    }
    if(cleared.length){
      combo++;
      const base=[0,100,300,500,800][cleared.length]||1200;
      score+=base*level+(combo>0?combo*50*level:0);
      lines+=cleared.length;
      const newLevel=Math.floor(lines/10)+1;
      if(newLevel>level){level=newLevel;showToast('LEVEL UP!');sound(780,0.12,'sawtooth');}
      dropInterval=Math.max(65,780-(level-1)*78);
      triggerClear(cleared.length);
    }else combo=-1;
    canHold=true;
    current=next;next=randomPiece();
    drawPreview(nextCtx,next);
    if(collision(current))endGame();
    updateHud();draw();
  }
  function triggerClear(count){
    shake=count===1?7:count===2?24:count===3?30:38; earthquakeTimer=count>=2?520:220; screenPulse=count>=3?0.34:0.2; glitchTimer=count>=3?260:120;
    clearFlash=0.28;
    shell.classList.remove('shake'); void shell.offsetWidth; shell.classList.add('shake');
    showToast(count===2?'DOUBLE! • RUMBLE':count===3?'TRIPLE!':'TETRIS!');
    const color=['#6be7ff','#b18cff','#ff77b7','#ffd76b','#8dffb0'];
    for(let i=0;i<95*count;i++){
      particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-.5)*15,vy:-Math.random()*12-2,life:550+Math.random()*700,size:3+Math.random()*8,color:color[Math.floor(Math.random()*color.length)]});
    }
    sound(count===2?190:count>=3?260:440,0.2,'sawtooth');
    if(count===2){
      // Two-line clear gets a stronger, layered rumble and shockwave.
      setTimeout(()=>sound(110,0.22,'triangle'),65);
      setTimeout(()=>sound(75,0.18,'sawtooth'),145);
    }
  }
  function updateEffects(dt){
    shake=Math.max(0,shake-dt*0.055);clearFlash=Math.max(0,clearFlash-dt/1000);
    earthquakeTimer=Math.max(0,earthquakeTimer-dt);glitchTimer=Math.max(0,glitchTimer-dt);screenPulse=Math.max(0,screenPulse-dt/850);
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.18;p.life-=dt;p.vx*=0.99;});
    if(earthquakeTimer>0){shell.style.setProperty('--quake-x',`${(Math.random()-.5)*Math.min(shake,28)}px`);shell.style.setProperty('--quake-y',`${(Math.random()-.5)*Math.min(shake,28)}px`);shell.classList.add('earthquake');}
    else{shell.classList.remove('earthquake');shell.style.setProperty('--quake-x','0px');shell.style.setProperty('--quake-y','0px');}
    if(glitchTimer>0)shell.classList.add('glitch');else shell.classList.remove('glitch');
  }
  function endGame(){
    running=false;gameOver=true;
    if(score>best){best=score;localStorage.setItem('wolfPartyTetrisBest',best);document.getElementById('tetrisBest').textContent=format(best);}
    overlay.classList.remove('hidden');
    overlay.querySelector('.tetris-modal').innerHTML=`<div class="icon">💥</div><h3>GAME OVER</h3><p>Score <b>${format(score)}</b><br>Lines ${lines} • Level ${level}<br>${score>=best?'¡Nuevo récord!':'La fiesta continúa, intenta otra vez.'}<br><span id="tetrisCloudStatus">Guardando puntaje...</span></p><button id="tetrisStart">PLAY AGAIN</button>`;
    document.getElementById('tetrisStart').onclick=restart;
    if(window.WolfFirebaseScore){window.WolfFirebaseScore.saveScore({score,lines,level}).then(result=>{const el=document.getElementById('tetrisCloudStatus');if(el)el.textContent=result.ok?'☁ Puntaje sincronizado con el ranking':'⚠ '+(result.message||'No se pudo sincronizar');});}
    else {const el=document.getElementById('tetrisCloudStatus');if(el)el.textContent='Ranking offline';}
    sound(120,0.25,'sawtooth');
  }
  function showToast(text){
    toast.textContent=text;toast.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),950);
  }
  function updateHud(){
    document.getElementById('tetrisScore').textContent=format(score);
    document.getElementById('tetrisLines').textContent=String(lines).padStart(2,'0');
    document.getElementById('tetrisLevel').textContent=String(level).padStart(2,'0');
    document.getElementById('tetrisProgress').style.width=((lines%10)/10*100)+'%';
    if(score>best){best=score;localStorage.setItem('wolfPartyTetrisBest',best);document.getElementById('tetrisBest').textContent=format(best);}
  }
  function block(x,y,size,color,alpha=1,target=ctx){
    target.globalAlpha=alpha;
    target.fillStyle=color;target.fillRect(x,y,size,size);
    target.fillStyle='rgba(255,255,255,.24)';target.fillRect(x+2,y+2,size-4,Math.max(2,size*.12));
    target.fillStyle='rgba(0,0,0,.18)';target.fillRect(x+size*.72,y+2,size*.25,size-4);target.fillRect(x+2,y+size*.72,size-4,size*.25);
    target.strokeStyle='rgba(255,255,255,.12)';target.strokeRect(x+.5,y+.5,size-1,size-1);
    target.globalAlpha=1;
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();if(earthquakeTimer>0)ctx.translate((Math.random()-.5)*shake*.65,(Math.random()-.5)*shake*.65);
    ctx.fillStyle='#080e18';ctx.fillRect(0,0,canvas.width,canvas.height);
    // subtle grid
    ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;
    for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CELL+.5,0);ctx.lineTo(x*CELL+.5,canvas.height);ctx.stroke();}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL+.5);ctx.lineTo(canvas.width,y*CELL+.5);ctx.stroke();}
    // locked cells
    board.forEach((row,y)=>row.forEach((type,x)=>{if(type)block(x*CELL,y*CELL,CELL,COLORS[type]);}));
    // ghost
    let ghost={...current,y:current.y};
    while(!collision(ghost,0,1))ghost.y++;
    ghost.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)block((ghost.x+x)*CELL,(ghost.y+y)*CELL,CELL,COLORS[ghost.type],.19);}));
    // active
    current.matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)block((current.x+x)*CELL,(current.y+y)*CELL,CELL,COLORS[current.type]);}));
    // particles
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life/800);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;});
    if(clearFlash>0){ctx.fillStyle=`rgba(255,255,255,${clearFlash*0.55})`;ctx.fillRect(0,0,canvas.width,canvas.height);}
    if(screenPulse>0){ctx.fillStyle=`rgba(110,230,255,${screenPulse*0.28})`;ctx.fillRect(0,0,canvas.width,canvas.height);}
    if(glitchTimer>0&&Math.random()<0.45){ctx.fillStyle='rgba(255,40,160,.12)';const gy=Math.random()*canvas.height;ctx.fillRect(0,gy,canvas.width,2+Math.random()*8);}
    ctx.restore();
  }
  function drawPreview(target,piece){
    target.clearRect(0,0,target.canvas.width,target.canvas.height);
    target.fillStyle='#0a111c';target.fillRect(0,0,target.canvas.width,target.canvas.height);
    if(!piece)return;
    const m=piece.matrix;const size=22;
    const ox=(target.canvas.width-m[0].length*size)/2,oy=(target.canvas.height-m.length*size)/2;
    m.forEach((row,y)=>row.forEach((v,x)=>{if(v)block(ox+x*size,oy+y*size,size,COLORS[piece.type],1,target);}));
  }
  function sound(freq,duration,type='sine'){
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(.045,audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
    }catch(e){}
  }
  function togglePause(){
    if(gameOver)return;
    if(!running){start();return;}
    paused=!paused;
    if(paused){
      running=false;
      overlay.classList.remove('hidden');
      overlay.querySelector('.tetris-modal').innerHTML='<div class="icon">⏸️</div><h3>PAUSED</h3><p>Respira. La pista te espera.</p><button id="tetrisStart">RESUME</button>';
      document.getElementById('tetrisStart').onclick=()=>{overlay.classList.add('hidden');paused=false;running=true;lastTime=performance.now();requestAnimationFrame(loop);};
    }else start();
  }
  function keyHandler(e){
    if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(e.code))e.preventDefault();
    if(e.code==='Escape'||e.code==='KeyP'){togglePause();return;}
    if(!running||paused||gameOver)return;
    if(e.code==='ArrowLeft'||e.code==='KeyA'){move(-1,0);sound(300,.018);draw();}
    else if(e.code==='ArrowRight'||e.code==='KeyD'){move(1,0);sound(330,.018);draw();}
    else if(e.code==='ArrowDown'||e.code==='KeyS'){if(move(0,1)){score++;dropTimer=0;draw();updateHud();}}
    else if(e.code==='ArrowUp'||e.code==='KeyX'){rotatePiece(1);}
    else if(e.code==='KeyZ'){rotatePiece(-1);}
    else if(e.code==='Space'){hardDrop();}
    else if(e.code==='KeyC'||e.code==='ShiftLeft'||e.code==='ShiftRight'){holdPiece();}
  }
  document.addEventListener('keydown',keyHandler);
  document.getElementById('tetrisStart').onclick=start;
  document.getElementById('tetrisRestart').onclick=restart;
  document.getElementById('tetrisPause').onclick=togglePause;
  document.querySelectorAll('.tetris-mobile button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const a=btn.dataset.action;
      if(a==='left')move(-1,0);if(a==='right')move(1,0);if(a==='down')move(0,1);
      if(a==='rotate')rotatePiece();if(a==='drop')hardDrop();if(a==='hold')holdPiece();if(a==='pause')togglePause();if(a==='restart')restart();
      draw();updateHud();
    });
  });
  init();
})();