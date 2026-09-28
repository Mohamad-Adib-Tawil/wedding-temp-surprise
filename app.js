/* ============================================================
   قالب «المفاجأة» (surprise)
   قصة صوتية تسأل «جاهزين؟» وتتوقف بانتظار الضغط، ثم تنفتح الدعوة.
   يعمل بمسارين: /d/<slug> (محتوى الزبون محقون عبر __INVITE__)
   أو /surprise و file:// (نصوص العرض الافتراضية أدناه).
   ============================================================ */

const DEFAULT_CONFIG = {
  groom: "مصطفى",
  bride: "فاطمة",
  date: "2026-12-24T19:30:00+03:00",
  dateText: "الخميس، ٢٤ كانون الأول ٢٠٢٦",
  timeText: "الساعة السابعة والنصف مساءً",
  heroSub: "يتشرّفان بدعوتكم لمشاركتهما بداية أجمل حكاية",
  verse: "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً",
  invitationText: "بحضوركم تكتمل الحكاية، وتصبح هذه الليلة ذكرى أجمل مما حلمنا بها.",
  groomParents: "السيّد كريم عبد الله والسيّدة هدى",
  brideParents: "السيّد سامي حسن والسيّدة رنا",
  venueName: "قاعة ليالي بغداد",
  venueAddr: "بغداد — الجادرية",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=Baghdad",
  program: [
    { time: "٧:٣٠ مساءً", title: "استقبال الضيوف" },
    { time: "٨:٣٠ مساءً", title: "دخول العروسين" },
    { time: "٩:٣٠ مساءً", title: "العشاء" },
    { time: "١١:٠٠ مساءً", title: "قطع الكيك والسهرة" },
  ],
  notes: ["يُرجى الحضور قبل الموعد بنصف ساعة", "الدعوة تشمل حاملها والعائلة الكريمة"],
  closingNote: "حضوركم أجمل مفاجآت فرحتنا",
  hashtag: "#مصطفى_وفاطمة",
  contactLabel: "للتواصل والتأكيد",
  contactName: "أهل العريس",
  contactPhone: "+9647700000000",
  closingFamilies: "عائلتا العروسين",
  images: {},
};

const STORY_CAPTIONS = [
  { at: 0, text: "مساء الخير يا جماعة" },
  { at: 2.3, text: "جاهزين؟؟" },
  { at: 4.56, text: "حد يرد جاهزين؟" },
  { at: 7.55, text: "ما إنتوا لازم تردّون عشان أعرف أبدي" },
  { at: 10.72, text: "جاهزين؟" },
  { at: 13.8, text: "والآن مع المفاجأة الكبرى" },
];

const FINAL_QUESTION_PAUSE_AT = 11.38;
const READY_SOUND_RESTART_AT = 11.45;
const INVITATION_REVEAL_AT = 16.9;
const YOUTUBE_VIDEO_ID = "GlN6VUk15AY";
const YOUTUBE_START_SECONDS = 4;

/* مسار المنصّة: المحتوى محقون — موسيقى الدعوة يديرها مشغّل المنصّة (اختيار الزبون من المحرر)
   عبر __da3waMusicPrime/Go/Pause، والمشغّل الداخلي أدناه يُستعمل فقط بالمعاينة المستقلة */
const IS_PLATFORM = false;

/* القصة فيها نقرات قبل الفتح («ابدأ» و«جاهزين») — بدون هذا العلم يشغّل مشغّل
   المنصّة أغنية الزبون بأول نقرة فوق صوت القصة. القالب يتسلّم التوقيت بنفسه:
   تهيئة صامتة عند «جاهزين» ثم تشغيل لحظة انفتاح الدعوة (نفس نمط باب الفرح) */
window.__da3waMusicManualStart = true;

const state = {
  started: false,
  muted: false,
  captionIndex: -1,
  phase: "intro",
  homeOpen: false,
  readyPauseTimer: 0,
  homeMusicFrameReady: false,
  homeMusicPlayer: null,
  homeMusicUnlocked: false,
  homeMusicPlaying: false,
  homeMusicUnlockTimer: 0,
  homeMusicRetryTimers: [],
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  const config = getConfig();
  configureInvitation(config);
  fillInvitation(config);
  bindStory();
  if (!IS_PLATFORM) bindYoutubePlayer();
  else if (elements.homeSoundButton) elements.homeSoundButton.hidden = true;
  setupRevealObserver();
  setupCountdown(config.date);
  primeMedia();
  primeHomeMusic();
});

function cacheElements() {
  [
    "surprise", "story", "storyMedia", "storyVideo", "storyPauseFrame", "storyAudio", "storyLine", "storyCaption", "storyHint",
    "startButton", "readyButton", "soundButton", "storyProgress", "progressFill", "youtubeMusic", "homeSoundButton",
    "invitation", "mapButton",
  ].forEach((id) => { elements[id] = document.getElementById(id); });
}

function getConfig() {
  /* محتوى الزبون المحقون يُستعمل كما هو (بلا دمج مع الافتراضيات) — الحقل الذي
     يفرغه الزبون من المحرر يجب أن يختفي، لا أن يعود لنص العرض */
  if (window.INVITATION_CONFIG) return { ...DEFAULT_CONFIG, ...window.INVITATION_CONFIG };

  const params = new URLSearchParams(window.location.search);
  const fromQuery = Object.fromEntries([
    ["groom", params.get("groom")],
    ["bride", params.get("bride")],
    ["date", params.get("date")],
    ["dateText", params.get("dateText")],
    ["timeText", params.get("timeText")],
    ["venueName", params.get("venue")],
    ["venueAddr", params.get("address")],
    ["mapUrl", params.get("map")],
  ].filter(([, value]) => value != null && value !== ""));

  return { ...DEFAULT_CONFIG, ...(window.INVITATION_CONFIG || {}), ...fromQuery };
}

function configureInvitation(config) {
  const assets = config.assets || {};
  const videoSource = elements.storyVideo?.querySelector("source");
  const audioSource = elements.storyAudio?.querySelector("source");
  if (videoSource && assets.storyVideo) videoSource.src = assets.storyVideo;
  if (elements.storyVideo && assets.storyPoster) elements.storyVideo.poster = assets.storyPoster;
  if (elements.storyPauseFrame && assets.storyPause) elements.storyPauseFrame.src = assets.storyPause;
  if (audioSource && assets.storyAudio) audioSource.src = assets.storyAudio;
  if (assets.invitationBackground) {
    document.documentElement.style.setProperty("--invite-background", `url("${assets.invitationBackground}")`);
  }
  if (assets.shareImage) {
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((meta) => {
      meta.content = assets.shareImage;
    });
  }

  const whatsappUrl = config.whatsappUrl || `https://wa.me/${String(config.contactPhone || "").replace(/\D/g, "")}`;
  ["orderButton", "whatsappButton"].forEach((id) => {
    const link = document.getElementById(id);
    if (link) link.href = whatsappUrl;
  });

  const date = new Date(config.date);
  const timeZone = config.timeZone || "Asia/Damascus";
  const localParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const googleStart = `${localParts.year}${localParts.month}${localParts.day}T${localParts.hour}${localParts.minute}${localParts.second}`;
  const googleEndDate = new Date(date.getTime() + (config.calendarDurationHours || 4) * 60 * 60 * 1000);
  const googleEndParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(googleEndDate).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const googleEnd = `${googleEndParts.year}${googleEndParts.month}${googleEndParts.day}T${googleEndParts.hour}${googleEndParts.minute}${googleEndParts.second}`;
  const icsStart = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsEnd = googleEndDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = config.calendarTitle || `دعوة زفاف ${config.groom} و${config.bride}`;
  const place = [config.venueName, config.venueAddr].filter(Boolean).join(" — ");
  const googleCalendar = document.getElementById("googleCalendar");
  if (googleCalendar) {
    const url = new URL("https://calendar.google.com/calendar/render");
    url.search = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${googleStart}/${googleEnd}`, ctz: timeZone, location: place }).toString();
    googleCalendar.href = url.toString();
  }
  document.getElementById("downloadCalendar")?.addEventListener("click", () => {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wedding Invitation//AR", "BEGIN:VEVENT", `DTSTART:${icsStart}`, `DTEND:${icsEnd}`, `SUMMARY:${title}`, `LOCATION:${place}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const blobUrl = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const download = document.createElement("a");
    download.href = blobUrl;
    download.download = "wedding-invitation.ics";
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  });

  const calendar = document.getElementById("da3wa-cal");
  if (calendar) {
    const dateParts = new Intl.DateTimeFormat("ar", { timeZone, year: "numeric", month: "long", day: "numeric", weekday: "long" }).formatToParts(date).reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
    const month = calendar.querySelector(".cal-top");
    const weekday = calendar.querySelector(".cal-wd");
    const day = calendar.querySelector(".cal-day");
    const time = calendar.querySelector(".cal-time");
    if (month) month.textContent = `${dateParts.month} ${dateParts.year}`;
    if (weekday) weekday.textContent = dateParts.weekday;
    if (day) day.textContent = toArabicDigits(dateParts.day);
    if (time) time.textContent = config.timeText || "";
  }
}

/* «فارغ» يشمل نصوص البذور القديمة — نفس قاعدة حارس المنصّة */
const EMPTY_PLACEHOLDERS = ["", "—", "نجل السيّد ...", "كريمة السيّد ...", "کوڕی بەڕێز ...", "کچی بەڕێز ..."];
function isBlank(value) {
  return EMPTY_PLACEHOLDERS.indexOf(String(value == null ? "" : value).trim()) >= 0;
}

function hideChapter(el) {
  const section = el && el.closest(".chapter");
  if (section) section.style.display = "none";
}

function fillInvitation(config) {
  setText("groomName", config.groom);
  setText("brideName", config.bride);
  setText("heroSub", config.heroSub);
  setText("heroDate", config.dateText);
  setText("heroTime", config.timeText);
  setText("venueName", config.venueName);
  setText("venueAddr", config.venueAddr);
  if (isBlank(config.invitationText)) hideChapter(document.getElementById("invitationText"));
  else setText("invitationText", config.invitationText);
  setText("monogram", `${firstLetter(config.groom)} · ${firstLetter(config.bride)}`);
  document.title = `دعوة ${config.groom} و${config.bride}`;

  fillVerse(config);
  fillFamilies(config);
  fillProgram(config.program);
  fillNotes(config.notes);
  fillContact(config);
  fillClosing(config);
  fillVenuePhoto(config.images);

  if (elements.mapButton) {
    if (config.mapUrl && isSafeUrl(config.mapUrl)) elements.mapButton.href = config.mapUrl;
    else elements.mapButton.hidden = true;
  }
}

function fillVerse(config) {
  const el = document.getElementById("verseText");
  if (!el) return;
  if (isBlank(config.verse)) { hideChapter(el); return; }
  el.textContent = config.verse;
}

function fillFamilies(config) {
  const groomEl = document.getElementById("groomParents");
  const brideEl = document.getElementById("brideParents");
  if (!groomEl || !brideEl) return;
  const section = groomEl.closest(".families");

  setLabelFor(groomEl, config.groomParentsLabel);
  setLabelFor(brideEl, config.brideParentsLabel);

  const groomEmpty = isBlank(config.groomParents);
  const brideEmpty = isBlank(config.brideParents);
  if (!groomEmpty) groomEl.textContent = config.groomParents;
  if (!brideEmpty) brideEl.textContent = config.brideParents;

  if (groomEmpty && brideEmpty) { if (section) section.style.display = "none"; return; }
  if (groomEmpty) hideFamilyRow(groomEl);
  if (brideEmpty) hideFamilyRow(brideEl);
  if (groomEmpty || brideEmpty) {
    const heart = section && section.querySelector(".families__heart");
    if (heart) heart.style.display = "none";
  }
  applyFamilyOrder(config.brideFirst, section);
}

function setLabelFor(el, value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return;
  const row = el.closest(".family");
  const label = row && row.querySelector(".family__label");
  if (label) label.textContent = text;
}

function hideFamilyRow(el) {
  const row = el.closest(".family");
  if (row) row.style.display = "none";
}

/* «اسم العروس أولاً»: القيم مبدَّلة من المنصّة، وهنا نرتّب صفّي الأهل ليتطابقا */
function applyFamilyOrder(brideFirst, section) {
  if (brideFirst !== true || !section) return;
  const groomRow = document.getElementById("groomParents")?.closest(".family");
  const brideRow = document.getElementById("brideParents")?.closest(".family");
  const heart = section.querySelector(".families__heart");
  if (groomRow && brideRow && heart) section.replaceChildren(brideRow, heart, groomRow);
}

function fillProgram(items) {
  const box = document.getElementById("timeline");
  if (!box) return;
  if (!Array.isArray(items) || !items.length) { hideChapter(box); return; }
  box.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "timeline__row";
    const time = document.createElement("span");
    time.className = "timeline__time";
    time.textContent = String(item?.time ?? "");
    const dot = document.createElement("span");
    dot.className = "timeline__dot";
    dot.setAttribute("aria-hidden", "true");
    const title = document.createElement("span");
    title.className = "timeline__title";
    title.textContent = String(item?.title ?? "");
    row.append(time, dot, title);
    box.appendChild(row);
  });
}

function fillNotes(items) {
  const ul = document.getElementById("notesList");
  const section = document.getElementById("notesBox");
  if (!ul || !section) return;
  ul.innerHTML = "";
  (Array.isArray(items) ? items : []).forEach((note) => {
    const text = String(note ?? "").trim();
    if (!text) return;
    const li = document.createElement("li");
    li.className = "notes__item";
    const mark = document.createElement("span");
    mark.className = "notes__mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "✦";
    const body = document.createElement("span");
    body.textContent = text;
    li.append(mark, body);
    ul.appendChild(li);
  });
  /* «الملاحظة البارزة» تُحقن من المنصّة داخل هذا القسم قبل القائمة —
     القسم يظهر إذا كانت فيه تنويهات أو ملاحظة محقونة، ويبقى مخفياً إن خلا منهما */
  if (ul.children.length || section.querySelector(".da3wa-note, [id^='da3wa']")) section.hidden = false;
}

function fillContact(config) {
  const link = document.getElementById("contactLink");
  const box = document.getElementById("contactBox");
  if (!link || !box) return;
  const label = box.querySelector(".contact__label");
  if (label && config.contactLabel && !isBlank(config.contactLabel)) label.textContent = config.contactLabel;
  const digits = String(config.contactPhone || "").replace(/[^0-9]/g, "");
  if (!digits) { box.style.display = "none"; return; }
  link.href = config.whatsappUrl || `https://wa.me/${digits}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "☎";
  link.append(icon, document.createTextNode(` ${!isBlank(config.contactName) ? config.contactName : config.contactPhone}`));
}

function fillClosing(config) {
  const note = document.getElementById("closingNote");
  const families = document.getElementById("closingFamilies");
  const hashtag = document.getElementById("hashtag");
  const noteEmpty = isBlank(config.closingNote);
  const familiesEmpty = isBlank(config.closingFamilies);
  const tag = String(config.hashtag || "").trim();

  if (note) { if (noteEmpty) note.style.display = "none"; else note.textContent = config.closingNote; }
  if (families) { if (familiesEmpty) families.style.display = "none"; else families.textContent = config.closingFamilies; }
  if (hashtag) { if (!tag) hashtag.style.display = "none"; else hashtag.textContent = tag; }
  if (noteEmpty && familiesEmpty && !tag) hideChapter(note || families || hashtag);
}

function fillVenuePhoto(images) {
  const url = images && typeof images.venue === "string" ? images.venue.trim() : "";
  const box = document.getElementById("venuePhoto");
  if (!box || !url || !(url.startsWith("/") || url.startsWith("https://"))) return;
  const img = new Image();
  img.onload = () => {
    box.style.backgroundImage = `url("${url.replace(/"/g, "")}")`;
    box.hidden = false;
  };
  img.src = url;
}

function bindStory() {
  elements.startButton?.addEventListener("click", startStory);
  elements.readyButton?.addEventListener("click", continueFromReady);
  elements.soundButton?.addEventListener("click", toggleSound);
  elements.homeSoundButton?.addEventListener("click", toggleSound);

  elements.storyAudio?.addEventListener("timeupdate", updateStory);
  elements.storyAudio?.addEventListener("ended", showReadyButton);
  elements.storyAudio?.addEventListener("error", () => {
    elements.storyHint.textContent = "تعذّر تشغيل الصوت؛ اضغطوا جاهزين للمتابعة";
    showReadyButton();
  });

  elements.storyVideo?.addEventListener("error", () => {
    elements.storyMedia?.classList.add("video-unavailable");
  });
}

function bindYoutubePlayer() {
  window.onYouTubeIframeAPIReady = createHomeMusicPlayer;
  if (window.YT?.Player) {
    createHomeMusicPlayer();
    return;
  }

  if (document.querySelector("script[data-youtube-api]")) return;
  const apiScript = document.createElement("script");
  apiScript.src = "https://www.youtube.com/iframe_api";
  apiScript.async = true;
  apiScript.dataset.youtubeApi = "true";
  document.head.append(apiScript);
}

function createHomeMusicPlayer() {
  if (IS_PLATFORM || state.homeMusicPlayer || !elements.youtubeMusic || !window.YT?.Player) return;
  const playerVars = {
    autoplay: 1,
    start: YOUTUBE_START_SECONDS,
    controls: 0,
    playsinline: 1,
    rel: 0,
    loop: 1,
    playlist: YOUTUBE_VIDEO_ID,
  };
  if (window.location.protocol !== "file:") playerVars.origin = window.location.origin;

  state.homeMusicPlayer = new window.YT.Player(elements.youtubeMusic, {
    width: "1",
    height: "1",
    videoId: YOUTUBE_VIDEO_ID,
    playerVars,
    events: {
      onReady: handleYoutubeReady,
      onStateChange: handleYoutubeStateChange,
    },
  });
}

function handleYoutubeReady(event) {
  state.homeMusicFrameReady = true;
  const iframe = event.target.getIframe();
  iframe.classList.add("youtube-music");
  iframe.dataset.playerState = "ready";
  iframe.setAttribute("title", "موسيقى الدعوة");
  iframe.setAttribute("aria-hidden", "true");
  event.target.mute();
  event.target.setVolume(100);
  event.target.seekTo(YOUTUBE_START_SECONDS, true);
  event.target.playVideo();
  if (state.homeOpen) playHomeMusic();
}

function handleYoutubeStateChange(event) {
  const iframe = event.target.getIframe();
  iframe.dataset.playerState = String(event.data);
  if (!state.homeOpen) return;

  if (event.data === window.YT.PlayerState.PLAYING) state.homeMusicPlaying = !state.muted;
  if ([window.YT.PlayerState.ENDED, window.YT.PlayerState.PAUSED, window.YT.PlayerState.CUED].includes(event.data)) {
    state.homeMusicPlaying = false;
  }
}

function primeMedia() {
  [elements.storyAudio, elements.storyVideo].forEach((media) => {
    if (!media) return;
    media.preload = "auto";
    try { media.load(); } catch (_) {}
  });
}

async function startStory() {
  if (state.started) return;
  state.started = true;
  state.captionIndex = -1;
  state.phase = "intro";
  elements.story?.classList.add("is-playing");
  elements.story?.classList.remove("has-pause-frame");
  elements.readyButton.hidden = true;
  setProgress(0);

  resetMedia();
  elements.storyVideo.muted = true;
  elements.storyAudio.muted = state.muted;

  const results = await Promise.allSettled([
    elements.storyVideo.play(),
    elements.storyAudio.play(),
  ]);

  if (results[1].status === "rejected") {
    elements.storyHint.textContent = "تعذّر تشغيل الصوت؛ اضغطوا جاهزين للمتابعة";
    pauseForReady();
    return;
  }
  scheduleReadyPause();
  updateStory();
}

function updateStory() {
  if (!state.started || state.homeOpen) return;
  const currentTime = Number(elements.storyAudio?.currentTime || 0);
  const duration = Number(elements.storyAudio?.duration || 28);
  if (Number.isFinite(duration) && duration > 0) setProgress((currentTime / duration) * 100);
  syncStoryVideo(elements.storyVideo, currentTime);
  updateCaption(currentTime);

  if (state.phase === "intro" && currentTime >= FINAL_QUESTION_PAUSE_AT) {
    pauseForReady();
    return;
  }

  if (state.phase === "reveal" && currentTime >= INVITATION_REVEAL_AT) openInvitation();
}

function syncStoryVideo(video, time) {
  if (!video || video.readyState < 2 || video.paused) return;
  if (Math.abs(video.currentTime - time) > .34) {
    try { video.currentTime = time; } catch (_) {}
  }
}

function updateCaption(time) {
  let index = 0;
  for (let cursor = STORY_CAPTIONS.length - 1; cursor >= 0; cursor -= 1) {
    if (time >= STORY_CAPTIONS[cursor].at) {
      index = cursor;
      break;
    }
  }
  const readySoundMoment =
    state.phase === "reveal" &&
    time >= READY_SOUND_RESTART_AT &&
    time < 13.8;
  const captionIndex = readySoundMoment ? "ready-sound" : index;
  if (captionIndex === state.captionIndex) return;
  state.captionIndex = captionIndex;
  const text = readySoundMoment ? "جاااهزين!" : STORY_CAPTIONS[index].text;
  if (elements.storyCaption) elements.storyCaption.textContent = text;
  if (elements.storyLine) elements.storyLine.textContent = text || "استمعوا للمفاجأة";
  elements.storyCaption?.classList.remove("is-changing");
  void elements.storyCaption?.offsetWidth;
  elements.storyCaption?.classList.add("is-changing");
}

function showReadyButton() {
  if (!elements.readyButton || state.homeOpen) return;
  elements.readyButton.hidden = false;
  elements.readyButton.focus({ preventScroll: true });
}

function scheduleReadyPause() {
  window.clearTimeout(state.readyPauseTimer);
  const currentTime = Number(elements.storyAudio?.currentTime || 0);
  const delay = Math.max(0, (FINAL_QUESTION_PAUSE_AT - currentTime) * 1000);
  state.readyPauseTimer = window.setTimeout(pauseForReady, delay);
}

function pauseForReady() {
  if (state.phase !== "intro" || state.homeOpen) return;
  window.clearTimeout(state.readyPauseTimer);
  state.phase = "awaiting-ready";
  elements.story?.classList.add("has-pause-frame");
  pauseStoryMedia();
  showReadyButton();
}

async function continueFromReady() {
  if (state.phase !== "awaiting-ready") return;
  window.clearTimeout(state.readyPauseTimer);
  state.phase = "reveal";
  elements.readyButton.hidden = true;
  unlockHomeMusic();
  seekStory(READY_SOUND_RESTART_AT);
  elements.storyAudio.muted = state.muted;
  elements.storyVideo.muted = true;
  await Promise.allSettled([
    elements.storyVideo.play(),
    elements.storyAudio.play(),
  ]);
  updateStory();
}

function openInvitation() {
  if (state.homeOpen) return;
  window.clearTimeout(state.readyPauseTimer);
  state.homeOpen = true;
  state.phase = "opened";
  pauseStoryMedia();
  elements.invitation.hidden = false;
  elements.invitation.setAttribute("aria-hidden", "false");
  document.body.classList.add("home-opening");

  window.setTimeout(() => {
    elements.surprise.hidden = true;
    elements.surprise.setAttribute("aria-hidden", "true");
    document.body.classList.remove("intro-locked", "home-opening");
    document.body.classList.add("home-open");
    startHomeMusic();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, 900);
}

function toggleSound() {
  const shouldStartMusic = state.homeOpen && !state.homeMusicPlaying;
  state.muted = shouldStartMusic ? false : !state.muted;
  if (elements.storyAudio) elements.storyAudio.muted = state.muted;
  if (state.homeOpen && !IS_PLATFORM) {
    if (shouldStartMusic) playHomeMusic();
    else setYoutubeMuted(state.muted);
  }
  elements.soundButton?.classList.toggle("is-muted", state.muted);
  elements.soundButton?.setAttribute("aria-pressed", String(state.muted));
  elements.soundButton?.setAttribute("aria-label", state.muted ? "تشغيل الصوت" : "كتم الصوت");
  elements.homeSoundButton?.classList.toggle("is-muted", state.muted);
  elements.homeSoundButton?.setAttribute("aria-pressed", String(state.muted));
  elements.homeSoundButton?.setAttribute("aria-label", state.muted ? "تشغيل موسيقى الدعوة" : "كتم موسيقى الدعوة");
}

function pauseStoryMedia() {
  [elements.storyAudio, elements.storyVideo].forEach((media) => {
    try { media?.pause(); } catch (_) {}
  });
}

function resetMedia() {
  pauseStoryMedia();
  seekStory(0);
}

function seekStory(time) {
  [elements.storyAudio, elements.storyVideo].forEach((media) => {
    if (!media) return;
    try { media.currentTime = time; } catch (_) {}
  });
}

function startHomeMusic() {
  if (IS_PLATFORM) {
    if (typeof window.__da3waMusicGo === "function") { try { window.__da3waMusicGo(); } catch (_) {} }
    return;
  }
  primeHomeMusic();
  if (!state.homeMusicFrameReady) return;

  playHomeMusic();
}

function playHomeMusic() {
  const activateMusic = () => {
    const player = state.homeMusicPlayer;
    if (!player || !state.homeMusicFrameReady) return;
    player.seekTo(YOUTUBE_START_SECONDS, true);
    player.setVolume(100);
    if (state.muted) player.mute();
    else player.unMute();
    player.playVideo();
    state.homeMusicPlaying = !state.muted;
  };

  clearHomeMusicRetries();
  activateMusic();
  [250, 900, 1800].forEach((delay) => {
    state.homeMusicRetryTimers.push(window.setTimeout(() => {
      if (state.homeOpen) activateMusic();
    }, delay));
  });
}

/* تُستدعى ضمن لمسة «جاهزين» — تفتح إذن الصوت بينما القصة مستمرة */
function unlockHomeMusic() {
  if (IS_PLATFORM) {
    if (typeof window.__da3waMusicPrime === "function") { try { window.__da3waMusicPrime(); } catch (_) {} }
    return;
  }
  primeHomeMusic();
  if (!state.homeMusicFrameReady) return;

  const player = state.homeMusicPlayer;
  state.homeMusicUnlocked = true;
  window.clearTimeout(state.homeMusicUnlockTimer);
  player.setVolume(0);
  player.unMute();
  player.playVideo();
  state.homeMusicUnlockTimer = window.setTimeout(() => {
    if (state.homeOpen) return;
    player.pauseVideo();
    player.mute();
    player.setVolume(100);
  }, 140);
}

function primeHomeMusic() {
  if (IS_PLATFORM) return;
  if (window.YT?.Player) createHomeMusicPlayer();
}

function clearHomeMusicRetries() {
  state.homeMusicRetryTimers.forEach((timer) => window.clearTimeout(timer));
  state.homeMusicRetryTimers = [];
}

function setYoutubeMuted(muted) {
  if (!state.homeMusicFrameReady || !state.homeMusicPlayer) return;
  if (muted) state.homeMusicPlayer.mute();
  else state.homeMusicPlayer.unMute();
}

function setProgress(value) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  if (elements.progressFill) elements.progressFill.style.width = `${percent}%`;
  elements.storyProgress?.setAttribute("aria-valuenow", String(percent));
}

function setupCountdown(dateValue) {
  const target = new Date(dateValue).getTime();
  if (!Number.isFinite(target)) return;

  const update = () => {
    const distance = target - Date.now();
    if (distance <= 0) {
      document.getElementById("countdown").hidden = true;
      document.getElementById("arrived").hidden = false;
      return false;
    }

    const day = 86400000;
    const hour = 3600000;
    const minute = 60000;
    setText("days", toArabicDigits(Math.floor(distance / day)));
    setText("hours", toArabicDigits(Math.floor((distance % day) / hour)).padStart(2, "٠"));
    setText("minutes", toArabicDigits(Math.floor((distance % hour) / minute)).padStart(2, "٠"));
    setText("seconds", toArabicDigits(Math.floor((distance % minute) / 1000)).padStart(2, "٠"));
    return true;
  };

  if (update()) window.setInterval(update, 1000);
}

function setupRevealObserver() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: "0px 0px -35px" });

  items.forEach((item) => observer.observe(item));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element && value != null) element.textContent = String(value);
}

function firstLetter(value) {
  return String(value || "").trim().charAt(0) || "✦";
}

function isSafeUrl(value) {
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
}

function toArabicDigits(value) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}
