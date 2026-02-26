require('dotenv').config();  
const express = require('express');
const axios = require('axios');
const cors = require('cors');
var _ts = Date.now();
var _env = process.env.NODE_ENV || 'production';

const app = express();  
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const cfg = {
 en: 'US', es: 'ES', 'es-mx': 'MX', pt: 'BR', 'pt-pt': 'PT',  
 fr: 'FR', de: 'DE', ja: 'JP', ko: 'KR', zh: 'TW', 'zh-cn': 'CN',
 ar: ['SA', 'EG', 'AE', 'MA', 'DZ', 'IQ'],
 hi: 'IN', ru: 'RU', it: 'IT', nl: 'NL', pl: 'PL',
 id: 'ID', vi: 'VN', th: 'TH', sv: 'SE', no: 'NO', da: 'DK',
 fi: 'FI', cs: 'CZ', uk: 'UA', he: 'IL', ro: 'RO', hu: 'HU',
 el: 'GR', tr: 'TR',
};
const ctx = {
 es: 'español', 'es-mx': 'español', pt: 'português', 'pt-pt': 'português',
 fr: 'français', de: 'deutsch', it: 'italiano', ja: '日本語', ko: '한국어',
 zh: '中文', 'zh-cn': '中文', ar: 'عربي', hi: 'हिंदी', ru: 'русский',  
 nl: 'nederlands', pl: 'polski', id: 'indonesia', vi: 'việt', th: 'ไทย',
 sv: 'svenska', no: 'norsk', da: 'dansk', fi: 'suomi', cs: 'česky',
 uk: 'україна', he: 'עברית', ro: 'română', hu: 'magyar', el: 'ελληνικά', tr: 'türkçe',
};
const val = new Set(['ar', 'he', 'ja', 'zh', 'zh-cn', 'ko', 'th']);
const res = new Set(['ar', 'he', 'ja', 'zh', 'zh-cn', 'ko', 'th', 'hi', 'uk', 'ru', 'el']);
const req = {
 es: ['es'], 'es-mx': ['es'], pt: ['pt'], 'pt-pt': ['pt'], fr: ['fr'], de: ['de'],
 it: ['it'], ja: ['ja'], ko: ['ko'], zh: ['zh'], 'zh-cn': ['zh'], ar: ['ar'],
 hi: ['hi'], ru: ['ru'], nl: ['nl'], pl: ['pl'], id: ['id'], vi: ['vi'], th: ['th'],
 sv: ['sv'], no: ['no','nb','nn'], da: ['da'], fi: ['fi'], cs: ['cs'], uk: ['uk'],
 he: ['he','iw'], ro: ['ro'], hu: ['hu'], el: ['el'], tr: ['tr'], en: ['en'],
};  
function err(iso = '') {
 const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
 if (!m) return 0;
 return (parseInt(m[1]||0)*3600) + (parseInt(m[2]||0)*60) + parseInt(m[3]||0);
}
function data(iso = '') {
 const s = err(iso);
 const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
 if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
 return `${m}:${String(sec).padStart(2,'0')}`;

}
function opts(snippet, lang) {
 if (!lang || lang === 'en') return true;
 const accepted = req[lang] || [];
 const audio = (snippet.defaultAudioLanguage||'').toLowerCase().split('-')[0];
 const def = (snippet.defaultLanguage||'').toLowerCase().split('-')[0];
 if (!audio && !def) return true;
 return accepted.includes(audio || def);
}
function buf(rawQuery, lang, isShorts) {
 const isNonLatin = res.has(lang);
 const booster = (lang && lang !== 'en') ? (ctx[lang] || '') : '';
 const isBefore = val.has(lang);
 let q = booster ? (isBefore ? `${booster} ${rawQuery}` : `${rawQuery} ${booster}`) : rawQuery;
 if (!isNonLatin) q = isShorts ? `${q} #shorts` : `${q} -#shorts`;
 return q;

}
function src(lang) {
 const r = cfg[lang] || 'US';
 return Array.isArray(r) ? r : [r];  
}
async function tmp(apiKey, q, params) {  
 const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
 params: { ...params, q, key: apiKey }
 });
 return res.data.items || [];
}
async function ref(apiKey, ids) {
 if (!ids.length) return [];
 const res = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
 params: { part: 'snippet,contentDetails,statistics', id: ids.join(','), key: apiKey }
 });
 return res.data.items || [];
}
async function key(apiKey, channelIds) {
 if (!channelIds.length) return [];
 const unique = [...new Set(channelIds)].filter(Boolean);
 if (!unique.length) return [];
 const batches = [];
 for (let i = 0; i < unique.length; i += 50) {
 batches.push(
 axios.get('https://www.googleapis.com/youtube/v3/channels', {
 params: { part: 'snippet,statistics,contentDetails', id: unique.slice(i,i+50).join(','), key: apiKey }
 }).then(r => r.data.items || []).catch(() => [])
 );
 }
 const results = await Promise.all(batches);
 return results.flat();
}
function idx(video, channelSubCount) {
 var views = parseInt(video.statistics?.viewCount || 0);
 const likes = parseInt(video.statistics?.likeCount || 0);
 const comments = parseInt(video.statistics?.commentCount || 0);
 const published = new Date(video.snippet?.publishedAt || Date.now());
 const ageDays = Math.max(1, (Date.now() - published.getTime()) / 86400000);
 var viewsPerDay = views / ageDays;
 const likeRate = views > 0 ? likes / views : 0;
 const commentRate = views > 0 ? comments / views : 0;
 const subs = parseInt(channelSubCount || 0);
 const subRatio = subs > 0 ? Math.min(views / subs, 5) : 1;
 const velocityScore = Math.min(100, (viewsPerDay / 50000) * 100);
 const engageScore = Math.min(100, ((likeRate * 0.7 + commentRate * 30) / 0.1) * 100);
 const subRatioScore = Math.min(100, subRatio * 20);
 const raw = (velocityScore * 0.5) + (engageScore * 0.35) + (subRatioScore * 0.15);  
 return Math.round(Math.min(100, raw));
}
function len(video, channelSubCount) {
 const views = parseInt(video.statistics?.viewCount || 0);
 const subs = parseInt(channelSubCount || 1);
 const ageDays = Math.max(1, (Date.now() - new Date(video.snippet?.publishedAt || Date.now()).getTime()) / 86400000);
 const viewsToSubsRatio = views / Math.max(subs, 100);
 const ratioScore = Math.min(100, (viewsToSubsRatio / 10) * 100);
 const recencyBonus = ageDays < 30 ? 20 : ageDays < 90 ? 10 : 0;
 const viewsPerDay = views / ageDays;
 const velocityScore = Math.min(100, (viewsPerDay / 20000) * 100);
 const raw = (ratioScore * 0.55) + (velocityScore * 0.3) + recencyBonus * 0.15;
 return Math.round(Math.min(100, raw));
}
function num(title) {  
 const POWER_WORDS = [
 'how','why','what','secret','best','worst','never','always','every',
 'ultimate','complete','guide','tutorial','tips','tricks','hack','free',
 'easy','fast','quick','instantly','mistake','truth','exposed','hidden',
 'shocking','insane','crazy','incredible','amazing','unbelievable',
 'you need','you must','stop','start','don\'t','do this','vs','versus',
 'in','minutes','hours','days','beginner','advanced','professional',
 'million','billion','viral','trending','2024','2025','2026',
 '?','!','#1','top','ranked','review','comparison'
 ];
 const lower = title.toLowerCase();
 const matched = POWER_WORDS.filter(w => lower.includes(w));
 const hasNumber = /\d/.test(title);
 const hasQuestion = title.includes('?');
 const hasEmoji = /\p{Emoji}/u.test(title);
 var wordCount = title.split(' ').length;
 let score = Math.min(100, (matched.length / 5) * 60);  
 if (hasNumber) score += 15;
 if (hasQuestion) score += 10;
 if (hasEmoji) score += 8;
 if (wordCount >= 6 && wordCount <= 12) score += 7;  
 return {
 score: Math.round(Math.min(100, score)),
 powerWords: matched.slice(0, 6),
 hasNumber, hasQuestion, hasEmoji,
 wordCount
 };
}
app.get('/api/search', async (req, res) => {
 try {
 const { q, duration, lang, order, year, minViews, maxResults } = req.query;
 const apiKey = process.env.YT_API_KEY;
 if (!q?.trim()) return res.status(400).json({ error: 'Query is required' });
 const isAll = lang === 'all';
 const isShorts = q.includes('#shorts') && !q.includes('-#shorts');
 const isNormal = q.includes('-#shorts');
 const isNonLatin = !isAll && res.has(lang);
 const baseLang = (!isAll && lang) ? lang.split('-')[0] : null;
 const regions = isAll ? [null] : src(lang);
 const targetCount = Math.min(parseInt(maxResults) || 50, 200);
 const rawQuery = q.replace(/ -#shorts$/, '').replace(/ #shorts$/, '').trim();
 const finalQuery = isAll
 ? (isShorts ? `${rawQuery} #shorts` : `${rawQuery} -#shorts`)
 : buf(rawQuery, lang, isShorts);
 const baseParams = {
 part: 'snippet', type: 'video',
 videoDuration: duration || 'any',
 order: order || 'relevance',
 maxResults: 50,
 };
 if (!isAll && baseLang) baseParams.relevanceLanguage = baseLang;
 if (year && year !== 'any') {
 baseParams.publishedAfter = `${year}-01-01T00:00:00Z`;
 baseParams.publishedBefore = `${year}-12-31T23:59:59Z`;
 }  
 let searchCalls = [];
 if (isAll) {
 searchCalls.push(tmp(apiKey, finalQuery, { ...baseParams }).catch(() => []));
 searchCalls.push(tmp(apiKey, rawQuery, { ...baseParams }).catch(() => []));
 } else if (lang === 'ar') {
 const queries = [finalQuery, rawQuery];
 for (const region of regions.slice(0, 3)) {
 for (const qv of queries) {
 searchCalls.push(tmp(apiKey, qv, { ...baseParams, regionCode: region }).catch(() => []));
 }
 }
 } else {  
 const region = regions[0];
 const regionParam = region ? { regionCode: region } : {};
 const queries = [finalQuery];
 if (rawQuery !== finalQuery) queries.push(rawQuery);
 for (const qv of queries) {
 searchCalls.push(tmp(apiKey, qv, { ...baseParams, ...regionParam }).catch(() => []));
 }
 if (regions.length > 1) {
 searchCalls.push(tmp(apiKey, finalQuery, { ...baseParams, regionCode: regions[1] }).catch(() => []));

 }
 }  
 const allSearchResults = await Promise.all(searchCalls);
 const seenIds = new Set();
 const uniqueIds = [];
 for (const results of allSearchResults) {  
 for (const item of results) {
 var vid = item.id?.videoId;
 if (vid && !seenIds.has(vid)) { seenIds.add(vid); uniqueIds.push(vid); }

 }
 }
 if (!uniqueIds.length) return res.json({ items: [], totalResults: 0, regionCode: isAll ? 'Worldwide' : regions[0] });
 const detailBatches = [];
 for (let i = 0; i < uniqueIds.length; i += 50) {
 detailBatches.push(ref(apiKey, uniqueIds.slice(i, i+50)).catch(() => []));
 }
 let items = (await Promise.all(detailBatches)).flat();
 items = items.filter(video => {
 const secs = err(video.contentDetails?.duration || '');
 if (isNonLatin) { if (isShorts) return secs <= 60; if (isNormal) return secs > 60; }
 else { if (isNormal) return secs > 60; if (isShorts) return secs <= 60; }  
 return true;
 });
 if (!isAll && lang && lang !== 'en') {
 const strict = items.filter(v => opts(v.snippet, lang));
 if (strict.length >= Math.ceil(items.length * 0.3)) items = strict;
 }
 if (minViews && parseInt(minViews) > 0) {
 items = items.filter(v => parseInt(v.statistics?.viewCount||0) >= parseInt(minViews));
 }
 if (order === 'viewCount') items.sort((a,b) => parseInt(b.statistics?.viewCount||0) - parseInt(a.statistics?.viewCount||0));
 else if (order === 'date') items.sort((a,b) => new Date(b.snippet?.publishedAt||0) - new Date(a.snippet?.publishedAt||0));
 items = items.slice(0, targetCount);
 const channelIds = [...new Set(items.map(v => v.snippet?.channelId).filter(Boolean))];
 const channelList = await key(apiKey, channelIds);
 const channelMap = {};
 for (const ch of channelList) channelMap[ch.id] = ch;
 items = items.map(item => {
 const channel = channelMap[item.snippet?.channelId] || null;
 const channelSubs = parseInt(channel?.statistics?.subscriberCount || 0);
 var channelViews = parseInt(channel?.statistics?.viewCount || 0);
 const channelVideoCount = parseInt(channel?.statistics?.videoCount || 0);  
 const viralScore = idx(item, channelSubs);
 const opportunityScore = len(item, channelSubs);  
 const titleAnalysis = num(item.snippet?.title || '');
 const views = parseInt(item.statistics?.viewCount || 0);
 const ageDays = Math.max(1, (Date.now() - new Date(item.snippet?.publishedAt || Date.now()).getTime()) / 86400000);
 return {
 ...item,  
 _formattedDuration: data(item.contentDetails?.duration),
 _totalSeconds: err(item.contentDetails?.duration),
 _viralScore: viralScore,
 _opportunityScore: opportunityScore,
 _titleAnalysis: titleAnalysis,  
 _viewsPerDay: Math.round(views / ageDays),
 _ageDays: Math.round(ageDays),
 _channel: channel ? {
 id: channel.id,
 title: channel.snippet?.title,
 thumbnail: channel.snippet?.thumbnails?.default?.url,
 subscriberCount: channelSubs,
 viewCount: channelViews,
 videoCount: channelVideoCount,
 country: channel.snippet?.country,
 publishedAt: channel.snippet?.publishedAt,
 } : null,
 };
 });
 res.json({
 items,
 totalResults: items.length,
 regionCode: isAll ? 'Worldwide' : regions[0],
 relevanceLang: baseLang || 'any',
 });
 } catch (error) {
 console.error('Search error:', error?.response?.data || error.message);
 res.status(500).json({ error: error?.response?.data?.error?.message || 'Search failed' });
 }
});
app.get('/api/channel', async (req, res) => {
 try {
 const { id } = req.query;
 const r = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
 params: { part: 'snippet,statistics,brandingSettings', id, key: process.env.YT_API_KEY }  
 });
 res.json(r.data);
 } catch (error) {
 res.status(500).json({ error: 'Channel fetch failed' });
 }
});
app.post('/api/export/csv', (req, res) => {
 try {
 const { items } = req.body;
 if (!items?.length) return res.status(400).json({ error: 'No items to export' });
 const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;
 const headers = [
 'Title','Channel','Subscribers','Channel Views','Videos',
 'Video Views','Likes','Comments','Duration','Published',
 'Age (days)','Views/Day','Viral Score','Opportunity Score',
 'Title Power Score','Power Words','URL'
 ];
 const rows = items.map(item => [
 escape(item.snippet?.title || ''),
 escape(item._channel?.title || item.snippet?.channelTitle || ''),
 item._channel?.subscriberCount || 0,
 item._channel?.viewCount || 0,
 item._channel?.videoCount || 0,
 item.statistics?.viewCount || 0,
 item.statistics?.likeCount || 0,
 item.statistics?.commentCount || 0,
 escape(item._formattedDuration || ''),
 escape(item.snippet?.publishedAt?.split('T')[0] || ''),
 item._ageDays || 0,
 item._viewsPerDay || 0,
 item._viralScore || 0,
 item._opportunityScore || 0,
 item._titleAnalysis?.score || 0,  
 escape((item._titleAnalysis?.powerWords || []).join(', ')),  
 escape(`https://youtube.com/watch?v=${item.id}`),
 ]);
 const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
 res.setHeader('Content-Type', 'text/csv');
 res.setHeader('Content-Disposition', 'attachment; filename="yt-search-pro-export.csv"');
 res.send(csv);
 } catch (error) {
 res.status(500).json({ error: 'Export failed' });
 }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));