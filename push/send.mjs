// Envoie les rappels Habitudes aux appareils abonnés.
// Lancé chaque heure par .github/workflows/reminders.yml ; n'envoie qu'aux heures choisies dans l'app.
// Variables : HABITUDES_GIST (secret, id du gist de synchro), FORCE=true (test), DATA_FILE (tests locaux), DRY_RUN=1 (tests locaux)
import webpush from 'web-push';
import fs from 'node:fs';

const GIST = (process.env.HABITUDES_GIST || '').trim();
const FORCE = process.env.FORCE === 'true';
const DRY = process.env.DRY_RUN === '1';

async function loadState() {
  if (process.env.DATA_FILE) return JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'));
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'habitudes-rappels' };
  let r = await fetch('https://api.github.com/gists/' + GIST, { headers: process.env.GITHUB_TOKEN ? { ...headers, Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : headers });
  if (!r.ok) r = await fetch('https://api.github.com/gists/' + GIST, { headers });
  if (!r.ok) throw new Error('Gist illisible (HTTP ' + r.status + ') : vérifie le secret HABITUDES_GIST');
  const g = await r.json();
  const f = g.files && g.files['habitudes-sync.json'];
  if (!f) throw new Error('Fichier de synchro absent du gist');
  const txt = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
  return JSON.parse(txt);
}

const fmtDate = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const fmtHour = (d, tz) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(d).find(x => x.type === 'hour').value) % 24;

// Ce qu'il reste à faire aujourd'hui (même règles que l'app)
function remaining(p, day) {
  const run = p.runs && p.runs[p.runs.length - 1];
  if (!run || run.end || run.start > day) return [];
  const on = h => day >= h.start && (!h.archived || day < h.archived);
  const done = (h) => { const e = p.entries && p.entries[h.id] && p.entries[h.id][day]; return e && e.s; };
  const left = [];
  const todos = (p.todos && p.todos[day]) || [];
  const plan = p.habits.find(h => h.kind === 'plan' && on(h));
  if (plan && !todos.length && !done(plan)) left.push('Planifier ta journée');
  for (const x of todos) if (!x.done) left.push(x.text);
  for (const h of p.habits) if (h.kind === 'check' && on(h) && !done(h)) left.push(h.name);
  return left;
}

async function main() {
  if (!GIST && !process.env.DATA_FILE) { console.log('Secret HABITUDES_GIST absent : rien à envoyer.'); return; }
  const S = await loadState();
  const push = S.push;
  if (!push || !push.vapid || !push.subs) { console.log('Aucun appareil abonné aux rappels.'); return; }
  const hours = push.hours && push.hours.length ? push.hours : [12, 18];
  webpush.setVapidDetails('https://github.com/' + (process.env.GITHUB_REPOSITORY || 'loupix0/habitudes'), push.vapid.pub, push.vapid.d);
  const now = new Date();
  let sent = 0;
  for (const [id, sub] of Object.entries(push.subs)) {
    if (!sub || sub.del || !sub.endpoint) continue;
    const tz = sub.tz || 'Europe/Paris';
    const hour = fmtHour(now, tz), day = fmtDate(now, tz);
    if (!FORCE && !hours.includes(hour)) { console.log(`${id} : ${hour} h chez lui, pas une heure de rappel`); continue; }
    const p = S.profiles && (S.profiles[sub.profile] || Object.values(S.profiles)[0]);
    if (!p) continue;
    const left = remaining(p, day);
    if (!left.length && !FORCE) { console.log(`${id} : tout est fait, rien à envoyer`); continue; }
    const payload = left.length
      ? { title: `Il te reste ${left.length} chose${left.length > 1 ? 's' : ''} à faire`, body: left.join(' · ') }
      : { title: 'Habitudes', body: 'Tout est fait pour aujourd’hui. Bravo !' };
    payload.tag = 'habitudes-rappel'; payload.url = './';
    if (DRY) { console.log('DRY', id, JSON.stringify(payload)); sent++; continue; }
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' });
      console.log(`${id} : rappel envoyé (${left.length} élément(s))`); sent++;
    } catch (e) {
      console.log(`${id} : échec ${e.statusCode || ''} ${e.statusCode === 404 || e.statusCode === 410 ? '(abonnement expiré : rouvre l’app et réactive les rappels)' : (e.body || e.message)}`);
    }
  }
  console.log(`Terminé : ${sent} rappel(s).`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
