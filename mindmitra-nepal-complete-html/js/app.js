(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  let role = 'client', mode = 'signin', userName = 'Demo User', anonymousMode = false;
  let currentUser = null, currentProfile = null;

  const labels = { client: 'Student / Employee', counsellor: 'Counsellor', organization_admin: 'Organization Admin' };
  const nav = {
    client: [['dashboard', '🏠', 'Dashboard'], ['assessment', '🧠', 'Assessment'], ['reports', '✨', 'AI Reports'], ['privacy', '🕶️', 'Identity & Privacy'], ['counsellors', '🩺', 'Counsellors'], ['appointments', '📅', 'Appointments'], ['resources', '📚', 'Resources'], ['crisis', '🆘', 'Crisis Support']],
    counsellor: [['dashboard', '🏠', 'Dashboard'], ['profile', '👤', 'Professional Profile'], ['availability', '🗓️', 'Availability'], ['appointments', '📅', 'Appointment Requests'], ['follow-ups', '✉️', 'Client Follow-ups'], ['clients', '📄', 'Client Reports'], ['notes', '📝', 'Counsellor Notes'], ['published-reports', '📤', 'Published Reports']],
    organization_admin: [['dashboard', '🏠', 'Dashboard'], ['members', '👥', 'Students / Employees'], ['create-user', '➕', 'Create User'], ['bulk', '📥', 'Bulk Import'], ['groups', '🏷️', 'Departments'], ['analytics', '📊', 'Anonymous Reports'], ['published-reports', '📥', 'Published Counsellor Reports'], ['counsellors', '🩺', 'Counsellors'], ['billing', '💳', 'Subscription'], ['org-settings', '⚙️', 'Organization Settings']]
  };

  const api = window.mindMitraApi;
  const configured = Boolean(api);

  function toast(message, type = 'info') { const t = document.createElement('div'); t.className = `toast-item ${type}`; t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</span><p>${message}</p>`; $('#toast').append(t); requestAnimationFrame(() => t.classList.add('show')); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 220) }, 3200) }
  function setLoading(v) { $('#auth-submit').disabled = v; $('#auth-loading').classList.toggle('hidden', !v) }
  function showError(m) { $('#auth-error').textContent = m; $('#auth-error').classList.remove('hidden') }
  function clearAuthError() { $('#auth-error').classList.add('hidden'); $('#auth-error').textContent = '' }
  function getCurrentPosition() { return new Promise((resolve, reject) => { if (!navigator.geolocation) return reject(new Error('Location is not supported by this browser.')); navigator.geolocation.getCurrentPosition(resolve, err => reject(new Error(err.code === 1 ? 'Location permission was denied.' : 'Unable to get your location.')), { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }) }) }
  function distanceKm(a, b, c, d) { const R = 6371, r = x => x * Math.PI / 180; const p = r(c - a), q = r(d - b); const x = Math.sin(p / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(q / 2) ** 2; return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) }
  function formatDistance(v) { return v < 1 ? `${Math.round(v * 1000)} m away` : `${v.toFixed(1)} km away` }

  const demoCounsellors = [
    { user_id: 'd1', full_name: 'Dr. Sunita Sharma', professional_title: 'Clinical Psychologist', specialities: ['Anxiety', 'Academic Stress'], languages: ['English', 'Nepali'], address_line: 'Maharajgunj Wellness Centre', city: 'Kathmandu', district: 'Kathmandu', province: 'Bagmati', latitude: 27.7354, longitude: 85.3294 },
    { user_id: 'd2', full_name: 'Bikash Thapa', professional_title: 'Counselling Psychologist', specialities: ['Stress', 'Workplace Wellness'], languages: ['Nepali', 'English'], address_line: 'Lakeside Counselling Hub', city: 'Pokhara', district: 'Kaski', province: 'Gandaki', latitude: 28.2096, longitude: 83.9856 },
    { user_id: 'd3', full_name: 'Maya Gurung', professional_title: 'Mental Wellness Counsellor', specialities: ['Young Adults', 'Family Support'], languages: ['Nepali'], address_line: 'Suryabinayak Care Centre', city: 'Bhaktapur', district: 'Bhaktapur', province: 'Bagmati', latitude: 27.671, longitude: 85.4298 }
  ];

  const ASSESSMENT_QUESTIONS = [
    { domain: "Mood", text: "Little interest or pleasure in activities you usually enjoy.", reverse: false },
    { domain: "Mood", text: "Feeling down, low, or hopeless.", reverse: false },
    { domain: "Mood", text: "Feeling like you have let yourself or others down.", reverse: false },
    { domain: "Mood", text: "Trouble concentrating on ordinary tasks.", reverse: false },
    { domain: "Mood", text: "Feeling noticeably slower or more restless than usual.", reverse: false },

    { domain: "Anxiety", text: "Feeling nervous, on edge, or unable to relax.", reverse: false },
    { domain: "Anxiety", text: "Finding it difficult to stop or control worrying.", reverse: false },
    { domain: "Anxiety", text: "Worrying about many different things at once.", reverse: false },
    { domain: "Anxiety", text: "Sudden episodes of intense fear with physical discomfort.", reverse: false },
    { domain: "Anxiety", text: "Avoiding places, people, or situations because they trigger fear or worry.", reverse: false },

    { domain: "Sleep", text: "Trouble falling asleep or staying asleep.", reverse: false },
    { domain: "Sleep", text: "Sleeping much more than usual.", reverse: false },
    { domain: "Sleep", text: "Waking up feeling unrested even after enough time in bed.", reverse: false },
    { domain: "Sleep", text: "Having sleep and wake times that change a lot from day to day.", reverse: false },

    { domain: "Appetite & Food", text: "A noticeable increase or decrease in appetite.", reverse: false },
    { domain: "Appetite & Food", text: "Eating in a way that feels difficult to control.", reverse: false },
    { domain: "Appetite & Food", text: "Skipping meals or feeling strong guilt or anxiety after eating.", reverse: false },
    { domain: "Appetite & Food", text: "Spending a lot of mental energy on food, weight, or body shape.", reverse: false },

    { domain: "Energy & Motivation", text: "Feeling tired or low on energy.", reverse: false },
    { domain: "Energy & Motivation", text: "Finding it difficult to get started on necessary tasks.", reverse: false },

    { domain: "Attention & Impulsivity", text: "Trouble focusing, finishing tasks, or keeping track of what you are doing.", reverse: false },
    { domain: "Attention & Impulsivity", text: "Acting impulsively in ways you later regret.", reverse: false },
    { domain: "Attention & Impulsivity", text: "Feeling restless inside even while sitting still.", reverse: false },

    { domain: "Trauma", text: "Memories, dreams, or reminders of a deeply distressing event interfere with daily life.", reverse: false },
    { domain: "Unusual Experiences", text: "Noticing unusual sensory experiences that others around you do not seem to notice.", reverse: false },
    { domain: "Unusual Experiences", text: "Feeling watched, targeted, or unsafe without clear evidence.", reverse: false },

    { domain: "Substance Use", text: "Alcohol or substance use has increased recently or feels difficult to reduce.", reverse: false },
    { domain: "Substance Use", text: "Someone close to you has expressed concern about your use.", reverse: false },

    { domain: "Functioning", text: "Difficulty keeping up with work, school, or household responsibilities.", reverse: false },
    { domain: "Functioning", text: "Withdrawing from friends, family, or activities you used to care about.", reverse: false },

    { domain: "Mood Elevation", text: "Periods of needing much less sleep than usual without feeling tired.", reverse: false },
    { domain: "Mood Elevation", text: "Periods of unusually high energy, confidence, or racing thoughts noticed by others.", reverse: false },

    { domain: "Protective Factors", text: "I feel hopeful about my future.", reverse: true },
    { domain: "Protective Factors", text: "I feel emotionally supported by family, friends, or trusted people.", reverse: true },
    { domain: "Protective Factors", text: "Overall, I feel able to manage my daily responsibilities.", reverse: true }
  ];

  const ASSESSMENT_OPTIONS = [
    { label: "Not at all", value: 0 },
    { label: "Several days", value: 1 },
    { label: "More than half the days", value: 2 },
    { label: "Nearly every day", value: 3 }
  ];

  let assessmentState = {
    step: 1,
    questionIndex: 0,
    answers: Array(ASSESSMENT_QUESTIONS.length).fill(null),
    lifestyle: {
      sleep_hours: "",
      exercise_frequency: "",
      screen_time: "",
      caffeine_intake: "",
      alcohol_smoking: ""
    },
    result: null
  };

  function resetAssessment() {
    assessmentState = {
      step: 1,
      questionIndex: 0,
      answers: Array(ASSESSMENT_QUESTIONS.length).fill(null),
      lifestyle: {
        sleep_hours: "",
        exercise_frequency: "",
        screen_time: "",
        caffeine_intake: "",
        alcohol_smoking: ""
      },
      result: null
    };
  }

  function calculateAssessmentResult() {
    const score = assessmentState.answers.reduce((total, answer, index) => {
      const value = Number(answer ?? 0);
      return total + (ASSESSMENT_QUESTIONS[index].reverse ? 3 - value : value);
    }, 0);

    let level, colorClass, message;
    if (score <= 20) {
      level = "Healthy";
      colorClass = "result-healthy";
      message = "Your answers suggest that you are generally managing well at the moment.";
    } else if (score <= 40) {
      level = "Mild Stress";
      colorClass = "result-mild";
      message = "Your answers suggest some mild stress that may benefit from regular self-care and check-ins.";
    } else if (score <= 65) {
      level = "Moderate Concern";
      colorClass = "result-moderate";
      message = "Your answers suggest ongoing concerns. Speaking with a counsellor may be helpful.";
    } else {
      level = "High Concern";
      colorClass = "result-high";
      message = "Your answers suggest a higher level of concern. Please consider connecting with a verified counsellor soon.";
    }

    const suggestions = [];
    const lifestyle = assessmentState.lifestyle;
    if (Number(lifestyle.sleep_hours) < 7) suggestions.push("Try a consistent sleep routine and reduce screen use before bedtime.");
    if (["Never", "Rarely"].includes(lifestyle.exercise_frequency)) suggestions.push("Add short walks or gentle movement several times each week.");
    if (["6–8 hours", "More than 8 hours"].includes(lifestyle.screen_time)) suggestions.push("Take regular screen breaks and create device-free time.");
    if (["High", "Very High"].includes(lifestyle.caffeine_intake)) suggestions.push("Consider reducing caffeine, especially later in the day.");
    suggestions.push("Practice a short breathing or meditation exercise when stress rises.");
    suggestions.push("Use simple stress-management techniques such as journaling, planning and talking with someone you trust.");
    suggestions.push("Explore MindMitra articles and videos selected for your result.");
    if (score >= 41) suggestions.push("Consider requesting an appointment with a counsellor or psychologist.");

    const domainScores = {};
    ASSESSMENT_QUESTIONS.forEach((question, index) => {
      const raw = Number(assessmentState.answers[index] ?? 0);
      const scored = question.reverse ? 3 - raw : raw;
      domainScores[question.domain] = (domainScores[question.domain] || 0) + scored;
    });
    const topDomains = Object.entries(domainScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([domain, domainScore]) => ({ domain, score: domainScore }));

    assessmentState.result = { score, level, colorClass, message, suggestions, domainScores, topDomains };
    return assessmentState.result;
  }
  async function saveAssessmentResult() {
    if (!api || !currentUser || !assessmentState.result) return;
    const answers = ASSESSMENT_QUESTIONS.map((question, index) => ({
        domain: question.domain,
        question: question.text,
        value: assessmentState.answers[index],
        reverse_scored: Boolean(question.reverse)
    }));
    const result = await api.post('/assessments', {
      answers,
      lifestyle: assessmentState.lifestyle,
      total_score: assessmentState.result.score,
      result_level: assessmentState.result.level,
      message: assessmentState.result.message,
      suggestions: assessmentState.result.suggestions
    });

    assessmentState.result = {
      ...assessmentState.result,
      aiSummary: result.report?.user_summary || null,
      aiRiskLevel: result.report?.risk_level || null,
      aiReportId: result.report?.id || null
    };
  }

  function assessmentIntroMarkup() {
    return `
    <div class="assessment-shell">
      <div class="assessment-stepper">
        <span class="active">1</span><i></i><span>2</span><i></i><span>3</span><i></i><span>4</span><i></i><span>5</span>
      </div>
      <div class="assessment-welcome">
        <div class="assessment-icon">🧠</div>
        <h2>Mental Wellness Assessment</h2>
        <p>This screening covers mood, anxiety, sleep, appetite, energy, attention, functioning and other wellbeing areas. It usually takes 8–12 minutes. It is a wellness screening, not a medical diagnosis.</p>
        <div class="assessment-notice">
          <b>Your privacy matters</b>
          <span>Your answers remain private and are shared with a counsellor only according to your consent settings.</span>
        </div>
        <button id="assessment-start" class="btn-gold">Begin assessment</button>
      </div>
    </div>
  `;
  }

  function assessmentQuestionMarkup() {
    const index = assessmentState.questionIndex;
    const question = ASSESSMENT_QUESTIONS[index];
    const progress = Math.round(((index + 1) / ASSESSMENT_QUESTIONS.length) * 100);
    return `
    <div class="assessment-shell">
      <div class="assessment-stepper">
        <span class="done">✓</span><i class="done"></i><span>2</span><i></i><span class="active">3</span><i></i><span>4</span><i></i><span>5</span>
      </div>
      <div class="assessment-topline">
        <span>${question.domain} · Question ${index + 1} of ${ASSESSMENT_QUESTIONS.length}</span>
        <b>${progress}% complete</b>
      </div>
      <div class="assessment-progress"><span style="width:${progress}%"></span></div>
      <div class="assessment-question-card">
        <p class="question-number">${question.domain}</p>
        <h2>${question.text}</h2>
        ${question.reverse ? '<span class="positive-question">Positive wellbeing question</span>' : ''}
        <div class="assessment-scale">
          ${ASSESSMENT_OPTIONS.map(option => `
            <button class="assessment-scale-option ${assessmentState.answers[index] === option.value ? 'selected' : ''}" data-assessment-value="${option.value}">
              <span>${option.value}</span>
              <b>${option.label}</b>
            </button>
          `).join("")}
        </div>
        <div class="assessment-nav-row">
          <button id="assessment-prev" class="btn-outline" ${index === 0 ? "disabled" : ""}>Previous</button>
          <button id="assessment-next" class="btn-gold" ${assessmentState.answers[index] === null ? "disabled" : ""}>
            ${index === ASSESSMENT_QUESTIONS.length - 1 ? "Continue to lifestyle" : "Next question"}
          </button>
        </div>
      </div>
    </div>
  `;
  }

  function lifestyleMarkup() {
    return `
    <div class="assessment-shell">
      <div class="assessment-stepper">
        <span class="done">✓</span><i class="done"></i><span class="done">✓</span><i class="done"></i><span class="done">✓</span><i class="done"></i><span class="active">4</span><i></i><span>5</span>
      </div>
      <div class="assessment-question-card">
        <p class="question-number">Step 4</p>
        <h2>Your lifestyle</h2>
        <p class="assessment-helper">These details help personalize your wellness suggestions. Alcohol and smoking information is optional.</p>
        <div class="lifestyle-grid">
          <label>Average sleep hours
            <input id="lifestyle-sleep" type="number" min="0" max="16" step="0.5" class="form-input" value="${assessmentState.lifestyle.sleep_hours}" placeholder="e.g. 7">
          </label>
          <label>Exercise frequency
            <select id="lifestyle-exercise" class="form-input">
              <option value="">Select</option>
              ${["Never", "Rarely", "1–2 times/week", "3–4 times/week", "5+ times/week"].map(v => `<option ${assessmentState.lifestyle.exercise_frequency === v ? 'selected' : ''}>${v}</option>`).join("")}
            </select>
          </label>
          <label>Daily screen time
            <select id="lifestyle-screen" class="form-input">
              <option value="">Select</option>
              ${["Less than 2 hours", "2–4 hours", "4–6 hours", "6–8 hours", "More than 8 hours"].map(v => `<option ${assessmentState.lifestyle.screen_time === v ? 'selected' : ''}>${v}</option>`).join("")}
            </select>
          </label>
          <label>Caffeine intake
            <select id="lifestyle-caffeine" class="form-input">
              <option value="">Select</option>
              ${["None", "Low", "Moderate", "High", "Very High"].map(v => `<option ${assessmentState.lifestyle.caffeine_intake === v ? 'selected' : ''}>${v}</option>`).join("")}
            </select>
          </label>
          <label class="lifestyle-full">Alcohol / Smoking <span>(Optional)</span>
            <select id="lifestyle-substances" class="form-input">
              <option value="">Prefer not to answer</option>
              ${["None", "Occasionally", "Regularly"].map(v => `<option ${assessmentState.lifestyle.alcohol_smoking === v ? 'selected' : ''}>${v}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="assessment-nav-row">
          <button id="lifestyle-back" class="btn-outline">Back</button>
          <button id="lifestyle-finish" class="btn-gold">View my result</button>
        </div>
      </div>
    </div>
  `;
  }

  function resultMarkup() {
    const result = assessmentState.result || calculateAssessmentResult();
    return `
    <div class="assessment-shell">
      <div class="assessment-stepper">
        <span class="done">✓</span><i class="done"></i><span class="done">✓</span><i class="done"></i><span class="done">✓</span><i class="done"></i><span class="done">✓</span><i class="done"></i><span class="active">5</span>
      </div>
      <div class="assessment-result-card ${result.colorClass}">
        <div class="result-icon">${result.level === "Healthy" ? "🟢" : result.level === "Mild Stress" ? "🟡" : result.level === "Moderate Concern" ? "🟠" : "🔴"}</div>
        <p class="question-number">Your result</p>
        <h2>${result.level}</h2>
        <p>${result.message}</p>
        <div class="result-score"><span>Wellness concern score</span><b>${result.score} / 105</b></div>
        <div class="domain-summary">
          <h3>Areas to explore further</h3>
          ${result.topDomains.map(item => `<span>${item.domain}</span>`).join("")}
        </div>
        <p class="result-disclaimer">This result is a wellness screening and is not a medical diagnosis.</p>
      </div>
      ${result.aiSummary
        ? `
      <section class="suggestion-card ai-summary-card">
        <p class="question-number">AI wellness summary</p>

        <h3 class="text-xl font-bold">
          Your personalized summary
        </h3>

        <p class="mt-3 text-gray-600">
          ${result.aiSummary.summary ||
        result.aiSummary.message ||
        "Your assessment has been analyzed."
        }
        </p>

        ${Array.isArray(result.aiSummary.main_concerns) &&
          result.aiSummary.main_concerns.length
          ? `
              <h4 class="font-bold mt-5">
                Main areas to review
              </h4>

              <div class="domain-summary mt-2">
                ${result.aiSummary.main_concerns
            .map(concern => `<span>${concern}</span>`)
            .join("")}
              </div>
            `
          : ""
        }

        ${Array.isArray(result.aiSummary.suggestions) &&
          result.aiSummary.suggestions.length
          ? `
              <h4 class="font-bold mt-5">
                AI suggestions
              </h4>

              <div class="suggestion-grid mt-3">
                ${result.aiSummary.suggestions
            .map(
              suggestion => `
                      <article>
                        <span>🌿</span>
                        <p>${suggestion}</p>
                      </article>
                    `
            )
            .join("")}
              </div>
            `
          : ""
        }
      </section>
    `
        : ""
      }
      <div class="suggestion-card">
        <h3>Personalized suggestions</h3>
        <div class="suggestion-grid">
          ${result.suggestions.map((suggestion, index) => `
            <article><span>${["🧘", "🌬️", "🌙", "🌿", "📚", "🩺"][index % 6]}</span><p>${suggestion}</p></article>
          `).join("")}
        </div>
        <div class="assessment-nav-row">
          <button id="assessment-restart" class="btn-outline">Retake assessment</button>
          ${result.score >= 41 ? '<button id="assessment-counsellor" class="btn-gold">Find a counsellor</button>' : '<button id="assessment-dashboard" class="btn-gold">Back to dashboard</button>'}
        </div>
      </div>
    </div>
  `;
  }

  function assessmentMarkup() {
    if (assessmentState.step === 1) return assessmentIntroMarkup();
    if (assessmentState.step === 3) return assessmentQuestionMarkup();
    if (assessmentState.step === 4) return lifestyleMarkup();
    return resultMarkup();
  }



  function card(c, showDistance = false) { const dist = showDistance && Number.isFinite(c.distance_km) ? `<div class="distance-pill">📍 ${formatDistance(c.distance_km)}</div>` : ''; const whatsapp = c.whatsapp_link ? `<a class="action mt-3 inline-block" href="${c.whatsapp_link}" target="_blank" rel="noopener">WhatsApp counsellor</a>` : ''; const book = role === 'client' && currentUser ? `<button class="action mt-3 ml-2 book-counsellor" data-counsellor="${c.user_id}">Book counsellor</button>` : ''; return `<article class="public-counsellor-card"><div class="counsellor-avatar">${(c.full_name || 'C').charAt(0)}</div><div class="flex-1"><div class="flex items-start justify-between gap-3"><div><h3>${c.full_name || 'Verified Counsellor'}</h3><p class="credential">${c.professional_title || 'Counsellor'}</p></div><span class="verified-badge">✓ Verified</span></div><p class="speciality-line">${(c.specialities || []).join(' · ') || 'General wellness support'}</p><p class="address-line">📌 ${[c.address_line, c.city, c.district, c.province].filter(Boolean).join(', ')}</p><p class="language-line">Languages: ${(c.languages || []).join(', ') || 'Not specified'}</p>${dist}${whatsapp}${book}</div></article>` }

  async function fetchCounsellors() { if (!api) return demoCounsellors; return (await api.get('/counsellors')).counsellors || [] }
  async function fetchNearby(lat, lng, radius = 250) { if (!api) return demoCounsellors.map(c => ({ ...c, distance_km: distanceKm(lat, lng, c.latitude, c.longitude) })).filter(c => c.distance_km <= radius).sort((a, b) => a.distance_km - b.distance_km); return (await api.get(`/counsellors?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${encodeURIComponent(radius)}`)).counsellors || [] }
  async function renderPublic(list = null, withDistance = false) { const grid = $('#public-counsellor-grid'); if (!grid) return; try { const items = list || await fetchCounsellors(); grid.innerHTML = items.length ? items.map(c => card(c, withDistance)).join('') : '<div class="empty-state col-span-full"><div>🩺</div><h3>No counsellors found</h3><p>Try again later.</p></div>' } catch (e) { grid.innerHTML = `<div class="empty-state col-span-full"><div>!</div><h3>Unable to load counsellors</h3><p>${e.message}</p></div>` } }

  $('#public-find-nearby').onclick = async () => { const b = $('#public-find-nearby'), txt = b.textContent; b.disabled = true; b.innerHTML = '<span class="spinner dark"></span> Finding counsellors…'; try { const p = await getCurrentPosition(); await renderPublic(await fetchNearby(p.coords.latitude, p.coords.longitude), true); toast('Counsellors sorted by distance.', 'success') } catch (e) { toast(e.message, 'error') } finally { b.disabled = false; b.textContent = txt } };
  renderPublic();

  $$('[data-open-auth]').forEach(b => b.onclick = () => openAuth(b.dataset.openAuth));
  function openAuth(r) { role = r; mode = 'signin'; $('#auth-modal').classList.remove('hidden'); document.body.classList.add('modal-open'); updateAuth(); setTimeout(() => $('#auth-email').focus(), 80) }
  function closeAuth() { $('#auth-modal').classList.add('hidden'); document.body.classList.remove('modal-open'); clearAuthError() }
  $('#close-auth').onclick = closeAuth; $('#auth-modal').onclick = e => { if (e.target === $('#auth-modal')) closeAuth() }; document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuth() });
  $$('[data-auth-role]').forEach(b => b.onclick = () => { role = b.dataset.authRole; mode = 'signin'; updateAuth() });
  $$('[data-auth-mode]').forEach(b => b.onclick = () => { if (role !== 'client') { mode = b.dataset.authMode; updateAuth() } });
  $('#anonymous-toggle').onchange = e => $('#anonymous-alias').classList.toggle('hidden', !e.target.checked);
  $('#toggle-auth-password').onclick = () => { const i = $('#auth-password'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('#toggle-auth-password').textContent = show ? 'Hide' : 'Show' };

  const capture = $('#capture-counsellor-location');
  if (capture) capture.onclick = async () => { const txt = capture.textContent; capture.disabled = true; capture.innerHTML = '<span class="spinner dark"></span> Getting location…'; try { const p = await getCurrentPosition(); $('#counsellor-latitude').value = p.coords.latitude; $('#counsellor-longitude').value = p.coords.longitude; capture.textContent = 'Location added ✓'; toast('Location added.', 'success') } catch (e) { capture.textContent = txt; toast(e.message, 'error') } finally { capture.disabled = false } };

  function updateAuth() { $$('[data-auth-role]').forEach(b => b.classList.toggle('active', b.dataset.authRole === role)); $$('[data-auth-mode]').forEach(b => b.classList.toggle('active', b.dataset.authMode === mode)); const restricted = role === 'client'; $('[data-auth-mode="signup"]').classList.toggle('hidden', restricted); $('#restricted-note').classList.toggle('hidden', !restricted); $('#signup-fields').classList.toggle('hidden', mode !== 'signup'); $('#org-type-wrap').classList.toggle('hidden', role !== 'organization_admin'); $('#counsellor-extra').classList.toggle('hidden', !(mode === 'signup' && role === 'counsellor')); $('#first-login-note').classList.toggle('hidden', role !== 'client'); $('#anonymous-choice').classList.toggle('hidden', role !== 'client'); $('#auth-submit').textContent = mode === 'signup' ? 'Create Account' : 'Sign In'; clearAuthError() }

  async function register() {
    const payload = { email: $('#auth-email').value.trim(), password: $('#auth-password').value, full_name: $('#full-name').value.trim(), role };
    if (!payload.full_name) throw new Error('Enter your full name or organization name.');
    if (payload.password.length < 8) throw new Error('Password must have at least 8 characters.');
    if (role === 'organization_admin') payload.organization_type = $('#org-type').value;
    if (role === 'counsellor') {
      Object.assign(payload, { phone: $('#counsellor-phone').value.trim(), licence_number: $('#licence-number').value.trim(), address_line: $('#counsellor-address').value.trim(), city: $('#counsellor-city').value.trim(), province: $('#counsellor-province').value.trim(), latitude: $('#counsellor-latitude').value || null, longitude: $('#counsellor-longitude').value || null });
      if (!payload.phone || !payload.licence_number || !payload.address_line || !payload.city) throw new Error('Counsellors must provide contact, licence and address details.');
    }
    const result = await api.post('/auth/register', payload);
    finishAuthenticatedLogin(result.user);
  }

  function finishAuthenticatedLogin(user, privacy = null) {
    role = user.role;
    currentUser = user;
    currentProfile = user;
    anonymousMode = role === 'client' && privacy ? !privacy.share_identity_with_counsellor : false;
    enterApp(user.full_name || user.email);
    if (user.first_login) toast('Signed in with your temporary password. Update it from account settings.', 'info');
  }

  async function signin() {
    const email = $('#auth-email').value.trim(), password = $('#auth-password').value;
    const result = await api.post('/auth/login', { email, password, role, organization_type: role === 'organization_admin' ? $('#org-type').value : null });
    let privacy = null;
    if (result.user.role === 'client') {
      anonymousMode = $('#anonymous-toggle').checked;
      const alias = $('#anonymous-alias').value.trim() || `Mitra-${result.user.id.slice(0, 6).toUpperCase()}`;
      privacy = { share_identity_with_counsellor: !anonymousMode, anonymous_alias: alias };
      try { await api.put('/privacy', privacy); } catch (error) { console.warn('Signed in, but the privacy preference was not updated:', error.message); }
    }
    finishAuthenticatedLogin(result.user, privacy);
  }

  $('#auth-form').onsubmit = async e => { e.preventDefault(); clearAuthError(); const email = $('#auth-email').value.trim(), password = $('#auth-password').value; if (!email || !password) return showError('Enter your email and password.'); if (!api) return showError('The Neon API client is unavailable.'); setLoading(true); try { mode === 'signup' ? await register() : await signin() } catch (e) { showError(e.message) } finally { setLoading(false) } };
  $('#demo-login').onclick = () => { anonymousMode = $('#anonymous-toggle').checked; enterApp(labels[role] + ' Demo') };

  let restorePromise = null;
  async function restore() {
    if (!api) return;
    if (restorePromise) return restorePromise;
    restorePromise = (async () => {
      try { const result = await api.get('/auth/me'); if (result.user) finishAuthenticatedLogin(result.user, result.privacy); }
      catch (error) { console.warn(error.message); }
      finally { restorePromise = null; }
    })();
    return restorePromise;
  }

  function enterApp(name) { userName = name; closeAuth(); $('#public-site').classList.add('hidden'); $('#role-app').classList.remove('hidden'); $('#sidebar-role').textContent = `${labels[role]} Portal`; $('#user-badge').textContent = (anonymousMode && role === 'client' ? 'A' : name.charAt(0)).toUpperCase(); $('#crisis-shortcut').classList.toggle('hidden', role !== 'client'); renderNav(); go('dashboard'); toast(`Welcome, ${name.split(' ')[0]}.`, 'success') }
  function renderNav() { const n = $('#sidebar-nav'); n.innerHTML = ''; nav[role].forEach(([id, icon, label]) => { const b = document.createElement('button'); b.className = 'sidebar-link'; b.dataset.page = id; b.innerHTML = `<span>${icon}</span>${label}`; b.onclick = () => go(id); n.append(b) }) }
  function go(page) { $$('.sidebar-link').forEach(b => b.classList.toggle('active', b.dataset.page === page)); const item = nav[role].find(x => x[0] === page); $('#page-title').textContent = item ? item[2] : 'Dashboard'; $('#page-subtitle').textContent = `${labels[role]} Portal`; $('#panel-content').innerHTML = render(page); $('#panel-content').classList.remove('page-enter'); requestAnimationFrame(() => $('#panel-content').classList.add('page-enter')); wire(page); $('#sidebar').classList.remove('open'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  $('#logout').onclick = async () => { if (api) await api.post('/auth/logout'); currentUser = null; currentProfile = null; $('#role-app').classList.add('hidden'); $('#public-site').classList.remove('hidden'); toast('Logged out safely.', 'success') };
  $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open'); $('#crisis-shortcut').onclick = () => go('crisis'); $('#panel-contact').onclick = e => { e.preventDefault(); $('#role-app').classList.add('hidden'); $('#public-site').classList.remove('hidden'); location.hash = 'contact' };
  $('#contact-form').onsubmit = async e => { e.preventDefault(); const payload = { name: $('#contact-name').value.trim(), email: $('#contact-email').value.trim(), topic: $('#contact-topic').value, message: $('#contact-message').value.trim() }; try { await api.post('/contact', payload); e.target.reset(); toast('Thank you. Your message has been received.', 'success') } catch (err) { toast(err.message, 'error') } };

  const stats = a => `<div class="dashboard-grid">${a.map(x => `<article class="stat-card animated-card"><small>${x[0]}</small><b>${x[1]}</b><span class="text-xs text-gray-500">${x[2] || ''}</span></article>`).join('')}</div>`;
  const panel = (t, b) => `<section class="panel-card mt-5 animated-card"><h3 class="font-bold">${t}</h3><div class="mt-4">${b}</div></section>`;
  const table = (h, r) => `<div class="table-wrap"><table class="data-table"><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${r.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  async function loadAiReports() { const target = $('#ai-report-list'); if (!target) return; if (!api) { target.innerHTML = '<p class="text-gray-500">Sign in to view your saved assessment reports.</p>'; return; } try { const result = await api.get('/reports'); const reports = result.reports || []; if (!reports.length) { target.innerHTML = '<p class="text-gray-500">Complete an assessment to receive your personalised wellbeing report.</p>'; return; } target.innerHTML = reports.map(report => { const summary = report.user_summary || {}; const concerns = (summary.main_concerns || []).map(item => `<li>${item}</li>`).join('') || '<li>General wellbeing</li>'; const suggestions = (summary.suggestions || []).map(item => `<li>${item}</li>`).join(''); return `<article class="border rounded-xl p-5 mb-4"><div class="flex justify-between gap-3"><div><h3 class="font-bold">Assessment report</h3><p class="text-sm text-gray-500">${new Date(report.created_at).toLocaleString()}</p></div><span class="verified-badge">${report.risk_level}</span></div><p class="mt-3">${summary.summary || summary.message || 'Your assessment report is ready.'}</p><p class="mt-3 text-sm"><b>Score:</b> ${report.total_score} · <b>Result:</b> ${report.result_level || report.risk_level}</p><div class="grid md:grid-cols-2 gap-4 mt-4"><div><b>Main areas to watch</b><ul class="list-disc ml-5 mt-2 text-sm">${concerns}</ul></div><div><b>Suggested next steps</b><ul class="list-disc ml-5 mt-2 text-sm">${suggestions}</ul></div></div><p class="text-xs text-gray-500 mt-4">${summary.disclaimer || 'This report is informational and is not a medical diagnosis.'}</p></article>`; }).join(''); } catch (error) { target.innerHTML = `<p class="text-red-600">${error.message}</p>`; } }

  function render(page) {
    if (page === 'dashboard') {
      if (role === 'client') return stats([['Assessment', '65%'], ['Latest summary', 'Balanced'], ['Appointment', '1'], ['Privacy', anonymousMode ? 'Anonymous' : 'Identified']]) + panel('Next steps', '<div class="next-step-list"><button data-jump="assessment">Continue assessment</button><button data-jump="counsellors">Browse nearby counsellors</button><button data-jump="notifications">Review reminder preferences</button></div>'); if (role === 'counsellor') return stats([['Pending requests', '6'], ['Confirmed today', '3'], ['Authorized reports', '9'], ['Anonymous clients', '4']]) + panel('Recent requests', table(['Client display', 'Concern', 'Appointment', 'Action'], [['Mitra-104', 'Moderate', 'Requested', '<button class="action">Review</button>'], ['Aarav S.', 'General support', 'Confirmed', '<button class="action">Open</button>']])); return `
<div id="org-dashboard-loading" class="panel-card">
Loading organization analytics...
</div>

<div id="org-dashboard-content" class="hidden">

<div class="dashboard-grid">

<article class="stat-card">
<small>Total Students</small>
<b id="org-total-students">0</b>
</article>

<article class="stat-card">
<small>Total Employees</small>
<b id="org-total-employees">0</b>
</article>

<article class="stat-card">
<small>Completed Assessments</small>
<b id="org-total-assessments">0</b>
</article>

<article class="stat-card">
<small>Urgent Cases</small>
<b id="org-urgent-cases">0</b>
</article>

<article class="stat-card">
<small>Upcoming Appointments</small>
<b id="org-upcoming-appointments">0</b>
</article>

<article class="stat-card">
<small>Completed Appointments</small>
<b id="org-completed-appointments">0</b>
</article>

</div>

<div class="analytics-grid mt-5">

<section class="panel-card">
<h3>Risk Distribution</h3>
<div class="chart-wrap">
<canvas id="risk-chart"></canvas>
</div>
</section>

<section class="panel-card">
<h3>Monthly Assessments</h3>
<div class="chart-wrap">
<canvas id="monthly-assessment-chart"></canvas>
</div>
</section>

</div>

</div>

<div id="org-dashboard-error" class="hidden panel-card"></div>
`;
}
      if (page === 'assessment') return assessmentMarkup();
      if (page === 'reports') return panel('Your AI wellbeing reports', '<div id="ai-report-list"><p class="text-gray-500">Loading your assessment reports…</p></div>');
      if (page === 'privacy') return panel('Identity & Privacy', `<div class="privacy-choice"><input id="panel-anonymous" type="checkbox" ${anonymousMode ? 'checked' : ''}><div><b>Show an anonymous alias to counsellors</b><p class="text-sm text-gray-500 mt-1">Counsellors see an alias instead of your real name.</p><input id="panel-alias" class="form-input mt-3" value="${anonymousMode ? 'Mitra-4821' : ''}" placeholder="Optional alias"></div></div><button id="save-privacy" class="action mt-4">Save privacy preference</button>`);
      if (page === 'counsellors') return panel('Verified Counsellors', '<div class="flex flex-wrap gap-3 mb-5"><button id="find-nearby" class="action">📍 Find counsellors near me</button><input id="location-search" class="form-input max-w-sm" placeholder="Search city, district or address"></div><div id="counsellor-list" class="grid md:grid-cols-2 xl:grid-cols-3 gap-4"><article class="public-counsellor-card skeleton-card"><div class="skeleton-line w-1/2"></div><div class="skeleton-line"></div></article></div>');

      if (page === 'create-user') return panel('Create Student or Employee', '<form id="create-org-user-form" class="grid md:grid-cols-2 gap-4"><input id="member-name" class="form-input" placeholder="Full name" required><input id="member-email" type="email" class="form-input" placeholder="Email" required><input id="member-username" class="form-input" placeholder="Temporary username" required><input id="member-password" type="password" class="form-input" placeholder="Temporary password" required><select id="member-type" class="form-input"><option value="student">Student</option><option value="employee">Employee</option></select><input id="member-department" class="form-input" placeholder="Department / Class"><label class="privacy-choice md:col-span-2"><input id="allow-anonymous" type="checkbox" checked><span><b>Allow anonymous counselling choice</b></span></label><button class="action md:col-span-2" type="submit">Create account securely</button></form><p id="create-user-status" class="text-sm mt-3"></p>');
      if (page === 'members') return panel('Students / Employees', table(['Username', 'Type', 'Department', 'Status', 'Action'], [['STU-1004', 'Student', 'BBS 1st Year', 'Active', '<button class="action">Manage</button>'], ['EMP-201', 'Employee', 'Finance', 'Active', '<button class="action">Manage</button>']]));
      if (page === 'crisis') return panel('Emergency Contacts', `
  <div class="crisis-grid">
    <article class="crisis-contact featured">
      <span>National Helpline</span>
      <h3>National Mental Health Helpline</h3>
      <p>Available for counselling and guidance.</p>
      <a href="tel:1166">1166</a>
    </article>
    <article class="crisis-contact">
      <h3>Urgent Support</h3>
      <p>TUTH crisis line for emergency intervention.</p>
      <a href="tel:9840021212">9840021212</a>
    </article>
    <article class="crisis-contact">
      <h3>Nepal Police</h3>
      <p>For immediate safety or physical assistance.</p>
      <a href="tel:100">100</a>
    </article>
    <article class="crisis-contact">
      <h3>National Women's Commission</h3>
      <p>Support for women and domestic safety.</p>
      <a href="tel:1145">1145</a>
    </article>
  </div>
  <p class="helpline-note">These contacts were supplied for this project. Verify each service, availability, and description before production use.</p>
`);

      if (page === 'notes' && role === 'counsellor') return panel('Counsellor Notes', `
  <div class="note-privacy-banner">
    <b>Private notes stay private.</b>
    <p>Use the organization-safe summary below only when the client has provided the required consent. Do not publish confidential clinical details.</p>
  </div>
  <form id="counsellor-note-form" class="space-y-4 mt-4">
    <label class="form-label">Client / Appointment</label>
    <select id="note-appointment" class="form-input">
      <option value="demo-appointment-1">Mitra-104 · Session on 15 March</option>
      <option value="demo-appointment-2">Aarav S. · Session on 18 March</option>
    </select>

    <label class="form-label">Private counsellor note</label>
    <textarea id="private-note" class="form-input min-h-40" placeholder="Private professional notes. These are never sent to the Organization Admin."></textarea>

    <label class="form-label">Organization-safe report</label>
    <textarea id="org-safe-report" class="form-input min-h-36" placeholder="Share only non-sensitive, action-oriented information appropriate for the organization."></textarea>

    <label class="privacy-choice">
      <input id="client-consent-confirmed" type="checkbox">
      <span>
        <b>Client consent confirmed</b>
        <small class="block text-gray-500">The client has consented to sharing this organization-safe report.</small>
      </span>
    </label>

    <div class="flex flex-wrap gap-3">
      <button type="button" id="save-private-note" class="btn-outline">Save private note</button>
      <button type="button" id="publish-org-report" class="btn-gold">Publish organization-safe report</button>
    </div>
    <p id="note-status" class="text-sm"></p>
  </form>
`);

      if (page === 'published-reports' && role === 'counsellor') return panel('Published Reports', `
  <div id="counsellor-published-list">
    <div class="report-card">
      <div><b>Mitra-104</b><small>Published 20 March</small></div>
      <p>Recommended temporary academic flexibility and a follow-up wellness check.</p>
      <span class="published-badge">Published</span>
    </div>
  </div>
`);

      if (page === 'published-reports' && role === 'organization_admin') return panel('Published Counsellor Reports', `
  <div class="note-privacy-banner">
    <b>Organization-safe reports only</b>
    <p>This section never displays private counselling notes or full assessment answers.</p>
  </div>
  <div id="org-published-list" class="mt-4">
    <div class="report-card">
      <div><b>Anonymous Client: Mitra-104</b><small>From verified counsellor · 20 March</small></div>
      <p>Recommended temporary academic flexibility and a follow-up wellness check. No diagnosis or private session details are included.</p>
      <button class="action">Acknowledge</button>
    </div>
  </div>
`);

      if (page === 'appointments' && role === 'client') return panel('My appointments', '<div id="appointment-list"><p class="text-gray-500">Loading appointments…</p></div>');
      if (page === 'appointments' && role === 'counsellor') return panel('Appointment requests', '<div id="appointment-list"><p class="text-gray-500">Loading appointment requests…</p></div>');
      if (page === 'appointments' && role === 'counsellor') return panel('Appointment Requests', `
  <div class="appointment-list">
    <article class="appointment-card">
      <div>
        <b>Mitra-104</b>
        <small>Confirmed · 22 March, 2:00 PM–3:00 PM</small>
      </div>
      <div class="appointment-actions text-sm text-gray-500">Clients can contact approved counsellors through their WhatsApp link.</div>
    </article>
    <article class="appointment-card">
      <div>
        <b>Aarav S.</b>
        <small>Completed · 18 March</small>
      </div>
      <div class="appointment-actions">
        <a class="action" href="counsellor-report.html?appointment=demo-appointment-4">Write report / notes</a>
      </div>
    </article>
  </div>
`);

      if (page === 'follow-ups' && role === 'counsellor') return panel('Client Follow-ups', `
  <div class="note-privacy-banner">
    <b>Counsellor-controlled follow-up</b>
    <p>You can send a supportive follow-up email to a client within seven days after their first completed appointment. Clients do not control this setting.</p>
  </div>
  <div class="followup-list mt-4">
    <article class="followup-card">
      <div>
        <b>Mitra-104</b>
        <small>First appointment completed 3 days ago</small>
      </div>
      <p>Eligible for follow-up until 7 days after the first appointment.</p>
      <textarea id="followup-message-demo-1" class="form-input" rows="3">Hello, we hope you have been doing okay since your first MindMitra appointment. Your counsellor is available if you would like to schedule a follow-up.</textarea>
      <button class="action send-followup" data-client="Mitra-104" data-appointment="demo-appointment-1">Send follow-up email</button>
    </article>
    <article class="followup-card muted">
      <div>
        <b>Aarav S.</b>
        <small>First appointment completed 10 days ago</small>
      </div>
      <p>The seven-day follow-up window has ended.</p>
      <button class="action" disabled>Not eligible</button>
    </article>
  </div>
`);

      return panel((nav[role].find(x => x[0] === page) || ['', '', 'Module'])[2], '<div class="empty-state"><div>🌿</div><h3>This module is ready</h3><p>Connect it to the matching Neon PostgreSQL API.</p></div>');
    }

    async function loadPanel(list = null, dist = false) { const g = $('#counsellor-list'); if (!g) return; try { const items = list || await fetchCounsellors(); g.innerHTML = items.length ? items.map(c => card(c, dist)).join('') : '<div class="empty-state col-span-full"><div>🩺</div><h3>No counsellors found</h3></div>'; $$('.book-counsellor').forEach(button => button.onclick = async () => { const shareReport = confirm('Share your latest automated wellbeing report with this counsellor for review? Choose Cancel to book without sharing it.'); try { await api.post('/appointments', { counsellor_id: button.dataset.counsellor, share_report: shareReport }); toast('Appointment request sent for counsellor approval.', 'success'); go('appointments'); } catch (error) { toast(error.message, 'error'); } }); } catch (e) { g.innerHTML = `<div class="empty-state col-span-full"><div>!</div><h3>${e.message}</h3></div>` } }
    async function loadAppointments() { const target = $('#appointment-list'); if (!target || !api) return; try { const result = await api.get('/appointments'); const items = result.appointments || []; if (!items.length) { target.innerHTML = role === 'client' ? '<div class="empty-state"><div>📅</div><h3>No appointments yet</h3><p>Choose a verified counsellor to request your first appointment.</p><button class="action mt-3" data-jump="counsellors">Book a counsellor</button></div>' : '<div class="empty-state"><div>📅</div><h3>No appointment requests yet</h3><p>New client requests will appear here for review.</p></div>'; $$('.empty-state [data-jump]').forEach(button => button.onclick = () => go(button.dataset.jump)); return; } target.innerHTML = items.map(item => { if (role === 'client') { const action = item.status === 'approved' ? `<button class="action confirm-appointment" data-appointment="${item.id}">Confirm appointment</button>` : item.whatsapp_link ? `<a class="action" href="${item.whatsapp_link}" target="_blank" rel="noopener">Connect on WhatsApp</a>` : ''; return `<article class="appointment-card"><div><b>${item.counsellor_name}</b><small>Status: ${item.status}</small></div><div class="appointment-actions">${action}</div></article>`; } const report = item.user_summary ? `<p class="text-sm mt-2"><b>Client report:</b> ${(item.user_summary.summary || item.user_summary.message || 'Shared automated report')}<br><b>Risk:</b> ${item.risk_level || 'Not provided'}</p>` : '<p class="text-sm text-gray-500 mt-2">The client did not share an automated report.</p>'; const action = item.status === 'requested' ? `<button class="action approve-appointment" data-appointment="${item.id}">Review & approve</button>` : `<span class="text-sm">Status: ${item.status}${item.status === 'confirmed' ? ' · Client can now use WhatsApp' : ''}</span>`; return `<article class="appointment-card"><div><b>${item.client_name}</b><small>Appointment request</small>${report}</div><div class="appointment-actions">${action}</div></article>`; }).join(''); $$('.approve-appointment').forEach(button => button.onclick = async () => { try { await api.patch(`/appointments/${button.dataset.appointment}`, { action: 'approve' }); toast('Appointment approved. The client can now confirm it.', 'success'); loadAppointments(); } catch (error) { toast(error.message, 'error'); } }); $$('.confirm-appointment').forEach(button => button.onclick = async () => { try { await api.patch(`/appointments/${button.dataset.appointment}`, { action: 'confirm' }); toast('Appointment confirmed. WhatsApp contact is now available.', 'success'); loadAppointments(); } catch (error) { toast(error.message, 'error'); } }); } catch (error) { target.innerHTML = `<p class="text-red-600">${error.message}</p>`; } }
    async function loadOrganizationDashboard() {
      const loading = document.querySelector("#org-dashboard-loading");
      const content = document.querySelector("#org-dashboard-content");
      const errorBox = document.querySelector("#org-dashboard-error");

      if (!api || !currentUser || !currentProfile?.organization_id) {
        if (loading) loading.classList.add("hidden");

        if (errorBox) {
          errorBox.classList.remove("hidden");
          errorBox.textContent =
            "Organization information is missing for this account.";
        }

        return;
      }

      try {
        const dashboardData = await api.get('/organization/dashboard');
        const summary = dashboardData.summary;

        document.querySelector("#org-total-students").textContent =
          summary.total_students ?? 0;

        document.querySelector("#org-total-employees").textContent =
          summary.total_employees ?? 0;

        document.querySelector("#org-total-assessments").textContent =
          summary.total_assessments ?? 0;

        document.querySelector("#org-urgent-cases").textContent =
          summary.urgent_cases ?? 0;

        document.querySelector("#org-upcoming-appointments").textContent =
          summary.upcoming_appointments ?? 0;

        document.querySelector("#org-completed-appointments").textContent =
          summary.completed_appointments ?? 0;

        const riskRows = dashboardData.risk_distribution || [];
        const monthlyRows = dashboardData.monthly_assessments || [];

        if (window.orgRiskChart) {
          window.orgRiskChart.destroy();
        }

        if (window.orgMonthlyChart) {
          window.orgMonthlyChart.destroy();
        }

        const riskCanvas = document.querySelector("#risk-chart");

        const monthlyCanvas = document.querySelector(
          "#monthly-assessment-chart"
        );

        if (riskCanvas && window.Chart) {
          window.orgRiskChart = new Chart(riskCanvas, {
            type: "doughnut",
            data: {
              labels: (riskRows || []).map(
                row => row.risk_level
              ),
              datasets: [
                {
                  data: (riskRows || []).map(
                    row => Number(row.total)
                  )
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
        }

        if (monthlyCanvas && window.Chart) {
          window.orgMonthlyChart = new Chart(monthlyCanvas, {
            type: "line",
            data: {
              labels: (monthlyRows || []).map(row =>
                new Date(row.month).toLocaleDateString(
                  undefined,
                  {
                    month: "short",
                    year: "numeric"
                  }
                )
              ),
              datasets: [
                {
                  label: "Assessments",
                  data: (monthlyRows || []).map(
                    row => Number(row.assessments)
                  ),
                  tension: 0.3
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
        }

        if (loading) {
          loading.classList.add("hidden");
        }

        if (content) {
          content.classList.remove("hidden");
        }
      } catch (error) {
        console.error(
          "Organization dashboard error:",
          error
        );

        if (loading) {
          loading.classList.add("hidden");
        }

        if (errorBox) {
          errorBox.classList.remove("hidden");
          errorBox.textContent =
            error.message ||
            "Unable to load organization analytics.";
        }
      }
    }
    function wire(page) {
      if (
        page === "dashboard" &&
        role === "organization_admin"
      ) {
        loadOrganizationDashboard();
      }

      if (page === 'reports' && role === 'client') loadAiReports();
      if (page === 'appointments' && (role === 'client' || role === 'counsellor')) loadAppointments();

      if (page === 'assessment') {
        const start = $('#assessment-start');
        if (start) start.onclick = () => { assessmentState.step = 3; go('assessment') };

        $$('.assessment-scale-option').forEach(button => {
          button.onclick = () => {
            assessmentState.answers[assessmentState.questionIndex] = Number(button.dataset.assessmentValue);
            go('assessment');
          };
        });

        const prev = $('#assessment-prev');
        if (prev) prev.onclick = () => {
          if (assessmentState.questionIndex > 0) {
            assessmentState.questionIndex--;
            go('assessment');
          }
        };

        const next = $('#assessment-next');
        if (next) next.onclick = () => {
          if (assessmentState.answers[assessmentState.questionIndex] === null) return;
          if (assessmentState.questionIndex < ASSESSMENT_QUESTIONS.length - 1) {
            assessmentState.questionIndex++;
            go('assessment');
          } else {
            assessmentState.step = 4;
            go('assessment');
          }
        };

        const back = $('#lifestyle-back');
        if (back) back.onclick = () => {
          assessmentState.step = 3;
          assessmentState.questionIndex = ASSESSMENT_QUESTIONS.length - 1;
          go('assessment');
        };

        const finish = $('#lifestyle-finish');
        if (finish) finish.onclick = async () => {
          assessmentState.lifestyle = {
            sleep_hours: $('#lifestyle-sleep').value,
            exercise_frequency: $('#lifestyle-exercise').value,
            screen_time: $('#lifestyle-screen').value,
            caffeine_intake: $('#lifestyle-caffeine').value,
            alcohol_smoking: $('#lifestyle-substances').value
          };
          calculateAssessmentResult();

          try {
            await saveAssessmentResult();

            if (api && currentUser) {
              toast("Assessment and AI summary saved securely.", "success");
            }
          } catch (error) {
            toast(`Result shown, but saving failed: ${error.message}`, "error");
          }

          assessmentState.step = 5;
          go("assessment");

        };

        const restart = $('#assessment-restart');
        if (restart) restart.onclick = () => { resetAssessment(); go('assessment') };

        const counsellor = $('#assessment-counsellor');
        if (counsellor) counsellor.onclick = () => go('counsellors');

        const dashboard = $('#assessment-dashboard');
        if (dashboard) dashboard.onclick = () => go('dashboard');
      }

      $$('[data-jump]').forEach(b => b.onclick = () => go(b.dataset.jump));
      if (page === 'privacy') $('#save-privacy').onclick = async () => { anonymousMode = $('#panel-anonymous').checked; const alias = $('#panel-alias').value.trim() || `Mitra-${currentUser.id.slice(0, 6).toUpperCase()}`; try { if (api && currentUser) await api.put('/privacy', { share_identity_with_counsellor: !anonymousMode, anonymous_alias: alias }); $('#user-badge').textContent = anonymousMode ? 'A' : userName.charAt(0).toUpperCase(); toast('Privacy preference saved.', 'success') } catch (e) { toast(e.message, 'error') } };
      if (page === 'counsellors') { loadPanel(); $('#find-nearby').onclick = async () => { const b = $('#find-nearby'), txt = b.textContent; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Finding…'; try { const p = await getCurrentPosition(); await loadPanel(await fetchNearby(p.coords.latitude, p.coords.longitude), true); toast('Sorted by distance.', 'success') } catch (e) { toast(e.message, 'error') } finally { b.disabled = false; b.textContent = txt } }; $('#location-search').oninput = e => { const q = e.target.value.toLowerCase(); $$('#counsellor-list .public-counsellor-card').forEach(c => c.classList.toggle('hidden', !c.textContent.toLowerCase().includes(q))) } }

      if (page === 'notes' && role === 'counsellor') {
        const saveButton = $('#save-private-note');
        const publishButton = $('#publish-org-report');
        const status = $('#note-status');

        saveButton.onclick = async () => {
          const privateNote = $('#private-note').value.trim();
          if (!privateNote) { status.textContent = 'Enter a private note first.'; return; }
          try {
            if (api && currentUser) await api.post('/counsellor/notes', { appointment_id: null, private_note: privateNote });
            status.textContent = 'Private note saved. It has not been shared with the organization.';
            toast('Private note saved.', 'success');
          } catch (error) {
            status.textContent = error.message;
            toast(error.message, 'error');
          }
        };

        publishButton.onclick = async () => {
          const report = $('#org-safe-report').value.trim();
          const consent = $('#client-consent-confirmed').checked;
          if (!report) { status.textContent = 'Write an organization-safe report first.'; return; }
          if (!consent) { status.textContent = 'Client consent must be confirmed before publishing.'; return; }

          publishButton.disabled = true;
          publishButton.innerHTML = '<span class="spinner dark"></span> Publishing…';

          try {
            if (api && currentUser) {
              await api.post('/counsellor/reports', {
                organization_id: currentProfile?.organization_id || null,
                appointment_id: null,
                client_id: null,
                client_display_name: 'Mitra-104',
                report_summary: report,
                client_consent_confirmed: true,
                status: 'published',
                published_at: new Date().toISOString()
              });
            }
            status.textContent = 'Organization-safe report published successfully.';
            toast('Report published to Organization Admin.', 'success');
            $('#org-safe-report').value = '';
            $('#client-consent-confirmed').checked = false;
          } catch (error) {
            status.textContent = error.message;
            toast(error.message, 'error');
          } finally {
            publishButton.disabled = false;
            publishButton.textContent = 'Publish organization-safe report';
          }
        };
      }

      $$('.create-meet').forEach(button => {
        button.onclick = async () => {
          const appointmentId = button.dataset.appointment;
          const original = button.textContent;
          button.disabled = true;
          button.innerHTML = '<span class="spinner"></span> Creating Meet…';

          try {
            if (!api || !currentUser) {
              const demoUrl = 'https://meet.google.com/demo-mindmitra';
              const link = button.parentElement.querySelector('.meet-link');
              link.href = demoUrl;
              link.classList.remove('hidden');
              button.textContent = 'Meet created ✓';
              toast('Demo Google Meet link created.', 'success');
              return;
            }

            const result = await api.post('/appointments/google-meet', { appointment_id: appointmentId });

            const link = button.parentElement.querySelector('.meet-link');
            link.href = result.google_meet_url;
            link.classList.remove('hidden');
            button.textContent = 'Meet created ✓';
            toast('Google Meet link created and saved.', 'success');
          } catch (error) {
            toast(error.message, 'error');
            button.disabled = false;
            button.textContent = original;
          }
        };
      });

      if (page === 'follow-ups' && role === 'counsellor') {
        $$('.send-followup').forEach(button => {
          button.onclick = async () => {
            const clientDisplay = button.dataset.client;
            const appointmentId = button.dataset.appointment;
            const message = $(`#followup-message-${appointmentId}`).value.trim();
            if (!message) { toast('Write a follow-up message first.', 'error'); return; }

            button.disabled = true;
            button.innerHTML = '<span class="spinner"></span> Sending…';

            try {
              if (api && currentUser) await api.post('/counsellor/followups', { appointment_id: appointmentId, message });
              toast(`Follow-up queued for ${clientDisplay}.`, 'success');
              button.textContent = 'Follow-up queued ✓';
            } catch (error) {
              toast(error.message, 'error');
              button.disabled = false;
              button.textContent = 'Send follow-up email';
            }
          };
        });
      }
      if (page === 'create-user') $('#create-org-user-form').onsubmit = async e => { e.preventDefault(); const s = $('#create-user-status'); s.textContent = 'Creating account…'; try { if (!api || !currentUser) { s.textContent = 'Demo mode: user created.'; toast('Demo user created.', 'success'); e.target.reset(); return } const r = await api.post('/organization/users', { full_name: $('#member-name').value.trim(), email: $('#member-email').value.trim(), username: $('#member-username').value.trim(), temporary_password: $('#member-password').value, member_type: $('#member-type').value, department: $('#member-department').value.trim(), allow_anonymous_counselling: $('#allow-anonymous').checked }); s.textContent = `Account created for ${r.email}`; toast('Organization user created.', 'success'); e.target.reset() } catch (err) { s.textContent = err.message; toast(err.message, 'error') } };
    }

    const observer = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target) } }), { threshold: .12 });
    $$('.reveal-section').forEach(s => observer.observe(s));

    $$('[data-footer-page]').forEach(button => {
      button.addEventListener('click', () => go(button.dataset.footerPage));
    });
    const footerContact = $('#footer-contact-link');
    if (footerContact) {
      footerContact.addEventListener('click', () => {
        $('#role-app').classList.add('hidden');
        $('#public-site').classList.remove('hidden');
        location.hash = 'contact';
      });
    }

    $('#year').textContent = new Date().getFullYear(); restore();
    window.addEventListener('pageshow', event => { if (event.persisted) restore(); });
  }) ();
