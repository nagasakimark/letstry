// Interface language: Japanese by default, English on request (remembered).
const S = {
  ja: {
    home: "ホーム", contents: "もくじ", prev: "前のページ", next: "次のページ",
    pen: "ペンでかく", stopPen: "ペンをおわる", reveal: "ボタンを表示", full: "全画面 (F)",
    lineSize: "線の太さ", marker: "蛍光ペン", eraser: "消しゴム（線をタップ）", undo: "もとにもどす", clear: "ぜんぶ消す", cleared: "消しました",
    resetZoom: "表示をもとにもどす (0)", zoomIn: "拡大", zoomOut: "縮小",
    timer: "タイマー", start: "スタート", pause: "一時停止", resume: "再開", stop: "やめる", reset: "リセット", minimize: "小さくする",
    plus1m: "+1分", plus30s: "+30秒", timesUp: "おしまい！",
    lang: "English", langTip: "Switch to English",
    unit: "Unit", page: "ページ", activities: "このページの活動", noActivities: "このページに活動はありません",
    subtitle: "デジタル教科書", grade3: "3年生", grade4: "4年生", units9: "9ユニット", books2: "2さつ", storybooks: "えほん", storybooksEn: "Storybooks",
    copyright: "教科書の内容 © 文部科学省",
    offline: "オフラインで使う", offlineOn: "オフラインで使えます", offlineGet: "ダウンロード", offlineRemove: "削除",
    offlineBusy: "ダウンロード中… {p}%", offlineBroken: "データが一部消えています。もう一度ダウンロードしてください。",
    offlineRedo: "もう一度ダウンロード", offlineFail: "ダウンロードできませんでした。接続を確認して、もう一度ためしてください。",
    offlineSize: "約{mb} MB", offlineDone: "{book} はオフラインで使えます", offlineLost: "{book} のオフラインデータが一部消えています。ホーム画面でもう一度ダウンロードしてください。",
    offlineNoSpace: "保存する空き容量が足りません。", offlineRemoved: "オフラインデータを削除しました",
    close: "閉じる (Esc)", play: "再生", playPause: "再生 / 一時停止", again: "もういちど", startAgain: "はじめから", speed: "再生速度", mute: "ミュート",
    normal: "ふつう", slow: "ゆっくり", withVoice: "うたあり", karaoke: "カラオケ", repeat: "リピート", chant: "チャンツ", song: "うた",
    nextStep: "つぎ", prevStep: "まえ", letter: "文字", word: "単語", readAloud: "よみきかせ", readBook: "えほんでよむ",
    random: "ランダム", loadErr: "読み込めませんでした。接続を確認して再読み込みしてください。",
    t_wat: "Let's Watch and Think", t_chant: "Let's Chant", t_sing: "Let's Sing", t_listen: "Let's Listen", t_play: "Let's Play",
    t_activity: "Activity", t_shimen: "誌面", t_3hints: "スリーヒントクイズ", t_kanji: "漢字クイズ", t_footprints: "足あとクイズ", t_book: "えほん",
    k_audio: "音声を再生", k_video: "動画を再生", k_open: "活動をひらく", k_answer: "答えを表示 / かくす", k_spot: "絵を大きく表示", k_swap: "タップで変える", k_book: "えほんをよむ",
    clearCards: "カードをぜんぶもどす", removeLast: "最後のカードをもどす",
    textTool: "文字を書く", textSize: "文字の大きさ",
    bonus: "ボーナス", voice: "英語の音声", needsOnline: "このゲームはインターネット接続が必要です。", openNewTab: "新しいタブでひらく",
    b_feelings: "気持ちスロット", b_howmany: "いくつ？フラッシュ", b_cardmaker: "カードを作ろう", b_weather: "日本の天気マップ", b_clock: "何時かな？",
    b_hidden: "かくれた文字さがし", b_poll_colors: "アンケート：色", b_poll_fruits: "アンケート：くだもの", b_poll_sports: "アンケート：スポーツ",
    b_poll_animals: "アンケート：動物", b_poll_days: "アンケート：曜日", b_poll_vegetables: "アンケート：野菜",
    w_new: "天気をかえる", w_hide: "天気をかくす", w_show: "天気を見せる", w_ask: "しつもん",
    hm_start: "スタート", hm_again: "もう一回見る", hm_answer: "こたえ",
    sl_spin: "スピン！", cm_smaller: "小さく", cm_bigger: "大きく", cm_turn: "まわす", cm_delete: "けす", cm_clear: "ぜんぶけす",
    ck_new: "時間をかえる", ck_answer: "こたえ",
    picker: "だれにしようかな", pk_class: "クラスの人数", pk_norepeat: "同じ番号を出さない", pk_left: "のこり {n} 人", pk_reset: "リセット",
    pk_pick: "えらぶ", pk_again: "つぎの人", pk_show: "すぐ見せる", pk_settings: "せってい", pk_scratch: "けずってね！",
  },
  en: {
    home: "Home", contents: "Contents", prev: "Previous page", next: "Next page",
    pen: "Draw on the page", stopPen: "Stop drawing", reveal: "Show buttons", full: "Full screen (F)",
    lineSize: "Line size", marker: "Highlighter", eraser: "Eraser (tap a line)", undo: "Undo", clear: "Clear drawing", cleared: "Drawing cleared",
    resetZoom: "Reset view (0)", zoomIn: "Zoom in", zoomOut: "Zoom out",
    timer: "Timer", start: "Start", pause: "Pause", resume: "Resume", stop: "Stop", reset: "Reset", minimize: "Minimise",
    plus1m: "+1 min", plus30s: "+30 sec", timesUp: "Time's up!",
    lang: "日本語", langTip: "日本語に切り替え",
    unit: "Unit", page: "page", activities: "On this page", noActivities: "No activities on this page",
    subtitle: "Digital textbook", grade3: "Grade 3", grade4: "Grade 4", units9: "9 units", books2: "2 books", storybooks: "Storybooks", storybooksEn: "えほん",
    copyright: "Textbook content © MEXT 文部科学省",
    offline: "Use offline", offlineOn: "Available offline", offlineGet: "Download", offlineRemove: "Remove",
    offlineBusy: "Downloading… {p}%", offlineBroken: "Some offline files are missing. Please download again.",
    offlineRedo: "Download again", offlineFail: "Download failed. Check the connection and try again.",
    offlineSize: "about {mb} MB", offlineDone: "{book} is ready to use offline", offlineLost: "Some of {book}'s offline files are missing. Download it again from the home screen.",
    offlineNoSpace: "Not enough storage space to save it.", offlineRemoved: "Offline copy removed",
    close: "Close (Esc)", play: "Play", playPause: "Play / pause", again: "Play again", startAgain: "Start again", speed: "Playback speed", mute: "Mute",
    normal: "Normal", slow: "Slow", withVoice: "Voice", karaoke: "Karaoke", repeat: "Repeat", chant: "Chant", song: "Song",
    nextStep: "Next", prevStep: "Back", letter: "Letter", word: "Word", readAloud: "Read aloud", readBook: "Read the book",
    random: "Random", loadErr: "Couldn't load this. Check the connection and reload.",
    t_wat: "Let's Watch and Think", t_chant: "Let's Chant", t_sing: "Let's Sing", t_listen: "Let's Listen", t_play: "Let's Play",
    t_activity: "Activity", t_shimen: "Picture page", t_3hints: "Three-hint quiz", t_kanji: "Kanji quiz", t_footprints: "Footprints quiz", t_book: "Picture book",
    k_audio: "Play audio", k_video: "Play video", k_open: "Open activity", k_answer: "Show or hide answer", k_spot: "Show picture", k_swap: "Tap to change", k_book: "Read the picture book",
    clearCards: "Clear all cards", removeLast: "Remove last card",
    textTool: "Write text", textSize: "Text size",
    bonus: "Bonus", voice: "English voice", needsOnline: "This game needs an internet connection.", openNewTab: "Open in a new tab",
    b_feelings: "Feelings slot machine", b_howmany: "How many? flash", b_cardmaker: "Card maker", b_weather: "Japan weather map", b_clock: "What time is it?",
    b_hidden: "Hidden Letters", b_poll_colors: "Poll: colours", b_poll_fruits: "Poll: fruit", b_poll_sports: "Poll: sports",
    b_poll_animals: "Poll: animals", b_poll_days: "Poll: days", b_poll_vegetables: "Poll: vegetables",
    w_new: "New weather", w_hide: "Hide weather", w_show: "Show weather", w_ask: "Ask",
    hm_start: "Start", hm_again: "Show again", hm_answer: "Answer",
    sl_spin: "Spin!", cm_smaller: "Smaller", cm_bigger: "Bigger", cm_turn: "Turn", cm_delete: "Delete", cm_clear: "Clear card",
    ck_new: "New time", ck_answer: "Answer",
    picker: "Pick a student", pk_class: "Class size", pk_norepeat: "No repeats", pk_left: "{n} left", pk_reset: "Reset",
    pk_pick: "Pick", pk_again: "Next student", pk_show: "Show now", pk_settings: "Settings", pk_scratch: "Scratch me!",
  },
};

let lang = "ja";
try { lang = localStorage.getItem("lang") === "en" ? "en" : "ja"; } catch {}
document.documentElement.lang = lang;
const subs = new Set();

export const getLang = () => lang;
export function t(key, vars) {
  let s = (S[lang] && S[lang][key]) ?? S.ja[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
export function setLang(l) {
  lang = l;
  try { localStorage.setItem("lang", l); } catch {}
  document.documentElement.lang = l;
  subs.forEach(f => f(l));
}
export const onLang = f => subs.add(f);
