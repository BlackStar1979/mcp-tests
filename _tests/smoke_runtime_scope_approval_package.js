#!/usr/bin/env node
'use strict';
const cp=require('child_process');
const r=cp.spawnSync(process.execPath,['_workflow/scripts/validate_runtime_scope_approval_package.js'],{encoding:'utf8'});
if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(1)}
const o=JSON.parse(r.stdout);
if(o.ok!==true||o.runtime_change_authorized!==false||o.runtime_change_allowed_next!==false||o.candidate_file_count!==7)process.exit(1);
console.log('smoke_runtime_scope_approval_package ok');
