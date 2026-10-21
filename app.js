'use strict';

(() => {
  const STORAGE_KEY = 'tapa.reflection.v1';
  const main = document.getElementById('main');
  const dialog = document.getElementById('dialog');
  const labels = ['My courses', 'My confidence', 'My reflection', 'My development', 'Review'];
  const confidenceLabels = ['Not yet confident', 'Slightly confident', 'Moderately confident', 'Confident', 'Very confident'];
  let store = { version: 1, draft: null, records: [] };
  let view = { page: 'home', recordId: null, period: 2 };
  let storageAvailable = true;
  let storageCorrupt = false;
  let saveTimer;
  let toastTimer;
  let dialogCallback;
  let dialogTrigger;
  const svgPaths = {
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    back: '<path d="m14 6-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3V4Z"/>',
    circle: '<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>',
    reflection: '<path d="M5 4h14v11H9l-4 4V4Z"/><path d="M8 8h8M8 11h5"/>',
    growth: '<path d="M5 19V9m7 10V5m7 14V2"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    document: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>',
    trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${svgPaths[name] || svgPaths.document}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const uid = () => window.crypto?.randomUUID?.() || `r-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const date = value => new Intl.DateTimeFormat('en-AU', { day:'numeric', month:'short', year:'numeric' }).format(new Date(value));
  const time = value => new Intl.DateTimeFormat('en-AU', { hour:'numeric', minute:'2-digit' }).format(new Date(value));
  const filled = value => typeof value === 'string' && value.trim().length > 0;
  const blankCourse = () => ({ id: uid(), name: '', inclusion: '', support: '', opportunities: '' });
  const blankDraft = () => ({ id: uid(), questionSet: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), step: 0, scroll: 0, focus: null, returnToReview: false, courses: [blankCourse()], confidence: null, confidenceDetails: { strengths:'', guidance:'' }, reflection: { working:'', difficulties:'', feedback:'', changes:'' }, development: { support:'', next:'', consultation:'', progress:'' } });
  const detailFields = { confidenceDetails:['strengths','guidance'], reflection:['working','difficulties','feedback','changes'], development:['support','next','consultation','progress'] };

  function upgradeDraft(draft) {
    if (!draft) return;
    draft.questionSet = 2;
    draft.courses.forEach(course => { course.opportunities ??= ''; });
    draft.confidenceDetails ??= { strengths:'', guidance:'' };
    for (const [group, keys] of Object.entries(detailFields)) {
      for (const key of keys) draft[group][key] ??= '';
    }
  }

  function validResponse(item) {
    const optionalText = value => value === undefined || typeof value === 'string';
    return item && typeof item.id === 'string' && Array.isArray(item.courses) && item.courses.length > 0 && item.courses.every(c => c && ['id','name','inclusion','support'].every(k => typeof c[k] === 'string') && optionalText(c.opportunities)) && (item.confidence === null || Number.isInteger(item.confidence) && item.confidence >= 1 && item.confidence <= 5) && (item.confidenceDetails === undefined || item.confidenceDetails && ['strengths','guidance'].every(k => optionalText(item.confidenceDetails[k]))) && item.reflection && ['working','difficulties'].every(k => typeof item.reflection[k] === 'string') && ['feedback','changes'].every(k => optionalText(item.reflection[k])) && item.development && ['support','next'].every(k => typeof item.development[k] === 'string') && ['consultation','progress'].every(k => optionalText(item.development[k]));
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.records) || !saved.records.every(r => validResponse(r) && Number.isFinite(Date.parse(r.finishedAt))) || (saved.draft !== null && (!validResponse(saved.draft) || !Number.isInteger(saved.draft.step) || saved.draft.step < 0 || saved.draft.step > 4))) throw new Error('Unrecognised saved data');
      store = saved;
      upgradeDraft(store.draft);
    }
  } catch (error) {
    storageAvailable = false;
    storageCorrupt = error instanceof SyntaxError || error.message === 'Unrecognised saved data';
  }

  function persist() {
    clearTimeout(saveTimer);
    if (storageCorrupt) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      storageAvailable = true;
      setSaveStatus('Saved on this device');
      return true;
    } catch {
      storageAvailable = false;
      setSaveStatus('Not saved — browser storage unavailable');
      storageWarning();
      return false;
    }
  }
  function touch() {
    if (!store.draft) return;
    store.draft.updatedAt = new Date().toISOString();
    setSaveStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  }
  function setSaveStatus(text) {
    const status = document.getElementById('save-status');
    if (status) status.innerHTML = `${icon(storageAvailable ? 'check' : 'info')}<span>${esc(text)}</span>`;
  }
  function storageWarning() {
    if (document.getElementById('storage-warning')) return;
    const el = document.createElement('div');
    el.id = 'storage-warning'; el.className = 'local-warning'; el.setAttribute('role', 'alert');
    el.textContent = storageCorrupt ? 'Previously saved data could not be read and has not been changed. New answers will last only for this visit.' : 'Browser storage is unavailable or full. Keep this page open; your latest changes may not survive a reload.';
    document.body.append(el);
  }
  function rememberPosition() {
    if (view.page !== 'flow' || !store.draft) return;
    store.draft.scroll = window.scrollY;
    const focused = document.activeElement;
    if (focused?.matches('[data-field], [name="confidence"]')) store.draft.focus = focused.id;
  }
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }
  function updateHistory() {
    const hash = view.page === 'flow' && store.draft ? `#/reflection/${store.draft.step}${store.draft.returnToReview ? '?review=1' : ''}` : view.page === 'record' ? `#/record/${encodeURIComponent(view.recordId)}` : view.page === 'education' ? '#/insights' : view.page === 'records' ? '#/records' : '#/';
    if (location.hash !== hash) history.pushState(null, '', hash);
  }
  function readRoute() {
    const hash = location.hash;
    const flowMatch = hash.match(/^#\/reflection\/([0-4])(\?review=1)?$/);
    if (flowMatch && store.draft) {
      view.page = 'flow';
      store.draft.step = Number(flowMatch[1]);
      store.draft.returnToReview = Boolean(flowMatch[2]);
    } else if (hash === '#/records') view.page = 'records';
    else if (hash === '#/insights' || hash === '#source-responses') view.page = 'education';
    else if (hash.startsWith('#/record/')) {
      const id = hash.slice('#/record/'.length);
      view.page = store.records.some(r => r.id === id) ? 'record' : 'records'; view.recordId = id;
    } else view.page = 'home';
  }
  function navigate(page, opts = {}) {
    rememberPosition(); persist();
    view = { ...view, page, ...opts };
    updateHistory();
    render();
    window.scrollTo({ top:0, behavior:'instant' });
    main.focus({ preventScroll:true });
  }
  function goStep(step, editing = false) {
    if (!store.draft) return;
    store.draft.step = step;
    store.draft.returnToReview = editing;
    store.draft.scroll = 0; store.draft.focus = null;
    persist(); view.page = 'flow'; updateHistory(); render();
    window.scrollTo({ top:0, behavior:'instant' }); main.focus({ preventScroll:true });
  }
  function startNew() {
    if (store.draft) {
      openDialog('You have a saved reflection.', 'Resume your existing draft to keep working. Starting a new reflection will replace that draft; your completed records will stay.', [
        { label:'Start new', action:'confirm', className:'secondary' }, { label:'Resume draft', action:'resume-draft' }
      ], () => { store.draft = blankDraft(); goStep(0); });
    } else { store.draft = blankDraft(); goStep(0); }
  }
  function resumeDraft() {
    if (!store.draft) return;
    const scroll = store.draft.scroll || 0;
    const focus = store.draft.focus;
    view.page = 'flow'; updateHistory(); render();
    requestAnimationFrame(() => {
      window.scrollTo({ top:scroll, behavior:'instant' });
      if (focus) document.getElementById(focus)?.focus({ preventScroll:true });
      else main.focus({ preventScroll:true });
    });
  }
  function openDialog(title, body, actions, callback) {
    dialogTrigger = document.activeElement;
    dialogCallback = callback;
    document.getElementById('dialog-content').innerHTML = `<div class="dialog-icon">${icon('info')}</div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(body)}</p><div class="dialog-actions">${actions.map(a => `<button class="btn ${a.className || ''}" data-action="dialog-${a.action}">${esc(a.label)}</button>`).join('')}</div>`;
    dialog.showModal();
  }
  function closeDialog() { dialog.close(); }
  dialog.addEventListener('close', () => { if (dialogTrigger?.isConnected) dialogTrigger.focus({ preventScroll:true }); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) closeDialog(); } });

  function home() {
    const hasDraft = Boolean(store.draft);
    return `<section class="hero">
      <svg class="hero-side-mark hero-side-mark-left" viewBox="0 0 160 220" aria-hidden="true"><path d="M10 180c30-7 34-39 57-47s42 12 76-6M17 197c27-8 37-29 59-35s38 8 61-4M32 107c20-13 23-35 45-44s36 4 55-10M35 125c20-10 27-24 44-29" /><path d="M21 69c14-5 21-15 30-29M83 171c13-8 22-8 36-4" /></svg>
      <svg class="hero-side-mark hero-side-mark-right" viewBox="0 0 160 220" aria-hidden="true"><path d="M10 180c30-7 34-39 57-47s42 12 76-6M17 197c27-8 37-29 59-35s38 8 61-4M32 107c20-13 23-35 45-44s36 4 55-10M35 125c20-10 27-24 44-29" /><path d="M21 69c14-5 21-15 30-29M83 171c13-8 22-8 36-4" /></svg>
      <p class="eyebrow">Staff curriculum reflection</p>
      <h1>Reflect on your teaching.<span>Plan what comes next.</span></h1>
      <p class="hero-copy">Describe how Aboriginal and Torres Strait Islander knowledges are included in your courses and where you need support.</p>
      <div class="hero-actions"><button class="btn" data-action="${hasDraft ? 'resume' : 'start'}">${hasDraft ? 'Resume reflection' : 'Start reflection'} ${icon('arrow')}</button><a class="text-btn" href="#how-it-works">How it works ${icon('chevron')}</a></div>
      <p class="hero-note">${hasDraft ? `Your draft is saved · ${esc(labels[store.draft.step])}` : 'Four sections. Add a separate entry for each course.'}</p>
      <div class="product-stage" aria-hidden="true">
        <div class="preview-window"><div class="window-bar"><i></i><i></i><i></i><span>Staff curriculum reflection</span></div><div class="preview-layout">
          <div class="preview-sidebar"><div class="mini-title">Your reflection</div>${labels.slice(0,4).map((l,i) => `<div class="mini-step ${i === 0 ? 'current' : ''}"><span>${i+1}</span>${l.replace('My ','')}</div>`).join('')}</div>
          <div class="preview-main"><div class="preview-caption">01 / YOUR TEACHING</div><h2>Start with your courses.</h2><p>Add a course, then answer the questions below.</p><div class="mini-course"><div class="mini-course-icon">${icon('book')}</div><div><strong>Your course</strong><small>Course name and teaching context</small></div><span>01</span></div><div class="mini-field">Where would support make a difference?<div class="mini-lines"></div></div></div>
        </div></div><div class="floating-note">${icon('circle')}<div><strong>Pick up where you left off.</strong><small>Your draft stays on this device.</small></div></div>
      </div>
    </section>
    <p class="intro-line"><strong>Add one entry per course.</strong> Your answers about confidence, reflection and development apply across all your courses.</p>
    <section class="journey-section" id="how-it-works"><div class="section-inner"><div class="section-heading"><h2>How the reflection works.</h2><p>The course section repeats for each course.<br>Complete the other sections once.</p></div><div class="journey-grid">${[
      ['book','Your courses','Name each course and describe what you do now and where you need support.'],
      ['circle','Your confidence','Rate your confidence and note where you want guidance.'],
      ['reflection','Your reflection','Describe what has worked and what has been difficult.'],
      ['growth','Your development','Record the support you need and what you want to work on next.']
    ].map((c,i)=>`<article class="journey-card"><span class="step-number">0${i+1}</span>${icon(c[0])}<h3>${c[1]}</h3><p>${c[2]}</p></article>`).join('')}</div></div></section>
    <section class="privacy-section"><h2>Your answers stay<br>in this browser.</h2><div><p>You can pause, return and edit your answers. Finishing creates a record on this device; it does not send anything to the education team.</p><p>The proposed service would let authorised education-team members review reflections to identify support needs. The client has not confirmed the access rules.</p><button class="text-btn" data-action="about">About your answers ${icon('chevron')}</button></div></section>`;
  }

  function sectionComplete(d, i) {
    if (i === 0) return d.courses.every(c => ['name','inclusion','support','opportunities'].every(key => filled(c[key])));
    if (i === 1) return d.confidence !== null && detailFields.confidenceDetails.every(key => filled(d.confidenceDetails[key]));
    if (i === 2) return detailFields.reflection.every(key => filled(d.reflection[key]));
    if (i === 3) return detailFields.development.every(key => filled(d.development[key]));
    return false;
  }
  function steps(d) {
    return `<aside class="flow-aside"><p class="eyebrow">Reflection form</p><h2>Sections</h2><ol class="step-list">${labels.map((l,i)=>`<li><button class="step-button ${d.step === i ? 'current' : sectionComplete(d,i) ? 'complete' : ''}" data-action="step" data-step="${i}" ${d.step === i ? 'aria-current="step"' : ''}><span class="step-circle">${d.step !== i && sectionComplete(d,i) ? icon('check') : i+1}</span><span>${l}</span></button></li>`).join('')}</ol><p class="aside-note">Only courses repeat.<br>Your confidence, reflection and development cover your teaching as a whole.</p></aside>`;
  }
  function field({id,label,value,path,course,placeholder='',help='',input=false}) {
    const attributes = `id="${esc(id)}" data-field="${esc(path)}" ${course ? `data-course="${esc(course)}"` : ''} maxlength="${input ? 150 : 5000}" placeholder="${esc(placeholder)}" ${help ? `aria-describedby="${esc(id)}-help"` : ''}`;
    return `<div class="field"><label for="${esc(id)}">${label}</label>${input ? `<input type="text" ${attributes} value="${esc(value)}" autocomplete="off">` : `<textarea ${attributes}>${esc(value)}</textarea>`}${help ? `<p class="field-help" id="${esc(id)}-help">${help}</p>` : ''}</div>`;
  }
  function courseForm(d) {
    return `<p class="eyebrow">01 / Your teaching</p><h1>Start with your courses.</h1><p class="section-description">Complete this section for each course. The other sections cover your teaching as a whole.</p><div id="course-list">${d.courses.map((c,i)=>`<section class="course-card" id="course-${esc(c.id)}" aria-label="Course ${i+1}"><div class="course-header"><span class="course-label">Course ${String(i+1).padStart(2,'0')}</span>${d.courses.length > 1 ? `<button class="icon-button" data-action="remove-course" data-id="${esc(c.id)}" aria-label="Remove course ${i+1}">${icon('trash')}</button>` : ''}</div>${field({id:`name-${c.id}`,label:'Course name or code',value:c.name,path:'name',course:c.id,placeholder:'e.g. Introduction to Design',input:true})}${field({id:`inclusion-${c.id}`,label:'How are Aboriginal and Torres Strait Islander knowledges currently included in this course?',value:c.inclusion,path:'inclusion',course:c.id,placeholder:'Describe your current approach…'})}${field({id:`support-${c.id}`,label:'Which aspects of this course would you like support with?',value:c.support,path:'support',course:c.id,placeholder:'Where could support make a difference?'})}${field({id:`opportunities-${c.id}`,label:'Where could these knowledges be meaningfully included in the course?',value:c.opportunities,path:'opportunities',course:c.id,placeholder:'Identify an opportunity you would like to explore…',help:'Consider relevant learning outcomes, learning activities or assessments, and any guidance you would need.'})}</section>`).join('')}</div><button class="add-course" data-action="add-course">${icon('plus')} Add another course</button>`;
  }
  function confidenceForm(d) {
    return `<p class="eyebrow">02 / Your confidence</p><h1>Your confidence.</h1><p class="section-description">Think about your teaching as a whole. Your rating and examples show where you feel ready and where you want guidance.</p><p class="scale-question" id="confidence-question">How confident do you feel about incorporating Aboriginal and Torres Strait Islander knowledges into your teaching?</p><fieldset class="confidence-fieldset" aria-describedby="confidence-question"><legend>Choose one response.</legend><div class="scale-options">${confidenceLabels.map((label,i)=>`<label class="scale-option" for="confidence-${i+1}"><input type="radio" id="confidence-${i+1}" name="confidence" value="${i+1}" ${d.confidence === i+1 ? 'checked' : ''}><span class="radio-dot" aria-hidden="true"></span><span class="scale-value">${i+1}</span><span class="scale-label">${label}</span></label>`).join('')}</div></fieldset><p class="gentle-note">There is no right or wrong answer. This is a reflection on confidence, not an assessment of teaching performance.</p><div class="prompt-block">${field({id:'confidence-strengths',label:'Which parts of this work do you feel most confident about?',value:d.confidenceDetails.strengths,path:'confidenceDetails.strengths',placeholder:'Describe an area where you feel ready to act…',help:'You could draw on relevant experience, learning or previous support.'})}</div><div class="prompt-block">${field({id:'confidence-guidance',label:'Which parts would you want guidance on before proceeding?',value:d.confidenceDetails.guidance,path:'confidenceDetails.guidance',placeholder:'Explain what you would want to clarify…',help:'For example, evaluating resources, attribution, permissions or respectful use.'})}</div>`;
  }
  function reflectionForm(d) {
    return `<p class="eyebrow">03 / Your reflection</p><h1>Your teaching experience.</h1><p class="section-description">Think about what has happened across your courses. Give an example where you can, and say if a question does not apply to you.</p><div class="prompt-block">${field({id:'reflection-working',label:'What is working well in how you include Aboriginal and Torres Strait Islander knowledges in your teaching?',value:d.reflection.working,path:'reflection.working',placeholder:'Think about an approach, activity or conversation that worked well…'})}</div><div class="prompt-block">${field({id:'reflection-difficulties',label:'What difficulties have you experienced?',value:d.reflection.difficulties,path:'reflection.difficulties',placeholder:'What has been challenging, or where do you feel unsure?'})}</div><div class="prompt-block">${field({id:'reflection-feedback',label:'What feedback, if any, have students or colleagues shared about your approach?',value:d.reflection.feedback,path:'reflection.feedback',placeholder:'Describe feedback you have actually received…',help:'If you have not received feedback, say so. Leave out names and identifying details.'})}</div><div class="prompt-block">${field({id:'reflection-changes',label:'What would you change after reflecting on these experiences?',value:d.reflection.changes,path:'reflection.changes',placeholder:'What could you approach differently, and why?'})}</div>`;
  }
  function developmentForm(d) {
    return `<p class="eyebrow">04 / Your development</p><h1>What support would help?</h1><p class="section-description">Note what you want to work on next, who could advise you and when you will review your progress.</p><div class="prompt-block">${field({id:'development-support',label:'What support would help you develop your teaching?',value:d.development.support,path:'development.support',placeholder:'Describe the guidance, resources or other support you would value…'})}</div><div class="prompt-block">${field({id:'development-next',label:'What would you like to work on next?',value:d.development.next,path:'development.next',placeholder:'Choose something you would like to explore or develop…'})}</div><div class="prompt-block">${field({id:'development-consultation',label:'Who could you seek guidance from, and what would you ask?',value:d.development.consultation,path:'development.consultation',placeholder:'Describe the kind of guidance you would seek…',help:'A role or service is enough; you do not need to name a person.'})}</div><div class="prompt-block">${field({id:'development-progress',label:'How will you review your progress, and when?',value:d.development.progress,path:'development.progress',placeholder:'Describe a sign of progress and a time to revisit your reflection…',help:'For example, revisiting an activity after feedback or reviewing a course plan before the next teaching period.'})}</div>`;
  }
  const answer = value => filled(value) ? esc(value) : '<span class="unanswered">Not answered</span>';
  function reviewSections(d, readonly = false) {
    const card = (title,step,body) => `<section class="review-section"><div class="review-header"><h2>${title}</h2>${readonly ? '' : `<button data-action="edit" data-step="${step}" aria-label="Edit ${title.toLowerCase()}">Edit</button>`}</div><div class="review-body">${body}</div></section>`;
    const extended = !readonly || d.questionSet >= 2;
    const extra = (title,value) => extended ? `<dt>${title}</dt><dd>${answer(value)}</dd>` : '';
    return card('My courses',0,d.courses.map((c,i)=>`<div class="review-course"><h3>${esc(c.name.trim() || `Course ${i+1}`)}</h3><dl><dt>How knowledges are currently included</dt><dd>${answer(c.inclusion)}</dd><dt>Support needed for this course</dt><dd>${answer(c.support)}</dd>${extra('Opportunities in this course',c.opportunities)}</dl></div>`).join('')) +
      card('My confidence',1,`<dl><dt>Incorporating Aboriginal and Torres Strait Islander knowledges into teaching</dt><dd>${d.confidence ? `${d.confidence} / 5 · ${confidenceLabels[d.confidence-1]}` : answer('')}</dd>${extra('Where I feel most confident',d.confidenceDetails?.strengths)}${extra('Where I would seek guidance',d.confidenceDetails?.guidance)}</dl>`) +
      card('My reflection',2,`<dl><dt>What is working well</dt><dd>${answer(d.reflection.working)}</dd><dt>Difficulties experienced</dt><dd>${answer(d.reflection.difficulties)}</dd>${extra('Feedback from students or colleagues',d.reflection.feedback)}${extra('What I would change',d.reflection.changes)}</dl>`) +
      card('My development',3,`<dl><dt>Support that would help</dt><dd>${answer(d.development.support)}</dd><dt>What I would like to work on next</dt><dd>${answer(d.development.next)}</dd>${extra('Guidance I would seek',d.development.consultation)}${extra('How and when I will review progress',d.development.progress)}</dl>`);
  }
  function reviewForm(d) {
    return `<p class="eyebrow">Review</p><h1>Review your responses.</h1><p class="section-description">Check your answers before finishing. You can still edit any section. Finishing creates a read-only record on this device.</p>${reviewSections(d)}<p class="gentle-note">This is a prototype. Finishing simulates submission; no responses are sent to the education team.</p>`;
  }
  function flow() {
    const d = store.draft;
    if (!d) return home();
    const section = [courseForm,confidenceForm,reflectionForm,developmentForm,reviewForm][d.step](d);
    const backLabel = d.returnToReview ? 'Cancel editing' : d.step === 0 ? 'Overview' : 'Back';
    return `<div class="page-shell fade-in"><div class="page-topline"><button class="back-link" data-action="home">${icon('back')} Overview</button><span class="save-status" id="save-status" role="status" aria-live="polite">${icon(storageAvailable ? 'check' : 'info')}<span>${storageAvailable ? 'Saved on this device' : 'Browser storage unavailable'}</span></span></div><div class="flow-layout">${steps(d)}<section class="flow-content">${section}<div class="flow-actions"><button class="back-link" data-action="back">${icon('back')} ${d.returnToReview ? 'Back to review' : backLabel}</button><div class="action-right"><button class="subtle-button" data-action="pause">Save and pause</button><button class="btn" data-action="${d.returnToReview ? 'return-review' : d.step === 4 ? 'finish' : 'next'}">${d.returnToReview ? 'Return to review' : d.step === 4 ? 'Finish reflection' : d.step === 3 ? 'Review responses' : 'Continue'} ${icon(d.step === 4 && !d.returnToReview ? 'check' : 'arrow')}</button></div></div></section></div></div>`;
  }
  function records() {
    const draft = store.draft;
    return `<div class="page-shell fade-in"><div class="page-title-row"><div><p class="eyebrow">Saved on this device</p><h1>My records.</h1><p>Return to a draft or revisit a completed reflection.</p></div><button class="btn" data-action="start">New reflection ${icon('plus')}</button></div><div class="records-stack">${draft ? `<article class="record-row"><div class="record-icon">${icon('document')}</div><div class="record-info"><h2>Your current reflection <span class="badge blue">Draft</span></h2><p>${esc(labels[draft.step])} · ${draft.courses.length} ${draft.courses.length === 1 ? 'course' : 'courses'} · Saved ${date(draft.updatedAt)} at ${time(draft.updatedAt)}</p></div><button class="text-btn" data-action="resume">Resume ${icon('chevron')}</button></article>` : ''}${store.records.map(r=>`<article class="record-row"><div class="record-icon">${icon('document')}</div><div class="record-info"><h2>${date(r.finishedAt)} <span class="badge">Read-only</span></h2><p>${esc(r.courses.map((c,i)=>c.name.trim() || `Course ${i+1}`).join(' · '))}</p></div><button class="text-btn" data-action="record" data-id="${esc(r.id)}">View reflection ${icon('chevron')}</button></article>`).join('')}${!store.records.length && !draft ? `<div class="empty-state">${icon('document')}<h2>No reflections yet.</h2><p>A completed reflection will appear here.</p><button class="btn" data-action="start">Start a reflection ${icon('arrow')}</button></div>` : !store.records.length ? `<p class="gentle-note">No completed reflections yet. Your draft will become a read-only record when you finish it.</p>` : ''}</div><p class="gentle-note">Records are stored in this browser only. Clearing browser data will remove them. You can print a completed record or save it as a PDF.</p></div>`;
  }
  function record() {
    const r = store.records.find(item=>item.id === view.recordId);
    if (!r) return records();
    return `<div class="page-shell fade-in"><div class="record-content"><div class="page-topline"><button class="back-link" data-action="records">${icon('back')} My records</button><span class="badge">Read-only record</span></div><div class="record-top"><p class="eyebrow">Your completed reflection</p><h1>${date(r.finishedAt)}</h1><p>Finished at ${time(r.finishedAt)} · ${r.courses.length} ${r.courses.length === 1 ? 'course' : 'courses'} · Saved on this device</p></div>${reviewSections(r,true)}<div class="record-bottom"><button class="btn secondary" data-action="print">${icon('download')} Print / Save PDF</button><button class="text-btn" data-action="start">Start another reflection ${icon('arrow')}</button></div></div></div>`;
  }
  const sourceData = [
    {name:'A',periods:[{theme:'Guidance',quote:'I would value help identifying a first step.'},{theme:'Guidance',quote:'I would like guidance on reviewing the structure of my course.'}]},
    {name:'B',periods:[{theme:'Resources',quote:'I would like help locating suitable resources.'},{theme:'Guidance',quote:'I would value advice on adapting the approach to my discipline.'}]},
    {name:'C',periods:[{theme:'Resources',quote:'I need support identifying relevant materials.'},{theme:'Resources',quote:'I would value support finding appropriate teaching materials.'}]}
  ];
  function education() {
    const period = view.period;
    const count = (theme,p) => sourceData.filter(s=>s.periods[p-1].theme === theme).length;
    return `<div class="page-shell fade-in"><div class="page-title-row"><div><p class="eyebrow">Education-team view</p><h1>See where support can help.</h1><p>A shared view of the needs people have expressed.</p></div></div><div class="education-banner">Fictional example data · Three example respondents, shown across two periods. This preview is separate from your saved reflections and does not implement staff access permissions.</div><div class="insights-toolbar"><h2>Reported support needs.</h2><div class="segmented" role="group" aria-label="Choose reporting period">${[1,2].map(p=>`<button data-action="period" data-period="${p}" aria-pressed="${p === period}">Period ${p}</button>`).join('')}</div></div><div class="insight-grid">${['Guidance','Resources'].map(theme=>`<article class="insight-card"><div class="insight-name">${theme}</div><div class="big-number">${count(theme,period)}<span>of 3</span></div><div class="bar-track" role="img" aria-label="${count(theme,period)} of 3 respondents reported ${theme.toLowerCase()} needs"><div class="bar-fill" style="width:${count(theme,period)/3*100}%"></div></div><p>${theme === 'Guidance' ? 'Discuss the guidance people have asked for.' : 'Review requests for resource support.'}</p></article>`).join('')}</div><div class="insight-context"><p>These counts describe requested support, not teaching performance. The same three respondents appear in both periods; their responses have been grouped manually.</p><a class="text-btn" href="#source-responses">View source responses ${icon('chevron')}</a></div><table class="comparison-table"><caption class="eyebrow" style="text-align:left;padding:18px 0">Changes between two periods</caption><thead><tr><th scope="col">Support need</th><th scope="col">Period 1</th><th scope="col">Period 2</th></tr></thead><tbody>${['Guidance','Resources'].map(t=>`<tr><th scope="row" style="text-align:left;font-weight:400;padding:19px 20px;border-bottom:1px solid var(--line)">${t}</th><td>${count(t,1)} of 3</td><td>${count(t,2)} of 3</td></tr>`).join('')}</tbody></table><h2 class="sources-heading" id="source-responses">The responses behind the numbers.</h2><div class="sources-grid">${sourceData.map(s=>`<article class="source-card"><h3>Example response ${s.name}</h3>${s.periods.map((p,i)=>`<strong>PERIOD ${i+1} · ${p.theme.toUpperCase()}</strong><p>“${p.quote}”</p>`).join('')}</article>`).join('')}</div><div class="record-bottom"><button class="back-link" data-action="home">${icon('back')} Close education-team view</button></div></div>`;
  }
  function render() {
    const templates = {home, flow, records, record, education};
    main.innerHTML = (templates[view.page] || home)();
    document.querySelectorAll('.nav-link').forEach(b => {
      const active = b.dataset.action === view.page || b.dataset.action === 'records' && view.page === 'record';
      b.classList.toggle('active',active);
      if (active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    document.title = `${view.page === 'flow' ? labels[store.draft?.step || 0] : view.page === 'records' ? 'My records' : view.page === 'education' ? 'Support insights' : view.page === 'record' ? 'Reflection record' : 'Reflection'} — Tapa`;
    if (!storageAvailable) storageWarning();
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if (!store.draft || !input.matches('[data-field]')) return;
    const key = input.dataset.field;
    if (input.dataset.course) {
      const course = store.draft.courses.find(c=>c.id === input.dataset.course);
      if (course && ['name','inclusion','support','opportunities'].includes(key)) course[key] = input.value;
    } else {
      const [group, fieldName] = key.split('.');
      if (detailFields[group]?.includes(fieldName)) store.draft[group][fieldName] = input.value;
    }
    store.draft.focus = input.id; rememberPosition(); touch();
  });
  document.addEventListener('change', event => {
    if (event.target.name === 'confidence' && store.draft) {
      store.draft.confidence = Number(event.target.value);
      store.draft.focus = event.target.id; touch();
    }
  });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    event.preventDefault();
    const action = target.dataset.action;
    const d = store.draft;
    if (action === 'home') navigate('home');
    else if (action === 'records') navigate('records');
    else if (action === 'education') navigate('education');
    else if (action === 'start') startNew();
    else if (action === 'resume') resumeDraft();
    else if (action === 'step') goStep(Number(target.dataset.step), Boolean(d?.returnToReview) && Number(target.dataset.step) !== 4);
    else if (action === 'edit') goStep(Number(target.dataset.step),true);
    else if (action === 'return-review') goStep(4);
    else if (action === 'next' && d) goStep(Math.min(4,d.step+1));
    else if (action === 'back' && d) { if (d.returnToReview) goStep(4); else if (d.step > 0) goStep(d.step-1); else navigate('home'); }
    else if (action === 'pause' && d) { rememberPosition(); const saved = persist(); navigate('home'); showToast(saved ? 'Draft saved. Come back when you are ready.' : 'Draft kept for this visit only. Browser storage is unavailable.'); }
    else if (action === 'add-course' && d) {
      const course = blankCourse(); d.courses.push(course); touch(); persist(); render();
      document.getElementById(`course-${course.id}`).scrollIntoView({behavior:'smooth',block:'center'});
      document.getElementById(`name-${course.id}`).focus({preventScroll:true});
    }
    else if (action === 'remove-course' && d && d.courses.length > 1) {
      const id = target.dataset.id;
      openDialog('Remove this course?', 'The answers for this course will be removed from your draft. Your other courses and reflection answers will stay.', [{label:'Keep course',action:'cancel',className:'secondary'},{label:'Remove course',action:'confirm',className:'danger'}],()=>{d.courses = d.courses.filter(c=>c.id !== id);touch();persist();render();main.focus({preventScroll:true});});
    }
    else if (action === 'finish' && d) {
      const incomplete = labels.slice(0,4).filter((_,i)=>!sectionComplete(d,i)).length;
      openDialog('Finish this reflection?', `${incomplete ? 'Some questions are unanswered. You can go back to complete them, or finish as it is. ' : ''}This creates a read-only record on this device. Submission is simulated; no responses are sent.`, [{label:'Keep reviewing',action:'cancel',className:'secondary'},{label:'Finish reflection',action:'confirm'}],()=>{
        const recordData = JSON.parse(JSON.stringify(store.draft));
        recordData.finishedAt = new Date().toISOString();
        delete recordData.step; delete recordData.scroll; delete recordData.focus; delete recordData.returnToReview;
        store.records.unshift(recordData); store.draft = null;
        const saved = persist(); navigate('record',{recordId:recordData.id});
        showToast(saved ? 'Reflection completed and saved on this device.' : 'Reflection completed for this visit. Print a copy before closing.');
      });
    }
    else if (action === 'record') navigate('record',{recordId:target.dataset.id});
    else if (action === 'print') window.print();
    else if (action === 'period') {const scroll = window.scrollY; view.period = Number(target.dataset.period);render();window.scrollTo({top:scroll,behavior:'instant'});document.querySelector(`[data-period="${view.period}"]`)?.focus({preventScroll:true});}
    else if (action === 'about') openDialog('A space to try the experience.', 'This prototype explores staff curriculum reflection. Its questions and proposed access arrangements require client confirmation. Answers stay in this browser, are not encrypted by this app, and are not sent to anyone. Use fictional responses for testing. The education-team view uses separate fictional examples.', [{label:'Got it',action:'cancel'}]);
    else if (action === 'dialog-cancel') closeDialog();
    else if (action === 'dialog-confirm') { const callback = dialogCallback; closeDialog(); dialogCallback = null; callback?.(); }
    else if (action === 'dialog-resume-draft') { closeDialog(); resumeDraft(); }
  });
  window.addEventListener('popstate',()=>{
    rememberPosition(); persist(); readRoute(); render();
    const anchor = location.hash === '#source-responses' ? 'source-responses' : location.hash === '#how-it-works' ? 'how-it-works' : null;
    if (anchor) document.getElementById(anchor)?.scrollIntoView(); else window.scrollTo({top:0,behavior:'instant'});
    main.focus({preventScroll:true});
  });
  window.addEventListener('pagehide',()=>{rememberPosition();persist();});
  readRoute();
  render();
})();
