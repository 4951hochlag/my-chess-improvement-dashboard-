/* Public Chess.com data; no credentials or account changes. */
(() => {
  const USER = 'based_pawn', KEY = 'chesscom_based_pawn_v1';
  const API = 'https://api.chess.com/pub/player/' + USER;
  let snapshot = null, busy = false, message = '', mode = 'rapid', days = 90;
  try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && Array.isArray(v.games) && v.stats) snapshot = v; } catch (_) {}
  const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = t => new Date(t * 1000).toLocaleDateString();
  const card = (label, value, detail = '') => `<div class="stat"><div class="name">${html(label)}</div><div class="number">${html(value)}</div><div class="tiny">${html(detail)}</div></div>`;
  const table = (headers, rows) => `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;text-align:left"><thead><tr>${headers.map(h => `<th style="padding:10px">${html(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td style="padding:10px;border-top:1px solid #61738b44">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  function normalize(g) {
    const color = g.white?.username?.toLowerCase() === USER ? 'white' : g.black?.username?.toLowerCase() === USER ? 'black' : null;
    if (!color || g.rules !== 'chess' || !Number.isFinite(g.end_time)) return null;
    const me = g[color], opponent = g[color === 'white' ? 'black' : 'white'];
    const draws = ['agreed','repetition','stalemate','insufficient','50move','timevsinsufficient'];
    const result = me.result === 'win' ? 'Win' : draws.includes(me.result) ? 'Draw' : opponent.result === 'win' ? 'Loss' : 'Other';
    let opening = (g.pgn || '').match(/\[Opening "([^"]+)"\]/)?.[1];
    if (!opening && g.eco) { try { opening = decodeURIComponent(new URL(g.eco).pathname.split('/').pop()).replace(/-/g, ' '); } catch (_) {} }
    return {id:g.uuid || g.url, url:g.url, end:g.end_time, mode:g.time_class, rated:g.rated === true, color, rating:me.rating, opponent:opponent.username, result, opening:opening || 'Unspecified opening', accuracy:g.accuracies?.[color]};
  }
  async function get(url) {
    const r = await fetch(url, {signal:AbortSignal.timeout(20000)});
    if (!r.ok) throw Error(`Chess.com returned HTTP ${r.status}. Try refreshing later.`);
    return r.json();
  }
  async function sync() {
    if (busy) return;
    busy = true; message = 'Connecting to Chess.com…'; redraw();
    try {
      const stats = await get(API + '/stats');
      if (!stats || !Object.keys(stats).some(k => k.startsWith('chess_'))) throw Error('No rating data returned.');
      const archives = await get(API + '/games/archives');
      if (!Array.isArray(archives.archives)) throw Error('Invalid game archive response.');
      // Twelve calendar months; requests are serial to respect API rate limits.
      const now = new Date(), cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
      const urls = archives.archives.filter(u => /^https:\/\/api\.chess\.com\/pub\/player\/based_pawn\/games\/\d{4}\/\d{2}$/.test(u) && new Date(u.slice(-7).replace('/', '-') + '-01T00:00:00Z') >= cutoff).sort();
      const games = new Map();
      for (let i = 0; i < urls.length; i++) {
        message = `Loading game history ${i + 1} of ${urls.length}…`; redraw();
        const month = await get(urls[i]);
        if (!Array.isArray(month.games)) throw Error('Invalid monthly archive response.');
        for (const raw of month.games) { const g = normalize(raw); if (g?.id) games.set(g.id, g); }
      }
      snapshot = {stats, games:[...games.values()].sort((a,b) => a.end-b.end), fetched:Date.now(), since:cutoff.toISOString()};
      message = '';
      try { localStorage.setItem(KEY, JSON.stringify(snapshot)); } catch (_) { message = 'Loaded successfully; browser storage is unavailable, so this data cannot be cached.'; }
    } catch (e) { message = `Could not finish updating. ${e.message} ${snapshot ? 'Showing the last complete update.' : 'Use Refresh to try again.'}`; }
    finally { busy = false; redraw(); }
  }
  function redraw() { if (typeof tab !== 'undefined' && tab === 'Chess.com') window.renderChessCom(document.getElementById('app')); }
  function chart(games) {
    const points = games.filter(g => g.rated && Number.isFinite(g.rating));
    if (points.length < 2) return '<p class="muted">Play at least two rated games in this period to see a trend.</p>';
    const min = Math.min(...points.map(g => g.rating)) - 10, max = Math.max(...points.map(g => g.rating)) + 10;
    const first = points[0], last = points.at(-1), span = Math.max(1, last.end-first.end);
    const coords = points.map(g => `${50 + (g.end-first.end)/span*690},${190 - (g.rating-min)/(max-min)*160}`).join(' ');
    return `<svg viewBox="0 0 780 230" role="img" aria-label="${html(mode)} rating history from ${first.rating} to ${last.rating}" style="width:100%;max-height:300px"><text x="0" y="35" fill="currentColor">${max}</text><text x="0" y="190" fill="currentColor">${min}</text><path d="M45 20V195H750" stroke="#8093ad" fill="none"/><polyline points="${coords}" fill="none" stroke="#65a7ed" stroke-width="3"/><text x="50" y="222" fill="currentColor">${date(first.end)}</text><text x="740" y="222" text-anchor="end" fill="currentColor">${date(last.end)}</text></svg><p class="tiny">${first.rating} → ${last.rating} · ${last.rating-first.rating >= 0 ? '+' : ''}${last.rating-first.rating} between first and last rated games shown</p>`;
  }
  window.renderChessCom = function(el) {
    const all = snapshot?.games || [];
    const games = all.filter(g => g.mode === mode && (!days || g.end >= Date.now()/1000 - days*86400));
    const wins = games.filter(g => g.result === 'Win').length, losses = games.filter(g => g.result === 'Loss').length, draws = games.filter(g => g.result === 'Draw').length;
    const breakdown = color => { const a = games.filter(g => g.color === color); return [html(color === 'white' ? 'White' : 'Black'), a.length, a.filter(g => g.result === 'Win').length, a.filter(g => g.result === 'Draw').length, a.filter(g => g.result === 'Loss').length, a.length ? (100*a.filter(g => g.result === 'Win').length/a.length).toFixed(1)+'%' : '—']; };
    const openings = new Map();
    for (const g of games) { const key = g.color + ':' + g.opening; const o = openings.get(key) || {name:g.opening,color:g.color,n:0,w:0,d:0,l:0}; o.n++; o.w += g.result === 'Win'; o.d += g.result === 'Draw'; o.l += g.result === 'Loss'; openings.set(key,o); }
    el.innerHTML = `<div class="heading"><div><div class="eyebrow">Playing & progress</div><h1>Chess.com</h1><div class="muted">based_pawn · Standard chess</div></div><div class="tools"><button id="ccRefresh" ${busy?'disabled':''}>${busy?'Updating…':'Refresh'}</button><a class="btn" href="https://www.chess.com/member/based_pawn" target="_blank" rel="noopener noreferrer">Open profile ↗</a></div></div>
      <p class="tiny" role="status">${html(message || (snapshot ? 'Last synchronized: '+new Date(snapshot.fetched).toLocaleString() : 'Ready to connect.'))}</p>
      <div class="stats">${['rapid','blitz','bullet','daily'].map(m => {const s=snapshot?.stats['chess_'+m];return card(m[0].toUpperCase()+m.slice(1),s?.last?.rating ?? '—',s?.best?.rating ? 'Best: '+s.best.rating : 'No rating available');}).join('')}</div>
      <section class="panel"><div class="tools"><label for="ccMode">Time category</label><select id="ccMode">${['rapid','blitz','bullet','daily'].map(m=>`<option value="${m}" ${m===mode?'selected':''}>${m[0].toUpperCase()+m.slice(1)}</option>`).join('')}</select><label for="ccPeriod">Period</label><select id="ccPeriod">${[[30,'Last 30 days'],[90,'Last 90 days'],[0,'Loaded history']].map(([v,n])=>`<option value="${v}" ${v===days?'selected':''}>${n}</option>`).join('')}</select></div><p class="tiny">History covers the current month and previous 11 months. Results include rated and unrated games; the rating chart uses rated games only.</p></section>
      <div class="stats">${card('Games played',games.length)}${card('Wins',wins,games.length?(100*wins/games.length).toFixed(1)+'% win rate':'')}${card('Draws',draws)}${card('Losses',losses)}</div>
      <section class="panel"><h2>Rating history</h2>${chart(games)}</section>
      <section class="panel"><h2>White versus Black</h2>${table(['Colour','Games','Wins','Draws','Losses','Win rate'],[breakdown('white'),breakdown('black')])}</section>
      <section class="panel"><h2>Most played openings</h2>${openings.size?table(['Opening','Colour','Games','W / D / L'],[...openings.values()].sort((a,b)=>b.n-a.n).slice(0,10).map(o=>[html(o.name),html(o.color),o.n,`${o.w} / ${o.d} / ${o.l}`])):'<p class="muted">No games in this selection.</p>'}</section>
      <section class="panel"><h2>Recent games</h2>${games.length?table(['Date','Opponent','Colour','Result','Rating','Accuracy','Game'],games.slice(-25).reverse().map(g=>[date(g.end),html(g.opponent),html(g.color),html(g.result),html(g.rating??'—'),Number.isFinite(g.accuracy)?g.accuracy.toFixed(1)+'%':'—',/^https:\/\/(www\.)?chess\.com\/game\//.test(g.url||'')?`<a style="color:inherit" href="${html(g.url)}" target="_blank" rel="noopener noreferrer">View ↗</a>`:'—'])):'<p class="muted">No games in this selection.</p>'}</section>
      <p class="tiny">Refreshes on opening this section when the last complete update is over 24 hours old. Chess.com may cache its responses. Accuracy appears only when supplied by Chess.com.</p>`;
    document.getElementById('ccRefresh').onclick = sync;
    document.getElementById('ccMode').onchange = e => {mode=e.target.value;redraw();};
    document.getElementById('ccPeriod').onchange = e => {days=Number(e.target.value);redraw();};
  };
  window.ensureChessCom = () => { if (!busy && (!snapshot || Date.now()-snapshot.fetched>86400000) && !message) sync(); };
})();
