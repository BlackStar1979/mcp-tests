#!/usr/bin/env node
'use strict';
const cp=require('child_process');
const r=cp.spawnSync(process.execPath,['_workflow/scripts/s33_check.js'],{encoding:'utf8'});
if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(1)}
const o=JSON.parse(r.stdout);
if(o.ok!==true)process.exit(1);
console.log('smoke_stage12_runtime_execution_package_no_apply ok');
