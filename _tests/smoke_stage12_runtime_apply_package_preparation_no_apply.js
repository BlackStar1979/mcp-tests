#!/usr/bin/env node
'use strict';
const cp=require('child_process');
const r=cp.spawnSync(process.execPath,['_workflow/scripts/s35_check.js'],{encoding:'utf8'});
if(r.status!==0){process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(1)}
if(JSON.parse(r.stdout).ok!==true)process.exit(1);
console.log('smoke_stage12_runtime_apply_package_preparation_no_apply ok');
