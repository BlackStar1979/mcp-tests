#!/usr/bin/env node
'use strict';
const { execFileSync } = require('child_process');
const summaryOnly = process.argv.includes('--summary');
function git(args){ return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64*1024*1024 }); }
function parse(text){ return text.split(/\r?\n/).filter(Boolean).map(line => ({ xy: line.slice(0,2), path: line.slice(3).replace(/\\/g,'/') })); }
function bucket(e){
  const p=e.path; const del=e.xy.includes('D');
  if (p === '_workflow/control_plane/worktree_commit_triage.js') return 'COMMIT_TRIAGE_TOOLING';
  if (/^SERVER_.*_SPEC\.json$/.test(p) || p === 'SERVER_SPEC.json') return 'ROOT_SPEC';
  if (p.startsWith('src/')) return 'SRC_RUNTIME';
  if (p.startsWith('_tests/')) return del ? 'LEGACY_DELETION' : 'TEST_GUARD_OR_MANIFEST';
  if (p === '_workflow/ACTIVE_WORKFLOW_INDEX.md' || p === '_workflow/WORKFLOW_CANON.md' || p === '_workflow/state.json') return 'WORKFLOW_TRUTH_SYNC';
  if (p.startsWith('_workflow/')) return del ? 'LEGACY_DELETION' : 'WORKFLOW_SUPPORT';
  if (p.startsWith('plugins/')) return 'PLUGIN_DEV_SURFACE';
  if (p.startsWith('tools/')) return 'DEV_TOOLING';
  if (p.startsWith('_public_sandbox/')) return del ? 'LEGACY_DELETION' : 'PUBLIC_SANDBOX';
  if (p.startsWith('experiments/')) return 'EXPERIMENTAL_ARTIFACT';
  if (p.startsWith('.codebase-memory')) return 'LOCAL_MEMORY_ARTIFACT';
  return 'UNKNOWN_DO_NOT_STAGE';
}
function top(p){ return p.split('/')[0] || ''; }
const entries=parse(git(['status','--porcelain=v1']));
const buckets={}; const counts={total:entries.length}; const topDirs={};
for(const e of entries){ counts[e.xy]=(counts[e.xy]||0)+1; const t=top(e.path); topDirs[t]=(topDirs[t]||0)+1; const b=bucket(e); (buckets[b]||(buckets[b]=[])).push(e.path); }
for(const k of Object.keys(buckets)) buckets[k].sort();
const report={generated_at:new Date().toISOString(),head:git(['rev-parse','--short','HEAD']).trim(),shortstat:git(['diff','--shortstat']).trim(),status_counts:counts,top_dirs:Object.fromEntries(Object.entries(topDirs).sort((a,b)=>b[1]-a[1])),bucket_counts:Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,v.length]).sort((a,b)=>b[1]-a[1])),buckets,proposed_commit_order:['1 rename-normalization: TEST_GUARD_OR_MANIFEST plus matching LEGACY_DELETION closure','2 workflow support and archive boundary: WORKFLOW_SUPPORT plus selected LEGACY_DELETION closure','3 workflow truth sync: WORKFLOW_TRUTH_SYNC plus COMMIT_TRIAGE_TOOLING','4 runtime/spec only if inseparable: SRC_RUNTIME plus ROOT_SPEC plus tooling surfaces'],safety:{stages_files:false,commits_files:false,changes_runtime:false},readme_assessments:{blocker_validity:'valid',connector_refresh_needed:false,oauth21_3008_restart_needed:false,assistant_can_restart_3008_when_authorized:true}};
const out=summaryOnly?{generated_at:report.generated_at,head:report.head,shortstat:report.shortstat,status_counts:report.status_counts,top_dirs:report.top_dirs,bucket_counts:report.bucket_counts,proposed_commit_order:report.proposed_commit_order,safety:report.safety,readme_assessments:report.readme_assessments}:report;
console.log(JSON.stringify(out,null,2));
