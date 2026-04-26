// ═══════════════════════════════════════════════
// trades.js — Trade Card Rendering, Modal, Like, Comment
// ═══════════════════════════════════════════════

/* ── BUILD TRADE CARD HTML ── */
function tradeCardHTML(t, showOwnerControls) {
  const game = GAMES.find(g => g.id === t.game) || { name: t.game, icon: '🎮' };
  const isOwner = showOwnerControls ||
    (state.currentUser && state.currentUser.email === t.userEmail);

  const imgContent = t.img
    ? (t.img.startsWith('data:') || t.img.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ? `<img src="${t.img}" style="width:100%;height:100%;object-fit:cover;border-radius:0" alt="">`
        : `<span style="font-size:4rem">${t.img}</span>`)
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-card2);color:var(--text-muted);font-size:0.8rem;flex-direction:column;gap:6px"><span style="font-size:2.5rem">🖼️</span><span>No image</span></div>`;

  const ownerActions = isOwner ? `
    <div class="owner-controls" onclick="event.stopPropagation()" style="display:flex;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <button class="action-btn edit-btn" onclick="openEditModal(${t.id})" style="flex:1;background:rgba(0,212,255,0.1);color:var(--accent-cyan);border:1px solid rgba(0,212,255,0.3)">
        ✏️ Edit
      </button>
      <button class="action-btn delete-btn" onclick="deleteTrade(${t.id})" style="flex:1;background:rgba(255,59,59,0.1);color:#ff5555;border:1px solid rgba(255,59,59,0.3)">
        🗑️ Delete
      </button>
    </div>` : '';

  return `
  <div class="trade-card" onclick="openTradeModal(${t.id})">
    <div class="trade-card-img">
      ${imgContent}
      <div class="trade-card-img-overlay"></div>
      <div class="trade-category-badge">${game.name}</div>
    </div>
    <div class="trade-card-body">
      <div class="trade-card-user">
        <div class="mini-avatar" onclick="event.stopPropagation();viewUserProfile('${t.userEmail||''}','${escapeHtml(t.user)}')" style="cursor:pointer">${getAvatarEl(t.user, t.userAvatar)}</div>
        <span class="trade-username" onclick="event.stopPropagation();viewUserProfile('${t.userEmail||''}','${escapeHtml(t.user)}')" style="cursor:pointer;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color=''">${t.user}</span>
        <span class="trade-time">${formatTime(t.created_at)}</span>
      </div>
      <div class="trade-title">${t.title}</div>
      <div class="trade-desc">${t.desc}</div>
      ${t.offer ? `<div class="trade-offer"><span>Offer: </span>${t.offer}</div>` : ''}
      <div class="trade-actions" onclick="event.stopPropagation()">
        <button class="action-btn ${t.likedByMe ? 'liked' : ''}" onclick="toggleLike(${t.id}, this)">
          ${t.likedByMe ? '❤️' : '🤍'} <span class="like-count">${t.likes || 0}</span>
        </button>
        <button class="action-btn" onclick="openTradeModal(${t.id})">
          💬 ${t.commentCount || 0}
        </button>
        ${isOwner ? '' : `<button class="trade-contact" onclick="goContact('${t.user}','${t.userEmail||''}')">Contact</button>`}
      </div>
      ${ownerActions}
    </div>
  </div>`;
}

/* ── FORMAT TIMESTAMP ── */
function formatTime(ts) {
  if (!ts) return '';
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

/* ── DELETE TRADE ── */
async function deleteTrade(id) {
  if (!state.currentUser) return;
  if (!confirm('Delete this trade post? This cannot be undone.')) return;
  try {
    await apiDelete('/trades/' + id);
    state.trades = state.trades.filter(t => t.id !== id);
    showToast('🗑️ Trade deleted.');
    if (typeof renderLatestTrades === 'function') renderLatestTrades();
    if (typeof renderBrowseGrid   === 'function') renderBrowseGrid();
    if (typeof renderMyTrades     === 'function') { renderMyTrades(); if (typeof renderProfile === 'function') renderProfile(); }
  } catch (e) {
    showToast(e.message || 'Could not delete trade.', 'error');
  }
}

/* ── OPEN EDIT MODAL ── */
async function openEditModal(id) {
  let t;
  try {
    t = await apiGet('/trades/' + id);
  } catch (e) {
    showToast('Could not load trade.', 'error'); return;
  }
  if (!state.currentUser || t.userEmail !== state.currentUser.email) return;

  const gameOpts = GAMES.map(g =>
    `<option value="${g.id}" ${g.id === t.game ? 'selected' : ''}>${g.icon} ${g.name}</option>`
  ).join('');

  const imgPreview = t.img
    ? (t.img.startsWith('data:') || t.img.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ? `<img id="editImgPreviewEl" src="${t.img}" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:8px" alt="">`
        : `<div id="editImgPreviewEl" style="font-size:3rem;text-align:center;padding:12px;background:var(--bg-card2);border-radius:8px;margin-top:8px">${t.img}</div>`)
    : `<img id="editImgPreviewEl" style="display:none;width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:8px" alt="">`;

  const noImgHint = !t.img
    ? `<div id="editNoImgHint" style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.82rem">📷 No image yet — click to add one</div>`
    : '';

  const removeBtn = t.img
    ? `<button onclick="clearEditImg(${id})" style="margin-top:6px;background:none;border:none;color:#ff5555;cursor:pointer;font-size:0.8rem">✕ Remove image</button>`
    : '';

  let overlay = document.getElementById('editTradeOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editTradeOverlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeEditTradeModal(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">✏️ Edit Trade Post</div>
        <button class="modal-close" onclick="closeEditTradeModal()">✕</button>
      </div>
      <div style="padding:0 4px">
        <div class="form-group">
          <label class="form-label">Game Category *</label>
          <select class="form-input" id="editPostGame">${gameOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Post Title *</label>
          <input class="form-input" id="editPostTitle" type="text" value="${escapeHtml(t.title)}">
        </div>
        <div class="form-group">
          <label class="form-label">Description *</label>
          <textarea class="form-input" id="editPostDesc" style="min-height:100px">${escapeHtml(t.desc)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Trade Offer / Price</label>
          <input class="form-input" id="editPostOffer" type="text" value="${escapeHtml(t.offer || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Post Image</label>
          <div class="post-img-upload" style="min-height:80px;padding:12px;cursor:pointer" onclick="document.getElementById('editImgInput').click()">
            <input type="file" accept="image/*" id="editImgInput" style="display:none" onchange="previewEditImg(this,${id})">
            ${noImgHint}
            ${imgPreview}
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;text-align:center">${t.img ? 'Click to replace image' : ''}</div>
          </div>
          <div id="editImgBtnWrap">${removeBtn}</div>
        </div>
        <div class="error-msg" id="editTradeError"></div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button class="btn btn-ghost" onclick="closeEditTradeModal()" style="flex:1">Cancel</button>
          <button class="btn btn-primary" onclick="saveEditedTrade(${id})" style="flex:2;padding:12px">💾 Save Changes</button>
        </div>
      </div>
    </div>`;

  overlay.classList.add('open');
  // store original image for change detection
  state._editImgDataURL = t.img || null;
}

function closeEditTradeModal() {
  const ov = document.getElementById('editTradeOverlay');
  if (ov) ov.classList.remove('open');
  state._editImgDataURL = null;
}

function previewEditImg(input, id) {
  if (!input.files[0]) return;
  const r = new FileReader();
  r.onload = e => {
    state._editImgDataURL = e.target.result;
    const el   = document.getElementById('editImgPreviewEl');
    const hint = document.getElementById('editNoImgHint');
    if (hint) hint.style.display = 'none';
    if (el)   { el.src = e.target.result; el.style.display = 'block'; }
    const btnWrap = document.getElementById('editImgBtnWrap');
    if (btnWrap && !btnWrap.querySelector('button')) {
      btnWrap.innerHTML = `<button onclick="clearEditImg(${id})" style="margin-top:6px;background:none;border:none;color:#ff5555;cursor:pointer;font-size:0.8rem">✕ Remove image</button>`;
    }
  };
  r.readAsDataURL(input.files[0]);
}

function clearEditImg(id) {
  state._editImgDataURL = '';
  const el = document.getElementById('editImgPreviewEl');
  if (el) { el.src = ''; el.style.display = 'none'; }
  const hint = document.getElementById('editNoImgHint');
  if (hint) hint.style.display = 'block';
  const btnWrap = document.getElementById('editImgBtnWrap');
  if (btnWrap) btnWrap.innerHTML = '';
}

async function saveEditedTrade(id) {
  const game  = document.getElementById('editPostGame').value;
  const title = document.getElementById('editPostTitle').value.trim();
  const desc  = document.getElementById('editPostDesc').value.trim();
  const offer = document.getElementById('editPostOffer').value.trim();
  const err   = document.getElementById('editTradeError');

  err.style.display = 'none';
  if (!game)  { showErr(err, 'Please select a game.'); return; }
  if (!title) { showErr(err, 'Title is required.'); return; }
  if (!desc)  { showErr(err, 'Description is required.'); return; }

  // _editImgDataURL: null = unchanged, '' = removed, string = new image
  const body = { game, title, desc, offer };
  if (state._editImgDataURL !== null) body.img = state._editImgDataURL || '';

  try {
    await apiPut('/trades/' + id, body);
    // Update local cache
    const idx = state.trades.findIndex(t => t.id === id);
    if (idx !== -1) {
      state.trades[idx] = { ...state.trades[idx], game, title, desc, offer };
      if (state._editImgDataURL !== null) state.trades[idx].img = state._editImgDataURL || null;
    }
    closeEditTradeModal();
    showToast('✅ Trade updated!');
    if (typeof renderLatestTrades === 'function') renderLatestTrades();
    if (typeof renderBrowseGrid   === 'function') renderBrowseGrid();
    if (typeof renderMyTrades     === 'function') { renderMyTrades(); if (typeof renderProfile === 'function') renderProfile(); }
  } catch (e) {
    showErr(err, e.message || 'Could not save changes.');
  }
}

/* ── HTML ESCAPE ── */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── TRADE DETAIL MODAL ── */
async function openTradeModal(id) {
  let t;
  try {
    t = await apiGet('/trades/' + id);
  } catch (e) {
    showToast('Could not load trade.', 'error'); return;
  }

  const game = GAMES.find(g => g.id === t.game) || { name: t.game, icon: '🎮' };

  const imgBlock = t.img
    ? (t.img.startsWith('data:') || t.img.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ? `<img src="${t.img}" style="width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:16px" alt="">`
        : `<div style="font-size:5rem;text-align:center;padding:20px;background:var(--bg-card2);border-radius:8px;margin-bottom:16px">${t.img}</div>`)
    : '';

  const isOwner = state.currentUser && state.currentUser.email === t.userEmail;

  const ownerModalControls = isOwner ? `
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <button class="btn btn-ghost" style="flex:1;font-size:0.82rem;padding:8px" onclick="closeModal();openEditModal(${t.id})">
        ✏️ Edit Post
      </button>
      <button onclick="closeModal();deleteTrade(${t.id})" style="flex:1;font-size:0.82rem;padding:8px;background:rgba(255,59,59,0.1);color:#ff5555;border:1px solid rgba(255,59,59,0.35);border-radius:var(--radius);cursor:pointer;font-family:inherit">
        🗑️ Delete Post
      </button>
    </div>` : '';

  const commentForm = state.currentUser
    ? `<div style="display:flex;gap:10px;align-items:flex-end">
         <textarea class="form-input" id="commentInput" placeholder="Write a comment..."
           style="min-height:60px;border-radius:12px;flex:1"></textarea>
         <button class="btn btn-primary" style="padding:10px 16px;flex-shrink:0"
           onclick="addComment(${t.id})">Send</button>
       </div>`
    : `<p style="font-size:0.82rem;color:var(--text-muted)">
         <a href="login.html" style="color:var(--accent-cyan)">Sign in</a> to comment.
       </p>`;

  document.getElementById('modalTitle').textContent = t.title;
  document.getElementById('modalBody').innerHTML = `
    <div class="tag tag-cyan" style="margin-bottom:14px">${game.icon} ${game.name}</div>
    ${imgBlock}
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div class="mini-avatar" style="width:34px;height:34px;font-size:0.85rem;cursor:pointer" onclick="closeModal();viewUserProfile('${t.userEmail||''}','${t.user}')">${getAvatarEl(t.user, t.userAvatar)}</div>
      <div>
        <div style="font-size:0.88rem;font-weight:600;cursor:pointer;transition:color 0.2s" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color=''" onclick="closeModal();viewUserProfile('${t.userEmail||''}','${t.user}')">${t.user}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${formatTime(t.created_at)}</div>
      </div>
      ${!isOwner && state.currentUser ? `<button class="trade-contact" style="margin-left:auto" onclick="goContact('${t.user}','${t.userEmail||''}');closeModal()">Contact Trader</button>` : ''}
    </div>
    <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.7;margin-bottom:14px">${t.desc}</p>
    ${t.offer ? `<div class="trade-offer" style="margin-bottom:18px"><span>Trade Offer: </span>${t.offer}</div>` : ''}
    <div class="divider"></div>
    ${ownerModalControls}
    <div style="display:flex;gap:16px;margin-bottom:20px">
      <button class="action-btn ${t.likedByMe ? 'liked' : ''}" style="font-size:0.88rem"
        onclick="toggleLike(${t.id}, this);this.closest('.modal-overlay') && openTradeModal(${t.id})">
        ${t.likedByMe ? '❤️' : '🤍'} <span class="like-count">${t.likes || 0}</span> Likes
      </button>
      <span style="color:var(--text-muted);font-size:0.85rem">💬 ${(t.comments||[]).length} Comments</span>
    </div>
    <div style="font-family:'Rajdhani',sans-serif;font-size:1rem;font-weight:700;margin-bottom:14px">Comments</div>
    <div class="comments-list">${renderComments(t.comments || [], t.id)}</div>
    ${commentForm}
  `;

  document.getElementById('modalOverlay').classList.add('open');
}

/* ── RENDER COMMENTS ── */
function renderComments(comments, tradeId) {
  if (!comments || !comments.length)
    return `<p style="font-size:0.82rem;color:var(--text-muted);padding:8px 0">No comments yet. Be the first!</p>`;

  return comments.map((c, idx) => {
    const repliesHtml = (c.replies || []).map(r => `
      <div class="reply">
        <div class="mini-avatar" style="width:26px;height:26px;font-size:0.7rem;flex-shrink:0">${getAvatarEl(r.user, r.userAvatar)}</div>
        <div class="reply-body">
          <div class="comment-header">
            <span class="comment-user">${r.user}</span>
            <span class="comment-time">${formatTime(r.time)}</span>
          </div>
          <div class="comment-text">${r.text}</div>
        </div>
      </div>`).join('');

    const replyFormId = `replyForm_${tradeId}_${idx}`;
    const replyForm = state.currentUser ? `
      <div class="reply-input-wrap" id="${replyFormId}" style="display:none">
        <textarea class="form-input" id="replyInput_${tradeId}_${idx}" placeholder="Write a reply..." style="min-height:48px;font-size:0.8rem;border-radius:8px;flex:1"></textarea>
        <button class="btn btn-primary" style="font-size:0.78rem;padding:8px 12px" onclick="addReply(${tradeId},${idx},${c.id})">↩ Reply</button>
      </div>` : '';

    return `
    <div class="comment">
      <div class="mini-avatar" style="flex-shrink:0">${getAvatarEl(c.user, c.userAvatar)}</div>
      <div class="comment-body" style="flex:1">
        <div class="comment-header">
          <span class="comment-user">${c.user}</span>
          <span class="comment-time">${formatTime(c.time)}</span>
        </div>
        <div class="comment-text">${c.text}</div>
        ${state.currentUser ? `<button class="comment-reply-btn" onclick="toggleReplyForm('${replyFormId}')">↩ Reply${c.replies && c.replies.length ? ` (${c.replies.length})` : ''}</button>` : ''}
        ${repliesHtml ? `<div class="replies-list">${repliesHtml}</div>` : ''}
        ${replyForm}
      </div>
    </div>`;
  }).join('');
}

/* ── TOGGLE REPLY FORM ── */
function toggleReplyForm(id) {
  const form = document.getElementById(id);
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  if (form.style.display === 'flex') form.querySelector('textarea')?.focus();
}

/* ── ADD REPLY ── */
async function addReply(tradeId, commentIdx, commentId) {
  if (!state.currentUser) return;
  const input = document.getElementById(`replyInput_${tradeId}_${commentIdx}`);
  const text  = input?.value.trim();
  if (!text) return;

  try {
    await apiPost(`/trades/${tradeId}/comments/${commentId}/replies`, { text });
    openTradeModal(tradeId);
  } catch (e) {
    showToast(e.message || 'Could not send reply.', 'error');
  }
}

/* ── ADD COMMENT ── */
async function addComment(tradeId) {
  const text = document.getElementById('commentInput').value.trim();
  if (!text) return;

  try {
    await apiPost(`/trades/${tradeId}/comments`, { text });
    openTradeModal(tradeId);
  } catch (e) {
    showToast(e.message || 'Could not post comment.', 'error');
  }
}

/* ── TOGGLE LIKE ── */
async function toggleLike(id, btnEl) {
  if (!state.currentUser) { showToast('Sign in to like posts', 'error'); return; }

  try {
    const { liked, likes } = await apiPost(`/trades/${id}/like`);

    // Update local cache
    const t = state.trades.find(tr => tr.id === id);
    if (t) { t.likedByMe = liked; t.likes = likes; }

    // Update button in place (no full re-render needed)
    if (btnEl) {
      btnEl.innerHTML = `${liked ? '❤️' : '🤍'} <span class="like-count">${likes}</span>`;
      btnEl.classList.toggle('liked', liked);
    }

    if (typeof renderLatestTrades === 'function') renderLatestTrades();
    if (typeof renderBrowseGrid   === 'function') renderBrowseGrid();
    if (typeof renderMyTrades     === 'function') renderMyTrades();
  } catch (e) {
    showToast(e.message || 'Could not update like.', 'error');
  }
}

/* ── CONTACT HELPER ── */
async function goContact(username, userEmail) {
  if (!state.currentUser) {
    showToast('Sign in to contact traders', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return;
  }
  if (username === state.currentUser.name) {
    showToast("You can't message yourself!", 'error');
    return;
  }
  try {
    const { convoId } = await getOrCreateConvo(userEmail);
    sessionStorage.setItem('gbh_openConvo', convoId);
    window.location.href = 'messages.html';
  } catch (e) {
    showToast(e.message || 'Could not open chat.', 'error');
  }
}
