import { readFileSync } from 'node:fs';
if(!process.argv[2])throw new Error('Usage: node scripts/score-speech.mjs <speech-timings.jsonl>');
const rows=readFileSync(process.argv[2],'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const sessions=Map.groupBy(rows,row=>row.speechSession);
for(const [session,probes] of sessions){
  const times=probes.filter(row=>row.accepted&&Number.isFinite(row.latencyMs)&&row.latencyMs>=0).map(row=>row.latencyMs).sort((a,b)=>a-b);
  const p95=times[Math.ceil(times.length*0.95)-1]??null;
  console.log(JSON.stringify({session,probes:probes.length,accepted:times.length,individual:probes.map(row=>({utterance:row.utterance,actionId:row.actionId,latencyMs:row.latencyMs,accepted:row.accepted})),nearestRankP95Ms:p95,pass:probes.length===10&&times.length===10&&p95<=1000}));
}
